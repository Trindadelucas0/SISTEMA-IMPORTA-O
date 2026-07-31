/**
 * Smoke + scraping HTTP contra o servidor local.
 * Uso: node scripts/smoke-validate.js
 * Env: SMOKE_BASE_URL | PORT, ADMIN_USERNAME, ADMIN_PASSWORD
 *
 * Prefere 127.0.0.1 (evita falha IPv6/localhost no Windows).
 * O servidor precisa estar no ar (ex.: npm run dev em outro terminal).
 */
require('dotenv').config();

const PORT = Number(process.env.PORT || 3000);
const BASE =
  process.env.SMOKE_BASE_URL || `http://127.0.0.1:${PORT}`;

const USER = process.env.ADMIN_USERNAME || 'admin';
const PASS = process.env.ADMIN_PASSWORD || 'admin123';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);
const READY_ATTEMPTS = Number(process.env.SMOKE_READY_ATTEMPTS || 8);
const READY_DELAY_MS = Number(process.env.SMOKE_READY_DELAY_MS || 500);

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail: String(detail || '').slice(0, 240) });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`);
}

function cookieJar() {
  const jar = new Map();

  function storeFromResponse(res) {
    const raw =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [];
    const fallback = res.headers.get('set-cookie');
    const list = raw.length ? raw : fallback ? [fallback] : [];
    for (const line of list) {
      const pair = String(line).split(';')[0];
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name) continue;
      if (value === '' || /Max-Age=0/i.test(line) || /Expires=.*1970/i.test(line)) {
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    }
  }

  function header() {
    if (!jar.size) return undefined;
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  function has(name) {
    return jar.has(name);
  }

  function clear() {
    jar.clear();
  }

  return { storeFromResponse, header, has, clear };
}

async function request(jar, path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers = { ...(options.headers || {}) };
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      redirect: options.redirect || 'manual',
      signal: ctrl.signal,
    });
    jar.storeFromResponse(res);
    const text = await res.text();
    return { res, text, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

function locationOf(res) {
  return res.headers.get('location') || '';
}

function assertStatus(name, status, allowed, detail = '') {
  const list = Array.isArray(allowed) ? allowed : [allowed];
  const ok = list.includes(status) && status < 500;
  record(name, ok, detail || `status=${status}`);
  return ok;
}

function assertIncludes(name, text, needles, extra = '') {
  const missing = needles.filter((n) => !String(text).includes(n));
  const ok = missing.length === 0;
  record(
    name,
    ok,
    ok ? extra || 'marcadores OK' : `faltando: ${missing.join(', ')}`
  );
  return ok;
}

function firstHref(html, patterns) {
  for (const re of patterns) {
    const m = String(html).match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function formatFetchError(err) {
  const cause = err?.cause;
  const code = cause?.code || err?.code || '';
  const detail = cause?.message || err?.message || String(err);
  if (code === 'ECONNREFUSED' || /fetch failed/i.test(detail)) {
    return [
      `não conectou em ${BASE} (${code || 'fetch failed'}).`,
      'Suba o servidor em outro terminal: npm run dev',
      `Confirme a porta no .env (PORT=${PORT}).`,
    ].join(' ');
  }
  return detail;
}

async function waitForServer() {
  const probe = cookieJar();
  let lastErr = null;
  for (let i = 1; i <= READY_ATTEMPTS; i += 1) {
    try {
      const { status } = await request(probe, '/login');
      if (status > 0 && status < 500) return true;
      lastErr = new Error(`status inesperado ${status}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < READY_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, READY_DELAY_MS));
    }
  }
  throw lastErr || new Error('servidor indisponível');
}

async function main() {
  console.log(`Smoke base: ${BASE}`);
  console.log(`User: ${USER}`);
  console.log('');

  try {
    await waitForServer();
  } catch (err) {
    console.error('Smoke abortou:', formatFetchError(err));
    process.exit(1);
  }

  const emptyJar = cookieJar();

  // --- Auth negativa ---
  for (const path of ['/', '/pedidos', '/fornecedores', '/usuarios']) {
    const { res, status } = await request(emptyJar, path);
    const loc = locationOf(res);
    const ok =
      (status === 302 || status === 303 || status === 301) &&
      loc.includes('/login');
    record(`unauth ${path} → login`, ok, `status=${status} location=${loc}`);
  }

  // --- Login page ---
  const loginJar = cookieJar();
  {
    const { text, status } = await request(loginJar, '/login');
    assertStatus('GET /login status', status, 200);
    assertIncludes('GET /login form', text, [
      'name="username"',
      'name="password"',
      'action="/login"',
    ]);
  }

  // --- Login inválido ---
  {
    const badJar = cookieJar();
    await request(badJar, '/login');
    const body = new URLSearchParams({
      username: USER,
      password: '__senha_invalida_smoke__',
    });
    const { text, status } = await request(badJar, '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const ok =
      status === 401 &&
      (text.includes('inválidos') || text.includes('inválido') || text.includes('senha'));
    record('POST /login inválido', ok, `status=${status}`);
  }

  // --- Login válido ---
  const jar = cookieJar();
  {
    await request(jar, '/login');
    const body = new URLSearchParams({
      username: USER,
      password: PASS,
    });
    const { res, status } = await request(jar, '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const loc = locationOf(res);
    const redirected =
      (status === 302 || status === 303) && loc && !loc.includes('/login');
    const hasSession = jar.has('connect.sid') || jar.has('paulo_token');
    record(
      'POST /login válido',
      redirected && hasSession,
      `status=${status} location=${loc} cookies=${hasSession}`
    );
  }

  if (!jar.has('connect.sid') && !jar.has('paulo_token')) {
    record('abort', false, 'login não estabeleceu cookies; demais testes autenticados pulados');
    return finish();
  }

  // --- Páginas autenticadas ---
  const pages = [
    { path: '/', needles: ['Dashboard', 'nav-brand'] },
    { path: '/pedidos', needles: ['Pedidos', 'nav-brand'] },
    { path: '/pedidos/novo', needles: ['form', 'nav-brand'] },
    { path: '/pagamentos', needles: ['Pagamentos', 'nav-brand'] },
    { path: '/pagamentos/novo', needles: ['form', 'nav-brand'] },
    { path: '/produtos', needles: ['Produtos', 'nav-brand'] },
    { path: '/produtos/novo', needles: ['form', 'nav-brand'] },
    { path: '/fornecedores', needles: ['Fornecedores', 'nav-brand'] },
    { path: '/fornecedores/novo', needles: ['form', 'cnpj', 'nav-brand'] },
    { path: '/saldo', needles: ['Saldo', 'nav-brand'] },
    { path: '/desembaraco', needles: ['nav-brand'] },
    { path: '/analises', needles: ['Análises', 'nav-brand'] },
    { path: '/analises/comparativo', needles: ['nav-brand'] },
    { path: '/analises/custo-landado', needles: ['nav-brand'] },
    { path: '/usuarios', needles: ['Usuários', 'nav-brand'] },
    { path: '/usuarios/novo', needles: ['form', 'nav-brand'] },
  ];

  let pedidosHtml = '';
  let fornecedoresHtml = '';

  for (const page of pages) {
    const { text, status } = await request(jar, page.path);
    if (page.path === '/pedidos') pedidosHtml = text;
    if (page.path === '/fornecedores') fornecedoresHtml = text;
    if (status >= 500) {
      record(`GET ${page.path}`, false, `status=${status}`);
      continue;
    }
    const statusOk = status === 200;
    record(`GET ${page.path} status`, statusOk, `status=${status}`);
    if (statusOk) {
      assertIncludes(`GET ${page.path} html`, text, page.needles);
    }
  }

  // --- Detalhe dinâmico ---
  const pedidoHref = firstHref(pedidosHtml, [
    /href="(\/pedidos\/\d+)"/,
    /href='(\/pedidos\/\d+)'/,
  ]);
  if (pedidoHref) {
    const { status } = await request(jar, pedidoHref);
    assertStatus(`GET detalhe ${pedidoHref}`, status, 200);
    const editHref = `${pedidoHref}/editar`;
    const edit = await request(jar, editHref);
    assertStatus(`GET ${editHref}`, edit.status, 200);
  } else {
    record('GET detalhe pedido', true, 'nenhum pedido na listagem (skip)');
  }

  const fornHref = firstHref(fornecedoresHtml, [
    /href="(\/fornecedores\/\d+\/editar)"/,
    /href='(\/fornecedores\/\d+\/editar)'/,
  ]);
  if (fornHref) {
    const { status } = await request(jar, fornHref);
    assertStatus(`GET ${fornHref}`, status, 200);
  } else {
    record('GET editar fornecedor', true, 'nenhum fornecedor na listagem (skip)');
  }

  // --- API CNPJ (não exige 200 se API externa falhar; nunca 5xx) ---
  {
    const cnpj = '00000000000191';
    const { text, status } = await request(jar, `/fornecedores/api/cnpj/${cnpj}`);
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const ok = status < 500 && parsed && typeof parsed.ok === 'boolean';
    record(
      `GET /fornecedores/api/cnpj/${cnpj}`,
      ok,
      `status=${status} body=${text.slice(0, 120)}`
    );
  }

  // --- Logout ---
  {
    const { status } = await request(jar, '/logout');
    const ok = status === 302 || status === 303 || status === 200;
    record('GET /logout', ok, `status=${status}`);

    const after = await request(jar, '/');
    const loc = locationOf(after.res);
    const redirected =
      (after.status === 302 || after.status === 303) && loc.includes('/login');
    record('após logout GET / → login', redirected, `status=${after.status} location=${loc}`);
  }

  return finish();
}

function finish() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`Resultado: ${passed} pass, ${failed.length} fail (total ${results.length})`);
  if (failed.length) {
    console.log('Falhas:');
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.detail}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Smoke abortou:', formatFetchError(err));
  process.exit(1);
});
