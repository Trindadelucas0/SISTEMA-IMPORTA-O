const { query } = require('../config/db');
const ItemPedido = require('../models/ItemPedido');
const Desembaraco = require('../models/Desembaraco');
const saldoService = require('./saldoService');
const { calcularPedido } = require('./desembaracoCalc');

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(toNum(n) * 100) / 100;
}

function round1(n) {
  return Math.round(toNum(n) * 10) / 10;
}

function deltaPct(atual, anterior) {
  const a = toNum(atual);
  const b = toNum(anterior);
  if (b === 0) return null;
  return round1(((a - b) / b) * 100);
}

function diasEntre(dataIso) {
  if (!dataIso) return null;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.max(0, Math.floor((now - d) / (1000 * 60 * 60 * 24)));
}

/**
 * Histórico bruto de compras por referência (mais recente primeiro).
 */
async function carregarHistorico() {
  const { rows } = await query(
    `SELECT
       i.id AS item_id,
       i.referencia,
       i.descricao,
       i.quantidade,
       i.preco_usd,
       (i.quantidade * i.preco_usd) AS amount_usd,
       i.ncm,
       p.id AS pedido_id,
       p.codigo AS pedido_codigo,
       p.created_at AS pedido_created_at,
       p.status AS pedido_status,
       p.fornecedor_id,
       COALESCE(f.nome, p.fornecedor) AS fornecedor
     FROM itens_pedido i
     JOIN pedidos p ON p.id = i.pedido_id
     LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
     WHERE TRIM(i.referencia) <> ''
     ORDER BY i.referencia ASC, p.created_at DESC, i.id DESC`
  );
  return rows;
}

function agruparPorReferencia(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row.referencia || '').trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function rankingFornecedores(compras) {
  const byForn = new Map();
  for (const c of compras) {
    const nome = (c.fornecedor || '').trim() || 'Sem fornecedor';
    if (!byForn.has(nome)) {
      byForn.set(nome, {
        fornecedor: nome,
        fornecedor_id: c.fornecedor_id || null,
        qtdCompras: 0,
        precos: [],
        ultimaData: null,
        ultimaPedido: null,
      });
    }
    const r = byForn.get(nome);
    r.qtdCompras += 1;
    r.precos.push(toNum(c.preco_usd));
    if (!r.ultimaData || new Date(c.pedido_created_at) > new Date(r.ultimaData)) {
      r.ultimaData = c.pedido_created_at;
      r.ultimaPedido = c.pedido_codigo;
    }
  }

  const totalCompras = compras.length || 1;

  return [...byForn.values()]
    .map((r) => {
      const precos = r.precos;
      const soma = precos.reduce((a, b) => a + b, 0);
      const precoMin = Math.min(...precos);
      const precoMax = Math.max(...precos);
      return {
        fornecedor: r.fornecedor,
        fornecedor_id: r.fornecedor_id,
        qtdCompras: r.qtdCompras,
        pctCompras: round1((r.qtdCompras / totalCompras) * 100),
        precoMedio: round2(soma / precos.length),
        precoMin: round2(precoMin),
        precoMax: round2(precoMax),
        spread: round2(precoMax - precoMin),
        ultimaData: r.ultimaData,
        ultimaPedido: r.ultimaPedido,
      };
    })
    .sort((a, b) => a.precoMedio - b.precoMedio);
}

