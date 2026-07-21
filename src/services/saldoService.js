const Pagamento = require('../models/Pagamento');
const Alocacao = require('../models/Alocacao');
const Pedido = require('../models/Pedido');
const ItemPedido = require('../models/ItemPedido');
const { query } = require('../config/db');

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function invoiceUsdPedido(pedidoId) {
  const itens = await ItemPedido.findByPedido(pedidoId);
  return itens.reduce((acc, item) => acc + toNum(item.quantidade) * toNum(item.preco_usd), 0);
}

async function resumoSaldo() {
  const { rows: pagRows } = await query(
    `SELECT
       COALESCE(SUM(valor_usd), 0) AS total_usd,
       COALESCE(SUM(valor_brl), 0) AS total_brl
     FROM pagamentos`
  );
  const { rows: alocRows } = await query(
    `SELECT
       COALESCE(SUM(valor_usd), 0) AS alocado_usd,
       COALESCE(SUM(valor_brl), 0) AS alocado_brl
     FROM alocacoes`
  );

  const totalUsd = toNum(pagRows[0].total_usd);
  const totalBrl = toNum(pagRows[0].total_brl);
  const alocadoUsd = toNum(alocRows[0].alocado_usd);
  const alocadoBrl = toNum(alocRows[0].alocado_brl);

  return {
    total_usd: totalUsd,
    total_brl: totalBrl,
    alocado_usd: alocadoUsd,
    alocado_brl: alocadoBrl,
    disponivel_usd: totalUsd - alocadoUsd,
    disponivel_brl: totalBrl - alocadoBrl,
  };
}

async function extrato() {
  const { rows: pagamentos } = await query(
    `SELECT id, data_pagamento AS data, descricao, valor_brl, valor_usd, dolar_dia, tipo, 'credito' AS natureza
     FROM pagamentos
     ORDER BY data_pagamento ASC, id ASC`
  );
  const { rows: alocacoes } = await query(
    `SELECT a.id, a.created_at::date AS data,
            ('Alocação → ' || p.codigo || ' / pag #' || a.pagamento_id) AS descricao,
            a.valor_brl, a.valor_usd, pg.dolar_dia, 'alocacao' AS tipo, 'debito' AS natureza,
            a.pedido_id, p.codigo AS pedido_codigo, a.pagamento_id
     FROM alocacoes a
     JOIN pedidos p ON p.id = a.pedido_id
     JOIN pagamentos pg ON pg.id = a.pagamento_id
     ORDER BY a.created_at ASC, a.id ASC`
  );

  const linhas = [
    ...pagamentos.map((r) => ({ ...r, sinal: 1 })),
    ...alocacoes.map((r) => ({ ...r, sinal: -1 })),
  ].sort((a, b) => {
    const da = new Date(a.data).getTime();
    const db = new Date(b.data).getTime();
    if (da !== db) return da - db;
    return a.id - b.id;
  });

  let saldoUsd = 0;
  let saldoBrl = 0;
  return linhas.map((linha) => {
    const usd = toNum(linha.valor_usd) * linha.sinal;
    const brl = toNum(linha.valor_brl) * linha.sinal;
    saldoUsd += usd;
    saldoBrl += brl;
    return {
      ...linha,
      movimento_usd: usd,
      movimento_brl: brl,
      saldo_usd: saldoUsd,
      saldo_brl: saldoBrl,
    };
  });
}

async function saldoPedido(pedidoId) {
  const invoice = await invoiceUsdPedido(pedidoId);
  const totais = await Alocacao.totaisByPedido(pedidoId);
  const alocadoUsd = toNum(totais.alocado_usd);
  const alocadoBrl = toNum(totais.alocado_brl);
  const faltaUsd = Math.max(0, invoice - alocadoUsd);
  const coberto = alocadoUsd + 1e-9 >= invoice && invoice > 0;

  return {
    invoice_usd: invoice,
    alocado_usd: alocadoUsd,
    alocado_brl: alocadoBrl,
    falta_usd: faltaUsd,
    coberto,
    status_fornecedor: coberto ? 'quitado_fornecedor' : 'aguardando_saldo',
  };
}

/**
 * Aloca manualmente USD de um pagamento para um pedido.
 */
async function alocarManual({ pagamentoId, pedidoId, valorUsd }) {
  const valor = toNum(valorUsd);
  if (valor <= 0) throw new Error('Informe um valor USD maior que zero.');

  const disp = await Alocacao.disponivelPagamento(pagamentoId);
  if (!disp) throw new Error('Pagamento não encontrado.');
  if (valor > toNum(disp.disponivel_usd) + 1e-9) {
    throw new Error('USD insuficiente neste pagamento.');
  }

  const saldoPed = await saldoPedido(pedidoId);
  const maxPedido = saldoPed.falta_usd;
  const aplicar = Math.min(valor, maxPedido);
  if (aplicar <= 0) throw new Error('Pedido já está coberto.');

  const dolar = toNum(disp.dolar_dia);
  const valorBrl = aplicar * dolar;

  return Alocacao.criar({
    pagamento_id: pagamentoId,
    pedido_id: pedidoId,
    valor_usd: aplicar,
    valor_brl: valorBrl,
  });
}

/**
 * FIFO: pagamentos por data → pedidos abertos por data, até cobrir invoices.
 */
async function alocarFifo() {
  const pagamentos = await Pagamento.listar();
  const pedidos = await Pedido.listar();
  // listar pedidos oldest first
  const pedidosOrdenados = [...pedidos].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    if (da !== db) return da - db;
    return a.id - b.id;
  });

  const criadas = [];

  for (const pedido of pedidosOrdenados) {
    let saldoPed = await saldoPedido(pedido.id);
    if (saldoPed.coberto || saldoPed.invoice_usd <= 0) continue;

    for (const pag of pagamentos) {
      if (saldoPed.falta_usd <= 0) break;
      const disp = await Alocacao.disponivelPagamento(pag.id);
      const disponivel = toNum(disp?.disponivel_usd);
      if (disponivel <= 0) continue;

      const aplicar = Math.min(disponivel, saldoPed.falta_usd);
      const dolar = toNum(pag.dolar_dia);
      const aloc = await Alocacao.criar({
        pagamento_id: pag.id,
        pedido_id: pedido.id,
        valor_usd: aplicar,
        valor_brl: aplicar * dolar,
      });
      criadas.push(aloc);
      saldoPed = await saldoPedido(pedido.id);
    }
  }

  return criadas;
}

async function alocacoesComCambio(pedidoId) {
  return Alocacao.listar({ pedidoId });
}

/**
 * Custo produto BRL do pedido = soma (usd_alocado * dolar_dia do pagamento)
 */
function custoProdutoBrlFromAlocacoes(alocacoes) {
  return alocacoes.reduce((acc, a) => acc + toNum(a.valor_brl), 0);
}

module.exports = {
  resumoSaldo,
  extrato,
  saldoPedido,
  alocarManual,
  alocarFifo,
  alocacoesComCambio,
  custoProdutoBrlFromAlocacoes,
  invoiceUsdPedido,
};
