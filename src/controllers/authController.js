const Usuario = require('../models/Usuario');
const {
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
} = require('../services/authToken');
const {
  AVISO_SESSAO_CONCORRENTE,
  primeiraRotaPermitida,
} = require('../constants/permissoes');
const { safeUser } = require('../middlewares/auth');

function formLogin(req, res) {
  if (req.user) {
    const dest = primeiraRotaPermitida(req.user);
    if (dest) return res.redirect(dest);
    return res.status(403).render('errors/403', {
      title: 'Acesso negado',
      message: 'Seu usuário não tem nenhuma aba liberada. Contate o administrador.',
    });
  }
  const warning = res.locals.authWarning || req.session?.authWarning || null;
  if (req.session?.authWarning) {
    delete req.session.authWarning;
  }
  res.render('auth/login', {
    title: 'Login',
    error: null,
    warning,
    username: '',
    next: req.query.next || '',
  });
}

async function login(req, res, next) {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const nextUrl = String(req.body.next || '').trim();

    if (!username || !password) {
      return res.status(400).render('auth/login', {
        title: 'Login',
        error: 'Informe usuário e senha.',
        warning: null,
        username,
        next: nextUrl,
      });
    }

    const user = await Usuario.autenticar(username, password);
    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Login',
        error: 'Usuário ou senha inválidos.',
        warning: null,
        username,
        next: nextUrl,
      });
    }

    const updated = await Usuario.bumpSessionVersion(user.id);
    const token = signAuthToken(updated);

    req.session.userId = updated.id;
    req.session.sessionVersion = updated.session_version;
    delete req.session.authWarning;
    setAuthCookie(res, token);

    req.user = safeUser(updated);

    let destino = primeiraRotaPermitida(updated) || '/';
    if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//')) {
      destino = nextUrl;
    }

    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect(destino);
    });
  } catch (err) {
    return next(err);
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

module.exports = {
  formLogin,
  login,
  logout,
  AVISO_SESSAO_CONCORRENTE,
};