function montarComparativoItem(referencia, compras) {
  const ultima = compras[0] || null;
  const anterior = compras[1] || null;
  const precos = compras.map((c) => toNum(c.preco_usd));
  const precoMin = precos.length ? Math.min(...precos) : null;
  const precoMax = precos.length ? Math.max(...precos) : null;
  const precoMedio = precos.length
    ? round2(precos.reduce((a, b) => a + b, 0) / precos.length)
    : null;

  const ranking = rankingFornecedores(compras);
  const melhorFornecedor = ranking[0] || null;
  const piorFornecedor = ranking.length ? ranking[ranking.length - 1] : null;

  const precoUltima = ultima ? toNum(ultima.preco_usd) : null;
  const precoAnterior = anterior ? toNum(anterior.preco_usd) : null;
  const qtdUltima = ultima ? toNum(ultima.quantidade) : null;
  const qtdAnterior = anterior ? toNum(anterior.quantidade) : null;
  const amountUltima = ultima ? toNum(ultima.amount_usd) : null;
  const amountAnterior = anterior ? toNum(anterior.amount_usd) : null;

  const deltaPrecoUsd =
    ultima && anterior ? round2(precoUltima - precoAnterior) : null;
  const deltaPrecoPct =
    ultima && anterior ? deltaPct(precoUltima, precoAnterior) : null;
  const deltaQtd =
    ultima && anterior ? round2(qtdUltima - qtdAnterior) : null;
  const deltaQtdPct =
    ultima && anterior ? deltaPct(qtdUltima, qtdAnterior) : null;
  const deltaAmountUsd =
    ultima && anterior ? round2(amountUltima - amountAnterior) : null;
  const deltaAmountPct =
    ultima && anterior ? deltaPct(amountUltima, amountAnterior) : null;

  const vsMediaPct =
    ultima && precoMedio != null && precoMedio !== 0
      ? deltaPct(precoUltima, precoMedio)
      : null;
  const vsMelhorPct =
    ultima && melhorFornecedor?.precoMedio
      ? deltaPct(precoUltima, melhorFornecedor.precoMedio)
      : null;

  const fornUltima = (ultima?.fornecedor || '').trim();
  const fornAnterior = (anterior?.fornecedor || '').trim();
  const trocouFornecedor = Boolean(
    ultima &&
      anterior &&
      fornUltima &&
      fornAnterior &&
      fornUltima.toLowerCase() !== fornAnterior.toLowerCase()
  );

  return {
    referencia,
    descricao: ultima?.descricao || compras.find((c) => c.descricao)?.descricao || null,
    qtdCompras: compras.length,
    diasDesdeUltima: ultima ? diasEntre(ultima.pedido_created_at) : null,
    ultima: ultima
      ? {
          item_id: ultima.item_id,
          pedido_id: ultima.pedido_id,
          pedido_codigo: ultima.pedido_codigo,
          data: ultima.pedido_created_at,
          fornecedor: ultima.fornecedor,
          fornecedor_id: ultima.fornecedor_id,
          preco_usd: precoUltima,
          quantidade: qtdUltima,
          amount_usd: amountUltima,
          custo_unit_brl: ultima.custo_unit_brl ?? null,
        }
      : null,
    anterior: anterior
      ? {
          item_id: anterior.item_id,
          pedido_id: anterior.pedido_id,
          pedido_codigo: anterior.pedido_codigo,
          data: anterior.pedido_created_at,
          fornecedor: anterior.fornecedor,
          fornecedor_id: anterior.fornecedor_id,
          preco_usd: precoAnterior,
          quantidade: qtdAnterior,
          amount_usd: amountAnterior,
          custo_unit_brl: anterior.custo_unit_brl ?? null,
        }
      : null,
    deltaPrecoUsd,
    deltaPrecoPct,
    deltaQtd,
    deltaQtdPct,
    deltaAmountUsd,
    deltaAmountPct,
    vsMediaPct,
    vsMelhorPct,
    trocouFornecedor,
    aumentouPreco: deltaPrecoUsd != null && deltaPrecoUsd > 0,
    diminuiuPreco: deltaPrecoUsd != null && deltaPrecoUsd < 0,
    aumentouQtd: deltaQtd != null && deltaQtd > 0,
    diminuiuQtd: deltaQtd != null && deltaQtd < 0,
    precoMin,
    precoMax,
    precoMedio,
    melhorFornecedor,
    piorFornecedor,
    ranking,
    historico: compras,
    // custo landado (preenchido depois se disponível)
    deltaCustoUnitBrl: null,
    deltaCustoUnitPct: null,
    aumentouCusto: false,
    diminuiuCusto: false,
  };
}

/**
 * Calcula total_custo_unit por item_id nos pedidos que têm desembaraço e estão cobertos.
 */
async function enriquecerCustoLandado(rows) {
  const pedidoIds = [...new Set(rows.map((r) => r.pedido_id))];
  const custoByItemId = new Map();

  for (const pedidoId of pedidoIds) {
    const desembaraco = await Desembaraco.findByPedido(pedidoId);
    if (!desembaraco) continue;

    const itens = await ItemPedido.findByPedido(pedidoId);
    if (!itens.length) continue;

    const saldo = await saldoService.saldoPedido(pedidoId);
    if (!saldo.coberto) continue;

    const { linhas } = calcularPedido(itens, desembaraco, {
      coberto: true,
      custoProdutoBrl: saldo.alocado_brl,
    });

    for (const linha of linhas) {
      if (linha.total_custo_unit != null) {
        custoByItemId.set(linha.id, toNum(linha.total_custo_unit));
      }
    }
  }

  for (const row of rows) {
    row.custo_unit_brl = custoByItemId.has(row.item_id)
      ? custoByItemId.get(row.item_id)
      : null;
  }

  return rows;
}

