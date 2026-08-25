const Pedido = require('../models/Pedido');
const Pagamento = require('../models/Pagamento');
const saldoService = require('../services/saldoService');
const cotacaoService = require('../services/cotacaoService');
const { statusPedidoLabel, isPedidoAberto } = require('../utils/format');

function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function buildPagamentosSerie(pagamentos, months = 6) {
  const now = new Date();
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }

  const buckets = {};
  keys.forEach((k) => {
    buckets[k] = { usd: 0, brl: 0 };
  });

  pagamentos.forEach((p) => {
    if (!p.data_pagamento) return;
    const d = new Date(p.data_pagamento);
    if (Number.isNaN(d.getTime())) return;
    const k = monthKey(d);
    if (!buckets[k]) return;
    buckets[k].usd += Number(p.valor_usd) || 0;
    buckets[k].brl += Number(p.valor_brl) || 0;
  });

  return {
    labels: keys.map(monthLabel),
    usd: keys.map((k) => Math.round(buckets[k].usd * 100) / 100),
    brl: keys.map((k) => Math.round(buckets[k].brl * 100) / 100),
  };
}

async function dashboard(req, res, next) {
  try {
    const [pedidos, pagamentos, saldo, cotacoes] = await Promise.all([
      Pedido.listar(),
      Pagamento.listar(),
      saldoService.resumoSaldo(),
      cotacaoService.obterCotacoes(),
    ]);

    const totalBrl = pagamentos.reduce((a, p) => a + Number(p.valor_brl || 0), 0);
    const totalUsd = pagamentos.reduce((a, p) => a + Number(p.valor_usd || 0), 0);
    const ticketMedioUsd =
      pagamentos.length > 0
        ? Math.round((totalUsd / pagamentos.length) * 100) / 100
        : 0;

    const statusMap = {};
    pedidos.forEach((p) => {
      const key = statusPedidoLabel(p.status || 'sem status');
      statusMap[key] = (statusMap[key] || 0) + 1;
    });

    const coberturasAll = [];
    let invoiceTotalUsd = 0;
    let faltaTotalUsd = 0;
    let qtdAbertos = 0;
    let qtdCobertos = 0;
    let qtdCriticos = 0;
    let somaPct = 0;

    for (const p of pedidos) {
      const s = await saldoService.saldoPedido(p.id);
      const invoice = Number(s.invoice_usd) || 0;
      const alocado = Number(s.alocado_usd) || 0;
      const falta = Number(s.falta_usd) || 0;
      const pct = invoice > 0 ? Math.min(100, (alocado / invoice) * 100) : s.coberto ? 100 : 0;
      const coberto = !!s.coberto;
      const aberto = isPedidoAberto(p.status);

      invoiceTotalUsd += invoice;
      faltaTotalUsd += Math.max(0, falta);
      if (aberto) qtdAbertos += 1;
      if (coberto) qtdCobertos += 1;
      if (aberto && falta > 0) qtdCriticos += 1;
      somaPct += pct;

      coberturasAll.push({
        id: p.id,
        codigo: p.codigo,
        status: p.status,
        invoice_usd: invoice,
        alocado_usd: alocado,
        falta_usd: Math.max(0, falta),
        pct: Math.round(pct * 10) / 10,
        coberto,
      });
    }

    const coberturaMedia =
      pedidos.length > 0 ? Math.round((somaPct / pedidos.length) * 10) / 10 : 0;

    const totalPoolUsd = Number(saldo.total_usd) || 0;
    const alocadoPoolUsd = Number(saldo.alocado_usd) || 0;
    const utilizacaoPct =
      totalPoolUsd > 0
        ? Math.round(Math.min(100, (alocadoPoolUsd / totalPoolUsd) * 100) * 10) / 10
        : 0;

    const ptax = cotacoes && cotacoes.ptax ? cotacoes.ptax : null;

    const kpi = {
      qtdAbertos,
      qtdCobertos,
      qtdCriticos,
      invoiceTotalUsd,
      faltaTotalUsd,
      coberturaMedia,
      utilizacaoPct,
      ticketMedioUsd,
      ptaxAsk: ptax && Number.isFinite(Number(ptax.ask)) ? Number(ptax.ask) : null,
      ptaxPct: ptax && Number.isFinite(Number(ptax.pctChange)) ? Number(ptax.pctChange) : null,
    };

    const topCobertura = coberturasAll.slice(0, 8);
    const coberturaChart = {
      labels: topCobertura.map((c) => c.codigo),
      alocado: topCobertura.map((c) => Math.round(Number(c.alocado_usd) * 100) / 100),
      falta: topCobertura.map((c) => Math.round(Number(c.falta_usd) * 100) / 100),
    };

    const pagamentosSerie = buildPagamentosSerie(pagamentos, 6);

    res.render('dashboard/index', {
      title: 'Dashboard',
      pedidos: pedidos.slice(0, 8),
      qtdPedidos: pedidos.length,
      qtdPagamentos: pagamentos.length,
      totalBrl,
      totalUsd,
      saldo,
      statusLabels: Object.keys(statusMap),
      statusValues: Object.values(statusMap),
      coberturas: coberturasAll.slice(0, 10),
      coberturaChart,
      pagamentosSerie,
      cotacoes,
      kpi,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };
