const Pedido = require('../models/Pedido');
const Pagamento = require('../models/Pagamento');
const Alocacao = require('../models/Alocacao');
const saldoService = require('../services/saldoService');
const { parseNumber } = require('../utils/format');

async function index(req, res, next) {
  try {
    const saldo = await saldoService.resumoSaldo();
    const extrato = await saldoService.extrato();
    const pedidos = await Pedido.listar();
    const pagamentos = (await Pagamento.listar()).filter((p) => p.disponivel_usd > 0);
    const alocacoes = await Alocacao.listar();
    const saldosPedidos = [];
    for (const p of pedidos) {
      saldosPedidos.push({
        ...p,
        ...(await saldoService.saldoPedido(p.id)),
      });
    }

    res.render('saldo/index', {
      title: 'Saldo',
      saldo,
      extrato,
      pedidos,
      pagamentos,
      alocacoes,
      saldosPedidos,
      message: req.query.ok || null,
      error: req.query.erro || null,
    });
  } catch (err) {
    next(err);
  }
}

async function alocar(req, res, next) {
  try {
    await saldoService.alocarManual({
      pagamentoId: Number(req.body.pagamento_id),
      pedidoId: Number(req.body.pedido_id),
      valorUsd: parseNumber(req.body.valor_usd),
    });
    res.redirect(`/saldo?ok=${encodeURIComponent('Alocação manual criada')}`);
  } catch (err) {
    res.redirect(`/saldo?erro=${encodeURIComponent(err.message)}`);
  }
}

async function removerAlocacao(req, res, next) {
  try {
    await Alocacao.remover(req.params.id);
    res.redirect(`/saldo?ok=${encodeURIComponent('Alocação removida')}`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  index,
  alocar,
  removerAlocacao,
};
