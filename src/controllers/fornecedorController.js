const Fornecedor = require('../models/Fornecedor');
const { query } = require('../config/db');
const { consultarCnpj } = require('../services/cnpjService');
const {
  onlyDigits,
  isValidCnpj,
  formatCnpj,
  formatCep,
} = require('../utils/format');

function validar(body) {
  const nome = String(body.nome || '').trim();
  if (!nome) {
    return 'Informe o nome do fornecedor.';
  }
  if (nome.length > 200) {
    return 'Nome do fornecedor deve ter no máximo 200 caracteres.';
  }

  const cnpj = onlyDigits(body.cnpj);
  if (cnpj && !isValidCnpj(cnpj)) {
    return 'CNPJ inválido. Confira os dígitos ou deixe em branco (fornecedor exterior).';
  }

  const email = String(body.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'E-mail inválido.';
  }

  const uf = String(body.uf || '').trim().toUpperCase();
  if (uf && !/^[A-Z]{2}$/.test(uf)) {
    return 'UF deve ter 2 letras (ex.: SP).';
  }

  const cep = onlyDigits(body.cep);
  if (cep && cep.length !== 8) {
    return 'CEP deve ter 8 dígitos ou ficar em branco.';
  }

  return null;
}

function dadosDoBody(body) {
  const cnpj = onlyDigits(body.cnpj);
  const cep = onlyDigits(body.cep);
  const uf = String(body.uf || '').trim().toUpperCase();

  return {
    nome: String(body.nome || '').trim(),
    cnpj: cnpj || null,
    razao_social: String(body.razao_social || '').trim() || null,
    nome_fantasia: String(body.nome_fantasia || '').trim() || null,
    inscricao_estadual: String(body.inscricao_estadual || '').trim() || null,
    pais: String(body.pais || '').trim() || null,
    email: String(body.email || '').trim().toLowerCase() || null,
    telefone: String(body.telefone || '').trim() || null,
    contato: String(body.contato || '').trim() || null,
    cep: cep || null,
    logradouro: String(body.logradouro || '').trim() || null,
    numero: String(body.numero || '').trim() || null,
    complemento: String(body.complemento || '').trim() || null,
    bairro: String(body.bairro || '').trim() || null,
    cidade: String(body.cidade || '').trim() || null,
    uf: uf || null,
    observacao: String(body.observacao || '').trim() || null,
    ativo: body.ativo === 'on' || body.ativo === true || body.ativo === 'true',
  };
}

function erroUnico(err) {
  if (err.code !== '23505') return null;
  const detail = String(err.detail || err.constraint || '');
  if (detail.toLowerCase().includes('cnpj')) {
    return 'Já existe um fornecedor com esse CNPJ.';
  }
  return 'Já existe um fornecedor com esse nome.';
}

async function listar(req, res, next) {
  try {
    const fornecedores = await Fornecedor.listar();
    res.render('fornecedores/index', {
      title: 'Fornecedores',
      fornecedores,
      formatCnpj,
    });
  } catch (err) {
    next(err);
  }
}

async function formNovo(req, res, next) {
  try {
    res.render('fornecedores/form', {
      title: 'Novo fornecedor',
      fornecedor: null,
      error: null,
      formatCnpj,
      formatCep,
    });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const erro = validar(req.body);
    if (erro) {
      return res.status(400).render('fornecedores/form', {
        title: 'Novo fornecedor',
        fornecedor: req.body,
        error: erro,
        formatCnpj,
        formatCep,
      });
    }

    await Fornecedor.criar(dadosDoBody(req.body));
    res.redirect('/fornecedores');
  } catch (err) {
    const msg = erroUnico(err);
    if (msg) {
      return res.status(400).render('fornecedores/form', {
        title: 'Novo fornecedor',
        fornecedor: req.body,
        error: msg,
        formatCnpj,
        formatCep,
      });
    }
    next(err);
  }
}

async function formEditar(req, res, next) {
  try {
    const fornecedor = await Fornecedor.findById(req.params.id);
    if (!fornecedor) {
      return res.status(404).render('errors/404', {
        title: 'Fornecedor não encontrado',
        message: 'Não há fornecedor com esse ID. Abra a lista e escolha um existente.',
        pathTried: req.originalUrl,
      });
    }
    res.render('fornecedores/form', {
      title: `Editar ${fornecedor.nome}`,
      fornecedor,
      error: null,
      formatCnpj,
      formatCep,
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const erro = validar(req.body);
    if (erro) {
      return res.status(400).render('fornecedores/form', {
        title: 'Editar fornecedor',
        fornecedor: { ...req.body, id: req.params.id },
        error: erro,
        formatCnpj,
        formatCep,
      });
    }

    const dados = dadosDoBody(req.body);
    const atualizado = await Fornecedor.atualizar(req.params.id, dados);
    if (!atualizado) {
      return res.status(404).render('errors/404', {
        title: 'Fornecedor não encontrado',
        message: 'Não há fornecedor com esse ID.',
        pathTried: req.originalUrl,
      });
    }

    await query(
      `UPDATE pedidos SET fornecedor = $2, updated_at = NOW()
       WHERE fornecedor_id = $1`,
      [req.params.id, dados.nome]
    );

    res.redirect('/fornecedores');
  } catch (err) {
    const msg = erroUnico(err);
    if (msg) {
      return res.status(400).render('fornecedores/form', {
        title: 'Editar fornecedor',
        fornecedor: { ...req.body, id: req.params.id },
        error: msg,
        formatCnpj,
        formatCep,
      });
    }
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    const emUso = await query(
      'SELECT COUNT(*)::int AS n FROM pedidos WHERE fornecedor_id = $1',
      [req.params.id]
    );
    if (emUso.rows[0].n > 0) {
      const fornecedores = await Fornecedor.listar();
      return res.status(400).render('fornecedores/index', {
        title: 'Fornecedores',
        fornecedores,
        error: 'Não é possível excluir: há pedidos vinculados a este fornecedor. Desative-o em vez de excluir.',
        formatCnpj,
      });
    }
    await Fornecedor.remover(req.params.id);
    res.redirect('/fornecedores');
  } catch (err) {
    next(err);
  }
}

async function apiCnpj(req, res) {
  const cnpj = onlyDigits(req.params.cnpj);
  if (cnpj.length !== 14) {
    return res.status(400).json({ ok: false, error: 'Informe um CNPJ com 14 dígitos.' });
  }

  const existente = await Fornecedor.findByCnpj(cnpj);
  const result = await consultarCnpj(cnpj);
  if (!result.ok) {
    return res.status(result.error.includes('não encontrado') ? 404 : 400).json(result);
  }

  return res.json({
    ok: true,
    data: result.data,
    cached: result.cached,
    jaCadastrado: existente
      ? { id: existente.id, nome: existente.nome }
      : null,
  });
}

module.exports = {
  listar,
  formNovo,
  criar,
  formEditar,
  atualizar,
  remover,
  apiCnpj,
};
