const Alocacao = require('../models/Alocacao');
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

/**
 * Pool: disponível BRL = conversão do USD ainda livre em cada pagamento
 * (restante_usd * dolar_dia). Assim, se USD disponível = 0, BRL disponível = 0.
 */
async function resumoSaldo() {
  const { rows } = await query(
    `SELECT
       COALESCE(SUM(pg.valor_usd), 0) AS total_usd,
       COALESCE(SUM(pg.valor_brl), 0) AS total_brl,
       COALESCE(SUM(GREATEST(pg.valor_usd - COALESCE(a.alocado_usd, 0), 0)), 0) AS disponivel_usd,
       COALESCE(SUM(
         GREATEST(pg.valor_usd - COALESCE(a.alocado_usd, 0), 0) * pg.dolar_dia
       ), 0) AS disponivel_brl
     FROM pagamentos pg
     LEFT JOIN (
       SELECT pagamento_id, SUM(valor_usd) AS alocado_usd
       FROM alocacoes
       GROUP BY pagamento_id
     ) a ON a.pagamento_id = pg.id`
  );

  const totalUsd = toNum(rows[0].total_usd);
  const totalBrl = toNum(rows[0].total_brl);
  const disponivelUsd = toNum(rows[0].disponivel_usd);
  const disponivelBrl = toNum(rows[0].disponivel_brl);

  return {
    total_usd: totalUsd,
    total_brl: totalBrl,
    disponivel_usd: disponivelUsd,
    disponivel_brl: disponivelBrl,
    alocado_usd: totalUsd - disponivelUsd,
    alocado_brl: totalBrl - disponivelBrl,
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

  // BRL da fatia = conversão do USD pelo dólar do pagamento (mesma base do disponível).
  const dolar = toNum(disp.dolar_dia);
  const pagUsd = toNum(disp.valor_usd);
  const pagBrl = toNum(disp.valor_brl);
  let valorBrl = aplicar * dolar;
  if (pagUsd > 0 && pagBrl > 0) {
    // Preferir rateio do BRL do pagamento para esgotar BRL junto com o USD.
    valorBrl = (aplicar / pagUsd) * pagBrl;
  }

  return Alocacao.criar({
    pagamento_id: pagamentoId,
    pedido_id: pedidoId,
    valor_usd: aplicar,
    valor_brl: valorBrl,
  });
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
  alocacoesComCambio,
  custoProdutoBrlFromAlocacoes,
  invoiceUsdPedido,
};
