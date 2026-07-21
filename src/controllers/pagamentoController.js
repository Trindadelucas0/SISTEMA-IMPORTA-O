const Pagamento = require('../models/Pagamento');
const saldoService = require('../services/saldoService');
const { parseNumber } = require('../utils/format');

async function listar(req, res, next) {
  try {
    const pagamentos = await Pagamento.listar();
    const saldo = await saldoService.resumoSaldo();

    res.render('pagamentos/index', {
      title: 'Pagamentos',
      pagamentos,
      saldo: saldo || {
        total_usd: 0,
        total_brl: 0,
        alocado_usd: 0,
        alocado_brl: 0,
        disponivel_usd: 0,
        disponivel_brl: 0,
      },
      tipos: Pagamento.tipos,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function formNovo(req, res, next) {
  try {
    res.render('pagamentos/form', {
      title: 'Novo pagamento',
      pagamento: {
        data_pagamento: new Date().toISOString().slice(0, 10),
        tipo: 'fornecedor',
        dolar_dia: '',
      },
      tipos: Pagamento.tipos,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const descricao = String(req.body.descricao || '').trim();
    if (!descricao || !req.body.data_pagamento) {
      return res.status(400).render('pagamentos/form', {
        title: 'Novo pagamento',
        pagamento: req.body,
        tipos: Pagamento.tipos,
        error: 'Informe data e descrição.',
      });
    }

    await Pagamento.criar({
      data_pagamento: req.body.data_pagamento,
      descricao,
      valor_brl: parseNumber(req.body.valor_brl),
      valor_usd: parseNumber(req.body.valor_usd),
      dolar_dia: parseNumber(req.body.dolar_dia),
      tipo: req.body.tipo || 'fornecedor',
    });

    res.redirect('/pagamentos');
  } catch (err) {
    next(err);
  }
}

async function formEditar(req, res, next) {
  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) {
      return res.status(404).render('errors/404', {
        title: 'Pagamento não encontrado',
        message: 'Esse pagamento não existe ou foi excluído.',
        pathTried: req.originalUrl,
      });
    }
    res.render('pagamentos/form', {
      title: 'Editar pagamento',
      pagamento: {
        ...pagamento,
        data_pagamento: pagamento.data_pagamento
          ? new Date(pagamento.data_pagamento).toISOString().slice(0, 10)
          : '',
      },
      tipos: Pagamento.tipos,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const descricao = String(req.body.descricao || '').trim();
    if (!descricao || !req.body.data_pagamento) {
      return res.status(400).render('pagamentos/form', {
        title: 'Editar pagamento',
        pagamento: { ...req.body, id: req.params.id },
        tipos: Pagamento.tipos,
        error: 'Informe data e descrição.',
      });
    }

    await Pagamento.atualizar(req.params.id, {
      data_pagamento: req.body.data_pagamento,
      descricao,
      valor_brl: parseNumber(req.body.valor_brl),
      valor_usd: parseNumber(req.body.valor_usd),
      dolar_dia: parseNumber(req.body.dolar_dia),
      tipo: req.body.tipo || 'fornecedor',
    });

    res.redirect('/pagamentos');
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await Pagamento.remover(req.params.id);
    res.redirect('/pagamentos');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  formNovo,
  criar,
  formEditar,
  atualizar,
  remover,
};
