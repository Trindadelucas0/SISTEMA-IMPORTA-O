const Pedido = require('../models/Pedido');
const ItemPedido = require('../models/ItemPedido');
const Desembaraco = require('../models/Desembaraco');
const Produto = require('../models/Produto');
const Fornecedor = require('../models/Fornecedor');
const saldoService = require('../services/saldoService');
const {
  parseNumber,
  toDateInputValue,
  addDaysIso,
  STATUS_PEDIDO,
  isPedidoAberto,
} = require('../utils/format');

const STATUS = STATUS_PEDIDO;
const DIAS_PREVISTA_CHEGADA = 90;

function statusValido(raw) {
  const status = String(raw || '').trim();
  return STATUS.includes(status) ? status : null;
}

function wantsJson(req) {
  return req.accepts(['json', 'html']) === 'json';
}

function itemPayload(item) {
  const quantidade = Number(item.quantidade) || 0;
  const preco_usd = Number(item.preco_usd) || 0;
  return {
    id: item.id,
    pedido_id: item.pedido_id,
    referencia: item.referencia,
    descricao: item.descricao || null,
    quantidade,
    preco_usd,
    ncm: item.ncm || null,
    amount_usd: ItemPedido.amountUsd(item),
  };
}

async function respostaItensJson(res, pedidoId, item) {
  const saldo = await saldoService.saldoPedido(pedidoId);
  const itens = await ItemPedido.findByPedido(pedidoId);
  return res.json({
    ok: true,
    item: item ? itemPayload(item) : null,
    saldo,
    qtdItens: itens.length,
  });
}

function datasFabricacaoDoBody(body) {
  const data_inicio_fabricacao = toDateInputValue(body.data_inicio_fabricacao) || null;
  const data_prevista_chegada = data_inicio_fabricacao
    ? addDaysIso(data_inicio_fabricacao, DIAS_PREVISTA_CHEGADA)
    : null;
  return { data_inicio_fabricacao, data_prevista_chegada };
}

function pedidoParaForm(pedido) {
  if (!pedido) return null;
  return {
    ...pedido,
    data_inicio_fabricacao: toDateInputValue(pedido.data_inicio_fabricacao),
    data_prevista_chegada: toDateInputValue(pedido.data_prevista_chegada),
  };
}

async function resolverFornecedor(body, { permitirInativo = false } = {}) {
  const fornecedor_id = Number(body.fornecedor_id);
  if (!Number.isFinite(fornecedor_id) || fornecedor_id <= 0) {
    return { error: 'Selecione um fornecedor cadastrado.' };
  }
  const fornecedor = await Fornecedor.findById(fornecedor_id);
  if (!fornecedor) {
    return { error: 'Fornecedor não encontrado. Cadastre ou escolha outro.' };
  }
  if (!fornecedor.ativo && !permitirInativo) {
    return { error: 'Este fornecedor está inativo. Escolha outro ou reative-o.' };
  }
  return {
    fornecedor_id: fornecedor.id,
    fornecedor: fornecedor.nome,
  };
}

