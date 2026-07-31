const { query } = require('../config/db');
const ItemPedido = require('../models/ItemPedido');
const Desembaraco = require('../models/Desembaraco');
const saldoService = require('./saldoService');
const { calcularPedido } = require('./desembaracoCalc');

const MODOS = new Set(['automatico', 'dois_pedidos', 'pedido_base']);

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

function parseId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizarModo(modo) {
  const m = String(modo || 'automatico').trim().toLowerCase();
  return MODOS.has(m) ? m : 'automatico';
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

function snapshotCompra(row) {
  if (!row) return null;
  return {
    item_id: row.item_id,
    pedido_id: row.pedido_id,
    pedido_codigo: row.pedido_codigo,
    data: row.pedido_created_at,
    fornecedor: row.fornecedor,
    fornecedor_id: row.fornecedor_id,
    preco_usd: toNum(row.preco_usd),
    quantidade: toNum(row.quantidade),
    amount_usd: toNum(row.amount_usd),
    custo_unit_brl: row.custo_unit_brl ?? null,
  };
}

/**
 * Monta comparativo de uma referência.
 * @param {string} referencia
 * @param {object[]} compras histórico completo (mais recente primeiro)
 * @param {{ atual?: object|null, anterior?: object|null }} [par] par explícito; default compras[0]/compras[1]
 */
function montarComparativoItem(referencia, compras, par = {}) {
  const temPar =
    Object.prototype.hasOwnProperty.call(par, 'atual') ||
    Object.prototype.hasOwnProperty.call(par, 'anterior');
  const ultima = temPar ? par.atual || null : compras[0] || null;
  const anterior = temPar ? par.anterior || null : compras[1] || null;

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

  const snapUltima = ultima
    ? {
        ...snapshotCompra(ultima),
        preco_usd: precoUltima,
        quantidade: qtdUltima,
        amount_usd: amountUltima,
      }
    : null;
  const snapAnterior = anterior
    ? {
        ...snapshotCompra(anterior),
        preco_usd: precoAnterior,
        quantidade: qtdAnterior,
        amount_usd: amountAnterior,
      }
    : null;

  return {
    referencia,
    descricao:
      ultima?.descricao || compras.find((c) => c.descricao)?.descricao || null,
    qtdCompras: compras.length,
    diasDesdeUltima: ultima ? diasEntre(ultima.pedido_created_at) : null,
    ultima: snapUltima,
    anterior: snapAnterior,
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
    deltaCustoUnitBrl: null,
    deltaCustoUnitPct: null,
    aumentouCusto: false,
    diminuiuCusto: false,
    parManual: Boolean(temPar),
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

function infoPedidoFromRows(rows, pedidoId) {
  const row = rows.find((r) => Number(r.pedido_id) === Number(pedidoId));
  if (!row) return null;
  return {
    id: row.pedido_id,
    codigo: row.pedido_codigo,
    data: row.pedido_created_at,
    fornecedor: row.fornecedor,
  };
}

function resultadoVazio(extra = {}) {
  return {
    itens: [],
    kpis: calcularKpis([]),
    emptyReason: null,
    modoInfo: null,
    ...extra,
  };
}

/**
 * Compara referências presentes nos dois pedidos (A = atual, B = anterior).
 */
function montarDoisPedidos(rows, pedidoA, pedidoB, incluirCusto) {
  const idA = parseId(pedidoA);
  const idB = parseId(pedidoB);

  if (!idA || !idB) {
    return resultadoVazio({ emptyReason: 'selecione_dois_pedidos' });
  }
  if (idA === idB) {
    return resultadoVazio({ emptyReason: 'pedidos_iguais' });
  }

  const rowsA = rows.filter((r) => Number(r.pedido_id) === idA);
  const rowsB = rows.filter((r) => Number(r.pedido_id) === idB);

  if (!rowsA.length && !rowsB.length) {
    return resultadoVazio({ emptyReason: 'pedidos_invalidos' });
  }
  if (!rowsA.length || !rowsB.length) {
    return resultadoVazio({
      emptyReason: 'pedido_sem_itens',
      modoInfo: {
        pedidoA: infoPedidoFromRows(rows, idA) || { id: idA, codigo: String(idA) },
        pedidoB: infoPedidoFromRows(rows, idB) || { id: idB, codigo: String(idB) },
      },
    });
  }

  const mapA = new Map();
  for (const r of rowsA) {
    const key = String(r.referencia || '').trim();
    if (key && !mapA.has(key)) mapA.set(key, r);
  }
  const mapB = new Map();
  for (const r of rowsB) {
    const key = String(r.referencia || '').trim();
    if (key && !mapB.has(key)) mapB.set(key, r);
  }

  const grupos = agruparPorReferencia(rows);
  const refsComuns = [...mapA.keys()].filter((k) => mapB.has(k));

  let itens = refsComuns.map((referencia) => {
    const compras = grupos.get(referencia) || [];
    const item = montarComparativoItem(referencia, compras, {
      atual: mapA.get(referencia),
      anterior: mapB.get(referencia),
    });
    return incluirCusto ? aplicarDeltasCusto(item) : item;
  });

  const modoInfo = {
    pedidoA: infoPedidoFromRows(rowsA, idA),
    pedidoB: infoPedidoFromRows(rowsB, idB),
  };

  if (!itens.length) {
    return {
      itens: [],
      kpis: calcularKpis([]),
      emptyReason: 'nenhum_item_comum',
      modoInfo,
    };
  }

  return { itens, kpis: null, emptyReason: null, modoInfo };
}

/**
 * Itens do pedido base vs compra imediatamente anterior da mesma referência.
 */
function montarPedidoBase(rows, pedidoId, incluirCusto) {
  const id = parseId(pedidoId);
  if (!id) {
    return resultadoVazio({ emptyReason: 'selecione_pedido_base' });
  }

  const rowsBase = rows.filter((r) => Number(r.pedido_id) === id);
  if (!rowsBase.length) {
    return resultadoVazio({ emptyReason: 'pedido_sem_itens' });
  }

  const grupos = agruparPorReferencia(rows);
  const vistos = new Set();
  const itens = [];

  for (const row of rowsBase) {
    const referencia = String(row.referencia || '').trim();
    if (!referencia || vistos.has(referencia)) continue;
    vistos.add(referencia);

    const compras = grupos.get(referencia) || [];
    const idx = compras.findIndex(
      (c) =>
        Number(c.item_id) === Number(row.item_id) ||
        (Number(c.pedido_id) === id &&
          String(c.referencia).trim() === referencia)
    );
    const atual = idx >= 0 ? compras[idx] : row;
    const anterior = idx >= 0 ? compras[idx + 1] || null : compras[1] || null;

    const item = montarComparativoItem(referencia, compras, {
      atual,
      anterior,
    });
    itens.push(incluirCusto ? aplicarDeltasCusto(item) : item);
  }

  const modoInfo = {
    pedidoBase: infoPedidoFromRows(rowsBase, id),
  };

  if (!itens.length) {
    return {
      itens: [],
      kpis: calcularKpis([]),
      emptyReason: 'pedido_sem_itens',
      modoInfo,
    };
  }

  const comHistorico = itens.filter((i) => i.anterior);
  if (!comHistorico.length) {
    return {
      itens,
      kpis: null,
      emptyReason: null,
      modoInfo,
      aviso: 'pedido_sem_historico_anterior',
    };
  }

  return { itens, kpis: null, emptyReason: null, modoInfo };
}

function montarAutomatico(rows, incluirCusto) {
  const grupos = agruparPorReferencia(rows);
  const itens = [...grupos.entries()].map(([referencia, compras]) => {
    const item = montarComparativoItem(referencia, compras);
    return incluirCusto ? aplicarDeltasCusto(item) : item;
  });
  return { itens, kpis: null, emptyReason: null, modoInfo: null };
}

async function listarComparativo(filtros = {}, { incluirCusto = false } = {}) {
  let rows = await carregarHistorico();
  if (incluirCusto) {
    rows = await enriquecerCustoLandado(rows);
  }

  const modo = normalizarModo(filtros.modo);
  let resultado;

  if (modo === 'dois_pedidos') {
    resultado = montarDoisPedidos(
      rows,
      filtros.pedido_a,
      filtros.pedido_b,
      incluirCusto
    );
  } else if (modo === 'pedido_base') {
    resultado = montarPedidoBase(rows, filtros.pedido_id, incluirCusto);
  } else {
    resultado = montarAutomatico(rows, incluirCusto);
  }

  let itens = resultado.itens || [];
  if (!resultado.emptyReason || itens.length) {
    itens = filtrarItens(itens, filtros);
  }

  const kpis = resultado.kpis || calcularKpis(itens);
  const emptyReason =
    !itens.length && resultado.emptyReason
      ? resultado.emptyReason
      : !itens.length
        ? 'nenhum_item_filtro'
        : null;

  return {
    itens,
    kpis,
    modo,
    emptyReason,
    modoInfo: resultado.modoInfo || null,
    aviso: resultado.aviso || null,
  };
}

function acharCompraNoHistorico(compras, compraId) {
  const id = parseId(compraId);
  if (!id) return null;
  return (
    compras.find((c) => Number(c.item_id) === id) ||
    compras.find((c) => Number(c.pedido_id) === id) ||
    null
  );
}

async function detalheReferencia(
  referencia,
  { incluirCusto = true, compraA = null, compraB = null } = {}
) {
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

  const idA = parseId(compraA);
  const idB = parseId(compraB);
  let par = undefined;
  let parEscolhido = false;

  if (idA && idB && idA !== idB) {
    const atual = acharCompraNoHistorico(rows, idA);
    const anterior = acharCompraNoHistorico(rows, idB);
    if (atual && anterior) {
      par = { atual, anterior };
      parEscolhido = true;
    }
  }

  const item = aplicarDeltasCusto(
    montarComparativoItem(
      rows[0].referencia,
      rows,
      parEscolhido ? par : undefined
    )
  );
  item.parEscolhido = parEscolhido;
  item.compraAId = item.ultima?.item_id != null ? Number(item.ultima.item_id) : null;
  item.compraBId = item.anterior?.item_id != null ? Number(item.anterior.item_id) : null;
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
  normalizarModo,
};
