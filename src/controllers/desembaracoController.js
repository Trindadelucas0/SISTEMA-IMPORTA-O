const Pedido = require('../models/Pedido');
const ItemPedido = require('../models/ItemPedido');
const Desembaraco = require('../models/Desembaraco');
const saldoService = require('../services/saldoService');
const { calcularPedido } = require('../services/desembaracoCalc');
const { parseNumber } = require('../utils/format');
const { buildCustoUnitarioWorkbook } = require('../services/desembaracoExport');

function buildCustoDelta(desembaraco) {
  if (desembaraco?.custo_total_atual == null || desembaraco?.custo_total_anterior == null) {
    return null;
  }
  const atual = Number(desembaraco.custo_total_atual);
  const anterior = Number(desembaraco.custo_total_anterior);
  return {
    atual,
    anterior,
    delta: atual - anterior,
    aumentou: atual > anterior,
    diminuiu: atual < anterior,
  };
}

function notFoundPedido(req, res) {
  return res.status(404).render('errors/404', {
    title: 'Pedido não encontrado',
    message: 'Não há pedido com esse ID para desembaraço.',
    pathTried: req.originalUrl,
  });
}

async function carregarContextoDesembaraco(pedidoId) {
  const pedido = await Pedido.findById(pedidoId);
  if (!pedido) return null;

  const desembaraco = await Desembaraco.ensureForPedido(pedido.id);
  const itens = await ItemPedido.findByPedido(pedido.id);
  const saldo = await saldoService.saldoPedido(pedido.id);
  const alocacoes = await saldoService.alocacoesComCambio(pedido.id);
  const custoProdutoBrl = saldoService.custoProdutoBrlFromAlocacoes(alocacoes);

  const { linhas, totais, contexto } = calcularPedido(itens, desembaraco, {
    coberto: saldo.coberto,
    custoProdutoBrl,
  });

  const invoice = Number(saldo.invoice_usd) || 0;
  const alocado = Number(saldo.alocado_usd) || 0;
  const coberturaPct =
    invoice > 0
      ? Math.min(100, Math.round((alocado / invoice) * 1000) / 10)
      : saldo.coberto
        ? 100
        : 0;

  return {
    pedido,
    desembaraco,
    linhas,
    totais,
    contexto,
    saldo,
    alocacoes,
    custoProdutoBrl,
    custoDelta: buildCustoDelta(desembaraco),
    coberturaPct,
  };
}

async function show(req, res, next) {
  try {
    const ctx = await carregarContextoDesembaraco(req.params.pedidoId);
    if (!ctx) return notFoundPedido(req, res);

    res.render('desembaraco/show', {
      title: `Compras ${ctx.pedido.codigo}`,
      ...ctx,
      saved: req.query.saved === '1',
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function relatorio(req, res, next) {
  try {
    const ctx = await carregarContextoDesembaraco(req.params.pedidoId);
    if (!ctx) return notFoundPedido(req, res);

    res.render('desembaraco/relatorio', {
      title: `Relatório de Custo Unitário ${ctx.pedido.codigo}`,
      ...ctx,
      autoPrint: req.query.autoPrint === '1',
      geradoEm: new Date(),
    });
  } catch (err) {
    next(err);
  }
}

async function excel(req, res, next) {
  try {
    const ctx = await carregarContextoDesembaraco(req.params.pedidoId);
    if (!ctx) return notFoundPedido(req, res);

    const buffer = await buildCustoUnitarioWorkbook({
      ...ctx,
      geradoEm: new Date(),
    });

    const safeCodigo = String(ctx.pedido.codigo || 'pedido')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 60);
    const filename = `custo-unitario-${safeCodigo}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function salvar(req, res, next) {
  try {
    const pedido = await Pedido.findById(req.params.pedidoId);
    if (!pedido) return notFoundPedido(req, res);

    const saldo = await saldoService.saldoPedido(pedido.id);
    if (!saldo.coberto) {
      return res.redirect(`/desembaraco/${pedido.id}?saved=0`);
    }

    let desembaraco = await Desembaraco.atualizarCabecalho(pedido.id, {
      custo_desembaraco_total: parseNumber(req.body.custo_desembaraco_total),
      divisor_bc_icms: parseNumber(req.body.divisor_bc_icms || 0.94),
    });

    const itensBases = [];
    for (const [key, valor] of Object.entries(req.body)) {
      const match = /^base_(\d+)$/.exec(key);
      if (!match) continue;
      const itemId = Number(match[1]);
      if (!Number.isInteger(itemId) || itemId <= 0) continue;
      itensBases.push({
        item_pedido_id: itemId,
        base_desembaraco: parseNumber(valor),
      });
    }

    await Desembaraco.syncItens(desembaraco.id, itensBases);

    const itens = await ItemPedido.findByPedido(pedido.id);
    const alocacoes = await saldoService.alocacoesComCambio(pedido.id);
    const custoProdutoBrl = saldoService.custoProdutoBrlFromAlocacoes(alocacoes);
    desembaraco = await Desembaraco.findByPedido(pedido.id);

    const { linhas } = calcularPedido(itens, desembaraco, {
      coberto: true,
      custoProdutoBrl,
    });

    const custoTotal = linhas.reduce(
      (acc, linha) =>
        acc + (Number(linha.total_custo_unit) || 0) * (Number(linha.quantidade) || 0),
      0
    );
    await Desembaraco.salvarSnapshotCusto(pedido.id, custoTotal);

    res.redirect(`/desembaraco/${pedido.id}?saved=1`);
  } catch (err) {
    next(err);
  }
}

async function listarPedidos(req, res, next) {
  try {
    const pedidos = await Pedido.listar();
    res.render('desembaraco/index', {
      title: 'Compras',
      pedidos,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  show,
  relatorio,
  excel,
  salvar,
  listarPedidos,
};
