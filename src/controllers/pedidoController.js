const Pedido = require('../models/Pedido');
const ItemPedido = require('../models/ItemPedido');
const Desembaraco = require('../models/Desembaraco');
const saldoService = require('../services/saldoService');
const { parseNumber } = require('../utils/format');

const STATUS = ['aberta', 'em_transito', 'desembarcada', 'fechada'];

async function listar(req, res, next) {
  try {
    const pedidos = await Pedido.listar();
    const pedidosComSaldo = [];
    for (const p of pedidos) {
      const s = await saldoService.saldoPedido(p.id);
      const invoice = Number(s.invoice_usd) || 0;
      const alocado = Number(s.alocado_usd) || 0;
      const falta = Number(s.falta_usd) || 0;
      const pct = invoice > 0
        ? Math.min(100, Math.round((alocado / invoice) * 1000) / 10)
        : s.coberto ? 100 : 0;
      pedidosComSaldo.push({
        ...p,
        invoice_usd: invoice,
        alocado_usd: alocado,
        falta_usd: falta,
        pct,
        coberto: !!s.coberto,
        status_fornecedor: s.status_fornecedor,
      });
    }
    const pedidosAbertos = pedidosComSaldo.filter((p) => p.status !== 'fechada');

    res.render('pedidos/index', {
      title: 'Pedidos',
      pedidos: pedidosComSaldo,
      pedidosAbertos,
    });
  } catch (err) {
    next(err);
  }
}

async function formNovo(req, res, next) {
  try {
    res.render('pedidos/form', {
      title: 'Novo pedido',
      pedido: null,
      statusList: STATUS,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const codigo = String(req.body.codigo || '').trim().toUpperCase();
    if (!codigo) {
      return res.status(400).render('pedidos/form', {
        title: 'Novo pedido',
        pedido: req.body,
        statusList: STATUS,
        error: 'Informe o código do pedido (ex: A23).',
      });
    }

    const pedido = await Pedido.criar({
      codigo,
      fornecedor: req.body.fornecedor,
      status: req.body.status,
      observacao: req.body.observacao,
    });
    res.redirect(`/pedidos/${pedido.id}`);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).render('pedidos/form', {
        title: 'Novo pedido',
        pedido: req.body,
        statusList: STATUS,
        error: 'Já existe um pedido com esse código.',
      });
    }
    next(err);
  }
}

async function detalhe(req, res, next) {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).render('errors/404', {
        title: 'Pedido não encontrado',
        message: 'Não há pedido com esse ID. Abra a lista de pedidos e escolha um existente.',
        pathTried: req.originalUrl,
      });
    }

    const itens = await ItemPedido.findByPedido(pedido.id);
    const itensComAmount = itens.map((item) => ({
      ...item,
      amount_usd: ItemPedido.amountUsd(item),
    }));
    const totalUsd = itensComAmount.reduce((acc, i) => acc + i.amount_usd, 0);
    const saldo = await saldoService.saldoPedido(pedido.id);
    const alocacoes = await saldoService.alocacoesComCambio(pedido.id);
    const desembaraco = await Desembaraco.findByPedido(pedido.id);

    let custoDelta = null;
    if (desembaraco?.custo_total_atual != null && desembaraco?.custo_total_anterior != null) {
      const atual = Number(desembaraco.custo_total_atual);
      const anterior = Number(desembaraco.custo_total_anterior);
      custoDelta = {
        atual,
        anterior,
        delta: atual - anterior,
        aumentou: atual > anterior,
        diminuiu: atual < anterior,
      };
    }

    res.render('pedidos/show', {
      title: `Pedido ${pedido.codigo}`,
      pedido,
      itens: itensComAmount,
      totalUsd,
      saldo,
      alocacoes,
      desembaraco,
      custoDelta,
      statusList: STATUS,
    });
  } catch (err) {
    next(err);
  }
}