function aplicarDeltasCusto(item) {
  const u = item.ultima?.custo_unit_brl;
  const a = item.anterior?.custo_unit_brl;
  if (u == null || a == null) return item;
  const delta = round2(toNum(u) - toNum(a));
  item.deltaCustoUnitBrl = delta;
  item.deltaCustoUnitPct = deltaPct(u, a);
  item.aumentouCusto = delta > 0;
  item.diminuiuCusto = delta < 0;
  return item;
}

function filtrarItens(itens, filtros = {}) {
  let lista = itens;
  const q = String(filtros.q || '').trim().toLowerCase();
  if (q) {
    lista = lista.filter(
      (i) =>
        i.referencia.toLowerCase().includes(q) ||
        (i.descricao || '').toLowerCase().includes(q)
    );
  }

  const fornecedorId = Number(filtros.fornecedor_id);
  if (Number.isFinite(fornecedorId) && fornecedorId > 0) {
    lista = lista.filter((i) => Number(i.ultima?.fornecedor_id) === fornecedorId);
  } else if (filtros.fornecedor) {
    const nome = String(filtros.fornecedor).trim().toLowerCase();
    lista = lista.filter(
      (i) => (i.ultima?.fornecedor || '').toLowerCase() === nome
    );
  }

  if (filtros.somenteVariacao === '1' || filtros.somenteVariacao === true) {
    lista = lista.filter((i) => i.deltaPrecoUsd != null && i.deltaPrecoUsd !== 0);
  }

  if (filtros.somenteTroca === '1' || filtros.somenteTroca === true) {
    lista = lista.filter((i) => i.trocouFornecedor);
  }

  if (filtros.somenteCusto === '1' || filtros.somenteCusto === true) {
    lista = lista.filter(
      (i) => i.ultima?.custo_unit_brl != null && i.anterior?.custo_unit_brl != null
    );
  }

  return lista;
}

function calcularKpis(itens) {
  const comAnterior = itens.filter((i) => i.anterior);
  const aumentos = itens.filter((i) => i.aumentouPreco).length;
  const quedas = itens.filter((i) => i.diminuiuPreco).length;
  const trocas = itens.filter((i) => i.trocouFornecedor).length;
  const comPct = comAnterior.filter((i) => i.deltaPrecoPct != null);
  const mediaVariacaoPct = comPct.length
    ? round1(comPct.reduce((a, i) => a + i.deltaPrecoPct, 0) / comPct.length)
    : null;

  const comCusto = itens.filter((i) => i.deltaCustoUnitBrl != null);
  const aumentosCusto = itens.filter((i) => i.aumentouCusto).length;
  const quedasCusto = itens.filter((i) => i.diminuiuCusto).length;

  return {
    totalItens: itens.length,
    comHistorico: comAnterior.length,
    aumentos,
    quedas,
    trocas,
    mediaVariacaoPct,
    comCusto: comCusto.length,
    aumentosCusto,
    quedasCusto,
  };
}

async function listarComparativo(filtros = {}, { incluirCusto = false } = {}) {
  let rows = await carregarHistorico();
  if (incluirCusto) {
    rows = await enriquecerCustoLandado(rows);
  }

  const grupos = agruparPorReferencia(rows);
  let itens = [...grupos.entries()].map(([referencia, compras]) => {
    const item = montarComparativoItem(referencia, compras);
    return incluirCusto ? aplicarDeltasCusto(item) : item;
  });

  itens = filtrarItens(itens, filtros);
  const kpis = calcularKpis(itens);

  return { itens, kpis };
}

async function detalheReferencia(referencia, { incluirCusto = true } = {}) {
  const ref = String(referencia || '').trim();
  if (!ref) return null;

  let rows = await carregarHistorico();
  rows = rows.filter(
    (r) => String(r.referencia).trim().toLowerCase() === ref.toLowerCase()
  );
  if (!rows.length) return null;

  if (incluirCusto) {
    rows = await enriquecerCustoLandado(rows);
  }

  const item = aplicarDeltasCusto(montarComparativoItem(rows[0].referencia, rows));
  return item;
}

async function resumoHub() {
  const { itens, kpis } = await listarComparativo({}, { incluirCusto: false });
  return { kpis, totalReferencias: itens.length };
}

module.exports = {
  listarComparativo,
  detalheReferencia,
  resumoHub,
  carregarHistorico,
};