async function fornecedoresParaForm(pedido) {
  const ativos = await Fornecedor.listarAtivos();
  if (!pedido?.fornecedor_id) return ativos;
  const jaIncluido = ativos.some((f) => Number(f.id) === Number(pedido.fornecedor_id));
  if (jaIncluido) return ativos;
  const atual = await Fornecedor.findById(pedido.fornecedor_id);
  if (atual) return [atual, ...ativos];
  return ativos;
}

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
        fornecedor: p.fornecedor_nome || p.fornecedor,
        invoice_usd: invoice,
        alocado_usd: alocado,
        falta_usd: falta,
        pct,
        coberto: !!s.coberto,
        status_fornecedor: s.status_fornecedor,
      });
    }
    const pedidosAbertos = pedidosComSaldo.filter((p) => isPedidoAberto(p.status));

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
    const fornecedores = await Fornecedor.listarAtivos();
    res.render('pedidos/form', {
      title: 'Novo pedido',
      pedido: null,
      fornecedores,
      statusList: STATUS,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const fornecedores = await Fornecedor.listarAtivos();
    const codigo = String(req.body.codigo || '').trim().toUpperCase();
    if (!codigo) {
      return res.status(400).render('pedidos/form', {
        title: 'Novo pedido',
        pedido: pedidoParaForm(req.body),
        fornecedores,
        statusList: STATUS,
        error: 'Informe o código do pedido (ex: A23).',
      });
    }

    const statusRaw = req.body.status;
    const statusParsed = statusValido(statusRaw);
    if (statusRaw && !statusParsed) {
      return res.status(400).render('pedidos/form', {
        title: 'Novo pedido',
        pedido: pedidoParaForm(req.body),
        fornecedores,
        statusList: STATUS,
        error: 'Status inválido. Use Aberta, Em Trânsito ou Embarcada.',
      });
    }
    const status =
      req.user?.role === 'admin'
        ? statusParsed || 'aberta'
        : 'aberta';

    const forn = await resolverFornecedor(req.body);
    if (forn.error) {
      return res.status(400).render('pedidos/form', {
        title: 'Novo pedido',
        pedido: pedidoParaForm(req.body),
        fornecedores,
        statusList: STATUS,
        error: forn.error,
      });
    }

    const pedido = await Pedido.criar({
      codigo,
      fornecedor: forn.fornecedor,
      fornecedor_id: forn.fornecedor_id,
      status,
      observacao: req.body.observacao,
      ...datasFabricacaoDoBody(req.body),
    });
    res.redirect(`/pedidos/${pedido.id}`);
  } catch (err) {
    if (err.code === '23505') {
      const fornecedores = await Fornecedor.listarAtivos();
      return res.status(400).render('pedidos/form', {
        title: 'Novo pedido',
        pedido: pedidoParaForm(req.body),
        fornecedores,
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
    const produtos = await Produto.listarAtivos();

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
      pedido: {
        ...pedido,
        fornecedor: pedido.fornecedor_nome || pedido.fornecedor,
      },
      itens: itensComAmount,
      totalUsd,
      saldo,
      alocacoes,
      desembaraco,
      custoDelta,
      produtos,
      statusList: STATUS,
      statusOk: req.query.ok === 'status',
      statusErro: req.query.erro === 'status',
      itemErro: req.query.erro === 'item' || req.query.erro === 'item_coberto' ? req.query.erro : null,
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
    const fornecedores = await fornecedoresParaForm(pedido);
    res.render('pedidos/form', {
      title: `Editar ${pedido.codigo}`,
      pedido: pedidoParaForm(pedido),
      fornecedores,
      statusList: STATUS,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const pedidoAtual = await Pedido.findById(req.params.id);
    const formPedido = pedidoParaForm({
      ...req.body,
      id: req.params.id,
      fornecedor_id: req.body.fornecedor_id || pedidoAtual?.fornecedor_id,
    });
    const fornecedores = await fornecedoresParaForm(formPedido);

    const codigo = String(req.body.codigo || '').trim().toUpperCase();
    if (!codigo) {
      return res.status(400).render('pedidos/form', {
        title: 'Editar pedido',
        pedido: formPedido,
        fornecedores,
        statusList: STATUS,
        error: 'Informe o código do pedido.',
      });
    }

    let status = statusValido(req.body.status);
    if (req.user?.role !== 'admin') {
      status = statusValido(pedidoAtual?.status) || 'aberta';
    } else if (!status) {
      return res.status(400).render('pedidos/form', {
        title: 'Editar pedido',
        pedido: formPedido,
        fornecedores,
        statusList: STATUS,
        error: 'Status inválido. Use Aberta, Em Trânsito ou Embarcada.',
      });
    }

    const mesmoVinculo =
      pedidoAtual &&
      Number(pedidoAtual.fornecedor_id) === Number(req.body.fornecedor_id);
    const forn = await resolverFornecedor(req.body, { permitirInativo: !!mesmoVinculo });
    if (forn.error) {
      return res.status(400).render('pedidos/form', {
        title: 'Editar pedido',
        pedido: formPedido,
        fornecedores,
        statusList: STATUS,
        error: forn.error,
      });
    }

    await Pedido.atualizar(req.params.id, {
      codigo,
      fornecedor: forn.fornecedor,
      fornecedor_id: forn.fornecedor_id,
      status,
      observacao: req.body.observacao,
      ...datasFabricacaoDoBody(req.body),
    });
    res.redirect(`/pedidos/${req.params.id}`);
  } catch (err) {
    next(err);
  }
}

function safeReturnTo(raw, fallback) {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  return value;
}

async function atualizarStatus(req, res, next) {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).render('errors/404', {
        title: 'Pedido não encontrado',
        message: 'Não há pedido com esse ID. Abra a lista de pedidos e escolha um existente.',
        pathTried: req.originalUrl,
      });
    }

    const fallback = `/pedidos/${pedido.id}`;
    const status = statusValido(req.body.status);
    if (!status) {
      return res.redirect(`${fallback}?erro=status`);
    }

    await Pedido.atualizarStatus(pedido.id, status);

    let refererPath = '';
    try {
      if (req.get('Referer')) {
        refererPath = new URL(req.get('Referer')).pathname + (new URL(req.get('Referer')).search || '');
      }
    } catch (_) {
      refererPath = '';
    }

    const destino = safeReturnTo(req.body.returnTo, safeReturnTo(refererPath, fallback));
    const sep = destino.includes('?') ? '&' : '?';
    res.redirect(`${destino}${sep}ok=status`);
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
    const json = wantsJson(req);
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      if (json) {
        return res.status(404).json({ ok: false, erro: 'Pedido não encontrado.' });
      }
      return res.status(404).render('errors/404', {
        title: 'Pedido não encontrado',
        message: 'Não há pedido com esse ID. Abra a lista de pedidos e escolha um existente.',
        pathTried: req.originalUrl,
      });
    }

    const body = req.body || {};
    const referencia = String(body.referencia || '').trim();
    if (!referencia) {
      if (json) {
        return res.status(400).json({ ok: false, erro: 'Informe a REF do item.' });
      }
      return res.redirect(`/pedidos/${pedido.id}?erro=item`);
    }

    const item = await ItemPedido.criar(pedido.id, {
      referencia,
      descricao: body.descricao,
      quantidade: parseNumber(body.quantidade),
      preco_usd: parseNumber(body.preco_usd),
      ncm: body.ncm,
      aliq_ii: parseNumber(body.aliq_ii || 0.2),
      aliq_ipi: parseNumber(body.aliq_ipi || 0),
      aliq_pis: parseNumber(body.aliq_pis || 0.021),
      aliq_cofins: parseNumber(body.aliq_cofins || 0.1025),
      aliq_icms: parseNumber(body.aliq_icms || 0.04),
      ordem: parseNumber(body.ordem),
    });

    if (json) {
      return respostaItensJson(res, pedido.id, item);
    }
    res.redirect(`/pedidos/${pedido.id}`);
  } catch (err) {
    next(err);
  }
}

function numeroMudou(atual, novo) {
  return Math.abs((Number(atual) || 0) - (Number(novo) || 0)) > 1e-9;
}

async function atualizarItem(req, res, next) {
  try {
    const json = wantsJson(req);
    const item = await ItemPedido.findById(req.params.itemId);
    if (!item || Number(item.pedido_id) !== Number(req.params.id)) {
      if (json) {
        return res.status(404).json({ ok: false, erro: 'Item não encontrado neste pedido.' });
      }
      return res.status(404).render('errors/404', {
        title: 'Item não encontrado',
        message: 'Esse item não existe mais neste pedido.',
        pathTried: req.originalUrl,
      });
    }

    const body = req.body || {};
    const referencia = String(body.referencia || '').trim();
    if (!referencia) {
      if (json) {
        return res.status(400).json({ ok: false, erro: 'Informe a REF do item.' });
      }
      return res.redirect(`/pedidos/${item.pedido_id}?erro=item`);
    }

    const quantidade = parseNumber(body.quantidade);
    const preco_usd = parseNumber(body.preco_usd);

    const saldo = await saldoService.saldoPedido(item.pedido_id);
    const mudouValor =
      numeroMudou(item.quantidade, quantidade) || numeroMudou(item.preco_usd, preco_usd);
    if (saldo.coberto && mudouValor) {
      const erro = 'Pedido quitado: quantidade e preço não podem mudar.';
      if (json) {
        return res.status(409).json({ ok: false, erro, codigo: 'ITEM_COBERTO' });
      }
      return res.redirect(`/pedidos/${item.pedido_id}?erro=item_coberto`);
    }

    const atualizado = await ItemPedido.atualizar(item.id, {
      referencia,
      descricao: body.descricao,
      quantidade,
      preco_usd,
      ncm: body.ncm,
      aliq_ii: item.aliq_ii,
      aliq_ipi: item.aliq_ipi,
      aliq_pis: item.aliq_pis,
      aliq_cofins: item.aliq_cofins,
      aliq_icms: item.aliq_icms,
      ordem: item.ordem,
    });

    if (json) {
      return respostaItensJson(res, item.pedido_id, atualizado);
    }
    res.redirect(`/pedidos/${item.pedido_id}`);
  } catch (err) {
    next(err);
  }
}

async function listaFornecedor(req, res, next) {
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
    const linhas = itens.map((item) => ({
      referencia: item.referencia,
      descricao: item.descricao || null,
      quantidade: Number(item.quantidade) || 0,
    }));
    const totalPecas = linhas.reduce((acc, l) => acc + l.quantidade, 0);

    res.render('pedidos/lista-fornecedor', {
      title: `Lista para fornecedor ${pedido.codigo}`,
      pedido: {
        id: pedido.id,
        codigo: pedido.codigo,
        status: pedido.status,
        fornecedor: pedido.fornecedor_nome || pedido.fornecedor,
        data_inicio_fabricacao: pedido.data_inicio_fabricacao,
        data_prevista_chegada: pedido.data_prevista_chegada,
      },
      itens: linhas,
      totalPecas,
      autoPrint: req.query.autoPrint === '1',
      geradoEm: new Date(),
    });
  } catch (err) {
    next(err);
  }
}

async function removerItem(req, res, next) {
  try {
    const json = wantsJson(req);
    const item = await ItemPedido.findById(req.params.itemId);
    if (!item) {
      if (json) {
        return res.status(404).json({ ok: false, erro: 'Item não encontrado.' });
      }
      return res.status(404).render('errors/404', {
        title: 'Item não encontrado',
        message: 'Esse item não existe mais neste pedido.',
        pathTried: req.originalUrl,
      });
    }
    const pedidoId = item.pedido_id;
    await ItemPedido.remover(item.id);
    if (json) {
      return respostaItensJson(res, pedidoId, item);
    }
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
  atualizarStatus,
  remover,
  adicionarItem,
  atualizarItem,
  removerItem,
  listaFornecedor,
};
