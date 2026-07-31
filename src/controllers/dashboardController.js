const Pedido = require('../models/Pedido');
const Pagamento = require('../models/Pagamento');
const saldoService = require('../services/saldoService');
const cotacaoService = require('../services/cotacaoService');
const { statusPedidoLabel } = require('../utils/format');

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
    let somaPct = 0;

    for (const p of pedidos) {
      const s = await saldoService.saldoPedido(p.id);
      const invoice = Number(s.invoice_usd) || 0;
      const alocado = Number(s.alocado_usd) || 0;
      const falta = Number(s.falta_usd) || 0;
      const pct = invoice > 0 ? Math.min(100, (alocado / invoice) * 100) : s.coberto ? 100 : 0;
      const coberto = !!s.coberto;
      const aberto = p.status !== 'embarcada';

      invoiceTotalUsd += invoice;
      faltaTotalUsd += Math.max(0, falta);
      if (aberto) qtdAbertos += 1;
      if (coberto) qtdCobertos += 1;
      somaPct += pct;

      coberturasAll.push({
        id: p.id,
        codigo: p.codigo,
        status: p.status,
        invoice_usd: invoice,
        alocado_usd: alocado,
        falta_usd: falta,
        pct: Math.round(pct * 10) / 10,
        coberto,
      });
    }

    const coberturaMedia =
      pedidos.length > 0 ? Math.round((somaPct / pedidos.length) * 10) / 10 : 0;

    const ptax = cotacoes && cotacoes.ptax ? cotacoes.ptax : null;

    const kpi = {
      qtdAbertos,
      qtdCobertos,
      invoiceTotalUsd,
      faltaTotalUsd,
      coberturaMedia,
      ptaxAsk: ptax && Number.isFinite(Number(ptax.ask)) ? Number(ptax.ask) : null,
      ptaxPct: ptax && Number.isFinite(Number(ptax.pctChange)) ? Number(ptax.pctChange) : null,
    };

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
      cotacoes,
      kpi,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };
