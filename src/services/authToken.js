const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'paulo_token';

function jwtSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || 'paulo-dev-jwt';
}

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      sv: user.session_version,
      role: user.role,
    },
    jwtSecret(),
    { expiresIn: '12h' }
  );
}

function verifyAuthToken(token) {
  try {
    return jwt.verify(token, jwtSecret());
  } catch {
    return null;
  }
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function readAuthCookie(req) {
  const header = req.headers.cookie || '';
  const parts = header.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      return decodeURIComponent(part.slice(COOKIE_NAME.length + 1));
    }
  }
  return null;
}

module.exports = {
  COOKIE_NAME,
  signAuthToken,
  verifyAuthToken,
  setAuthCookie,
  clearAuthCookie,
  readAuthCookie,
};
