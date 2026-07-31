const Usuario = require('../models/Usuario');
const {
  MODULOS,
  PRESET_FINANCEIRO,
  normalizarPermissoes,
} = require('../constants/permissoes');

function parsePermissoes(body) {
  const raw = body.permissoes;
  if (!raw) return [];
  if (Array.isArray(raw)) return normalizarPermissoes(raw);
  return normalizarPermissoes([raw]);
}

function listar(req, res, next) {
  Usuario.listar()
    .then((usuarios) => {
      res.render('usuarios/index', {
        title: 'Usuários',
        usuarios,
        message: req.query.ok || null,
        error: req.query.erro || null,
      });
    })
    .catch(next);
}

function formNovo(req, res) {
  res.render('usuarios/form', {
    title: 'Novo usuário',
    usuario: null,
    modulos: MODULOS,
    presetFinanceiro: PRESET_FINANCEIRO,
    error: null,
  });
}

async function criar(req, res, next) {
  try {
    const username = String(req.body.username || '').trim();
    const nome = String(req.body.nome || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role === 'admin' ? 'admin' : 'user';
    const ativo = req.body.ativo !== 'false' && req.body.ativo !== false;
    const permissoes =
      req.body.preset === 'financeiro'
        ? [...PRESET_FINANCEIRO]
        : parsePermissoes(req.body);

    if (!username || !nome || !password) {
      return res.status(400).render('usuarios/form', {
        title: 'Novo usuário',
        usuario: { username, nome, role, permissoes, ativo },
        modulos: MODULOS,
        presetFinanceiro: PRESET_FINANCEIRO,
        error: 'Preencha usuário, nome e senha.',
      });
    }

    if (password.length < 6) {
      return res.status(400).render('usuarios/form', {
        title: 'Novo usuário',
        usuario: { username, nome, role, permissoes, ativo },
        modulos: MODULOS,
        presetFinanceiro: PRESET_FINANCEIRO,
        error: 'A senha deve ter pelo menos 6 caracteres.',
      });
    }

    const existente = await Usuario.findByUsername(username);
    if (existente) {
      return res.status(400).render('usuarios/form', {
        title: 'Novo usuário',
        usuario: { username, nome, role, permissoes, ativo },
        modulos: MODULOS,
        presetFinanceiro: PRESET_FINANCEIRO,
        error: 'Este usuário já existe.',
      });
    }

    await Usuario.criar({ username, password, nome, role, permissoes, ativo });
    return res.redirect('/usuarios?ok=Usuário criado.');
  } catch (err) {
    return next(err);
  }
}

async function formEditar(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      return res.redirect('/usuarios?erro=Usuário não encontrado.');
    }
    res.render('usuarios/form', {
      title: 'Editar usuário',
      usuario,
      modulos: MODULOS,
      presetFinanceiro: PRESET_FINANCEIRO,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const atual = await Usuario.findById(id);
    if (!atual) {
      return res.redirect('/usuarios?erro=Usuário não encontrado.');
    }

    const username = String(req.body.username || '').trim();
    const nome = String(req.body.nome || '').trim();
    const role = req.body.role === 'admin' ? 'admin' : 'user';
    let ativo = req.body.ativo !== 'false' && req.body.ativo !== false;
    const permissoes =
      req.body.preset === 'financeiro'
        ? [...PRESET_FINANCEIRO]
        : parsePermissoes(req.body);

    if (req.user.id === id && !ativo) {
      return res.status(400).render('usuarios/form', {
        title: 'Editar usuário',
        usuario: { ...atual, username, nome, role, permissoes, ativo: true },
        modulos: MODULOS,
        presetFinanceiro: PRESET_FINANCEIRO,
        error: 'Você não pode desativar o próprio usuário.',
      });
    }

    if (req.user.id === id && role !== 'admin') {
      return res.status(400).render('usuarios/form', {
        title: 'Editar usuário',
        usuario: { ...atual, username, nome, role: 'admin', permissoes, ativo },
        modulos: MODULOS,
        presetFinanceiro: PRESET_FINANCEIRO,
        error: 'Você não pode remover o próprio perfil de administrador.',
      });
    }

    if (!username || !nome) {
      return res.status(400).render('usuarios/form', {
        title: 'Editar usuário',
        usuario: { ...atual, username, nome, role, permissoes, ativo },
        modulos: MODULOS,
        presetFinanceiro: PRESET_FINANCEIRO,
        error: 'Preencha usuário e nome.',
      });
    }

    const outro = await Usuario.findByUsername(username);
    if (outro && outro.id !== id) {
      return res.status(400).render('usuarios/form', {
        title: 'Editar usuário',
        usuario: { ...atual, username, nome, role, permissoes, ativo },
        modulos: MODULOS,
        presetFinanceiro: PRESET_FINANCEIRO,
        error: 'Este usuário já existe.',
      });
    }

    await Usuario.atualizar(id, { username, nome, role, permissoes, ativo });
    return res.redirect('/usuarios?ok=Usuário atualizado.');
  } catch (err) {
    return next(err);
  }
}

async function formSenha(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      return res.redirect('/usuarios?erro=Usuário não encontrado.');
    }
    res.render('usuarios/senha', {
      title: 'Renovar senha',
      usuario,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function renovarSenha(req, res, next) {
  try {
    const id = Number(req.params.id);
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.redirect('/usuarios?erro=Usuário não encontrado.');
    }

    const password = String(req.body.password || '');
    const confirm = String(req.body.password_confirm || '');

    if (!password || password.length < 6) {
      return res.status(400).render('usuarios/senha', {
        title: 'Renovar senha',
        usuario,
        error: 'A senha deve ter pelo menos 6 caracteres.',
      });
    }
    if (password !== confirm) {
      return res.status(400).render('usuarios/senha', {
        title: 'Renovar senha',
        usuario,
        error: 'A confirmação de senha não confere.',
      });
    }

    await Usuario.renovarSenha(id, password);
    return res.redirect('/usuarios?ok=Senha renovada. Sessões anteriores foram invalidadas.');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listar,
  formNovo,
  criar,
  formEditar,
  atualizar,
  formSenha,
  renovarSenha,
};