async function formEditar(req, res, next) {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).render('errors/404', {
        title: 'Pedido não encontrado',
        message: 'Não há pedido com esse ID. Abra a lista de pedidos e escolha um existente.',
        pathTried: req.originalUrl,
      });
    }
    res.render('pedidos/form', {
      title: `Editar ${pedido.codigo}`,
      pedido,
      statusList: STATUS,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const codigo = String(req.body.codigo || '').trim().toUpperCase();
    if (!codigo) {
      return res.status(400).render('pedidos/form', {
        title: 'Editar pedido',
        pedido: { ...req.body, id: req.params.id },
        statusList: STATUS,
        error: 'Informe o código do pedido.',
      });
    }

    await Pedido.atualizar(req.params.id, {
      codigo,
      fornecedor: req.body.fornecedor,
      status: req.body.status,
      observacao: req.body.observacao,
    });
    res.redirect(`/pedidos/${req.params.id}`);
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await Pedido.remover(req.params.id);
    res.redirect('/pedidos');
  } catch (err) {
    next(err);
  }
}

async function adicionarItem(req, res, next) {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).render('errors/404', {
        title: 'Pedido não encontrado',
        message: 'Não há pedido com esse ID. Abra a lista de pedidos e escolha um existente.',
        pathTried: req.originalUrl,
      });
    }

    const referencia = String(req.body.referencia || '').trim();
    if (!referencia) {
      return res.redirect(`/pedidos/${pedido.id}?erro=item`);
    }

    await ItemPedido.criar(pedido.id, {
      referencia,
      descricao: req.body.descricao,
      quantidade: parseNumber(req.body.quantidade),
      preco_usd: parseNumber(req.body.preco_usd),
      ncm: req.body.ncm,
      aliq_ii: parseNumber(req.body.aliq_ii || 0.2),
      aliq_ipi: parseNumber(req.body.aliq_ipi || 0),
      aliq_pis: parseNumber(req.body.aliq_pis || 0.021),
      aliq_cofins: parseNumber(req.body.aliq_cofins || 0.1025),
      aliq_icms: parseNumber(req.body.aliq_icms || 0.04),
      ordem: parseNumber(req.body.ordem),
    });

    res.redirect(`/pedidos/${pedido.id}`);
  } catch (err) {
    next(err);
  }
}

async function atualizarItem(req, res, next) {
  try {
    const item = await ItemPedido.findById(req.params.itemId);
    if (!item) {
      return res.status(404).render('errors/404', {
        title: 'Item não encontrado',
        message: 'Esse item não existe mais neste pedido.',
        pathTried: req.originalUrl,
      });
    }

    await ItemPedido.atualizar(item.id, {
      referencia: String(req.body.referencia || '').trim(),
      descricao: req.body.descricao,
      quantidade: parseNumber(req.body.quantidade),
      preco_usd: parseNumber(req.body.preco_usd),
      ncm: req.body.ncm,
      aliq_ii: parseNumber(req.body.aliq_ii),
      aliq_ipi: parseNumber(req.body.aliq_ipi),
      aliq_pis: parseNumber(req.body.aliq_pis),
      aliq_cofins: parseNumber(req.body.aliq_cofins),
      aliq_icms: parseNumber(req.body.aliq_icms),
      ordem: parseNumber(req.body.ordem),
    });

    res.redirect(`/pedidos/${item.pedido_id}`);
  } catch (err) {
    next(err);
  }
}

async function removerItem(req, res, next) {
  try {
    const item = await ItemPedido.findById(req.params.itemId);
    if (!item) {
      return res.status(404).render('errors/404', {
        title: 'Item não encontrado',
        message: 'Esse item não existe mais neste pedido.',
        pathTried: req.originalUrl,
      });
    }
    const pedidoId = item.pedido_id;
    await ItemPedido.remover(item.id);
    res.redirect(`/pedidos/${pedidoId}`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  formNovo,
  criar,
  detalhe,
  formEditar,
  atualizar,
  remover,
  adicionarItem,
  atualizarItem,
  removerItem,
};
