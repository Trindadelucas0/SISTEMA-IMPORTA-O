const Pedido = require('../models/Pedido');
const Pagamento = require('../models/Pagamento');

async function dashboard(req, res, next) {
  try {
    const pedidos = await Pedido.listar();
    const pagamentos = await Pagamento.listar();
    const totalBrl = pagamentos.reduce((a, p) => a + Number(p.valor_brl || 0), 0);
    const totalUsd = pagamentos.reduce((a, p) => a + Number(p.valor_usd || 0), 0);

    res.render('dashboard/index', {
      title: 'Dashboard',
      pedidos: pedidos.slice(0, 8),
      qtdPedidos: pedidos.length,
      qtdPagamentos: pagamentos.length,
      totalBrl,
      totalUsd,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };
