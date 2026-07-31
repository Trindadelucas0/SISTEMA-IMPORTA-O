const Produto = require('../models/Produto');
const { parseNumber } = require('../utils/format');

function validar(body) {
  const codigo_interno = String(body.codigo_interno || '').trim();
  const nome = String(body.nome || '').trim();

  if (!nome) {
    return 'Informe o nome do produto.';
  }
  if (!/^\d{10,15}$/.test(codigo_interno)) {
    return 'Código interno deve ter entre 10 e 15 dígitos numéricos.';
  }
  return null;
}

async function listar(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const page = Number(req.query.page) || 1;
    const pageSize = 15;

    const [resultado, sugestoes] = await Promise.all([
      Produto.listarPaginado({ q, page, pageSize }),
      Produto.listarSugestoes(),
    ]);

    res.render('produtos/index', {
      title: 'Produtos',
      produtos: resultado.rows,
      q,
      page: resultado.page,
      pageSize: resultado.pageSize,
      total: resultado.total,
      totalPages: resultado.totalPages,
      sugestoes,
    });
  } catch (err) {
    next(err);
  }
}

async function formNovo(req, res, next) {
  try {
    res.render('produtos/form', {
      title: 'Novo produto',
      produto: null,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const erro = validar(req.body);
    if (erro) {
      return res.status(400).render('produtos/form', {
        title: 'Novo produto',
        produto: req.body,
        error: erro,
      });
    }

    await Produto.criar({
      codigo_interno: String(req.body.codigo_interno).trim(),
      nome: String(req.body.nome).trim(),
      ncm: req.body.ncm,
      preco_usd: parseNumber(req.body.preco_usd),
      ativo: req.body.ativo === 'on',
    });
    res.redirect('/produtos');
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).render('produtos/form', {
        title: 'Novo produto',
        produto: req.body,
        error: 'Já existe um produto com esse código interno.',
      });
    }
    next(err);
  }
}

async function formEditar(req, res, next) {
  try {
    const produto = await Produto.findById(req.params.id);
    if (!produto) {
      return res.status(404).render('errors/404', {
        title: 'Produto não encontrado',
        message: 'Não há produto com esse ID. Abra a lista de produtos e escolha um existente.',
        pathTried: req.originalUrl,
      });
    }
    res.render('produtos/form', {
      title: `Editar ${produto.nome}`,
      produto,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const erro = validar(req.body);
    if (erro) {
      return res.status(400).render('produtos/form', {
        title: 'Editar produto',
        produto: { ...req.body, id: req.params.id },
        error: erro,
      });
    }

    await Produto.atualizar(req.params.id, {
      codigo_interno: String(req.body.codigo_interno).trim(),
      nome: String(req.body.nome).trim(),
      ncm: req.body.ncm,
      preco_usd: parseNumber(req.body.preco_usd),
      ativo: req.body.ativo === 'on',
    });
    res.redirect('/produtos');
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).render('produtos/form', {
        title: 'Editar produto',
        produto: { ...req.body, id: req.params.id },
        error: 'Já existe um produto com esse código interno.',
      });
    }
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await Produto.remover(req.params.id);
    res.redirect('/produtos');
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
