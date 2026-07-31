const Usuario = require('../models/Usuario');
const {
  verifyAuthToken,
  clearAuthCookie,
  readAuthCookie,
  signAuthToken,
  setAuthCookie,
} = require('../services/authToken');
const {
  AVISO_SESSAO_CONCORRENTE,
  temPermissao,
  primeiraRotaPermitida,
} = require('../constants/permissoes');

const PUBLIC_PATHS = ['/login', '/logout'];

function isPublicPath(path) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    nome: user.nome,
    role: user.role,
    permissoes: user.permissoes,
    ativo: user.ativo,
    session_version: user.session_version,
  };
}

function invalidateLocalAuth(req, res, warning) {
  req.session.authWarning = warning || AVISO_SESSAO_CONCORRENTE;
  delete req.session.userId;
  delete req.session.sessionVersion;
  clearAuthCookie(res);
  res.locals.authWarning = req.session.authWarning;
}

/**
 * Carrega usuário da sessão + JWT; invalida se session_version divergir.
 */
async function loadUser(req, res, next) {
  try {
    res.locals.user = null;
    res.locals.authWarning = req.session?.authWarning || null;
    if (req.session?.authWarning) {
      delete req.session.authWarning;
    }

    const sessionUserId = req.session?.userId;
    const token = readAuthCookie(req);
    const payload = token ? verifyAuthToken(token) : null;

    if (!sessionUserId && !payload) {
      return next();
    }

    const userId = sessionUserId || payload?.sub;
    if (!userId) {
      return next();
    }

    const user = await Usuario.findById(userId);
    if (!user || !user.ativo) {
      delete req.session.userId;
      delete req.session.sessionVersion;
      clearAuthCookie(res);
      return next();
    }

    const sessionSv = req.session?.sessionVersion;
    const jwtSv = payload?.sv;

    const sessionStale =
      sessionUserId &&
      sessionSv !== undefined &&
      Number(sessionSv) !== Number(user.session_version);
    const jwtStale =
      payload &&
      jwtSv !== undefined &&
      Number(jwtSv) !== Number(user.session_version);

    if (sessionStale || jwtStale) {
      invalidateLocalAuth(req, res, AVISO_SESSAO_CONCORRENTE);
      return next();
    }

    // Sessão válida sem JWT: reemite o token
    if (sessionUserId && !payload) {
      const fresh = signAuthToken(user);
      setAuthCookie(res, fresh);
    }

    // JWT válido sem sessão: restaura sessão
    if (!sessionUserId && payload && !jwtStale) {
      req.session.userId = user.id;
      req.session.sessionVersion = user.session_version;
    }

    req.user = safeUser(user);
    res.locals.user = req.user;
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireAuth(req, res, next) {
  if (isPublicPath(req.path)) return next();
  if (req.user) return next();

  const warning = res.locals.authWarning || req.session?.authWarning;
  if (warning) {
    req.session.authWarning = warning;
  }
  const nextUrl = req.originalUrl && req.originalUrl !== '/' ? req.originalUrl : '';
  const qs = nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : '';

  return req.session.save((err) => {
    if (err) return next(err);
    return res.redirect(`/login${qs}`);
  });
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }
  if (req.user.role !== 'admin') {
    return res.status(403).render('errors/403', {
      title: 'Acesso negado',
      message: 'Apenas administradores podem acessar esta área.',
    });
  }
  return next();
}

function requirePermissao(modulo) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/login');
    }
    if (temPermissao(req.user, modulo)) {
      return next();
    }
    const destino = primeiraRotaPermitida(req.user);
    if (destino && destino !== req.path && destino !== req.originalUrl) {
      return res.redirect(destino);
    }
    return res.status(403).render('errors/403', {
      title: 'Acesso negado',
      message: 'Você não tem permissão para este módulo.',
    });
  };
}

module.exports = {
  loadUser,
  requireAuth,
  requireAdmin,
  requirePermissao,
  isPublicPath,
  safeUser,
};
