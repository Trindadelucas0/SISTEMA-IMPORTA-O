/**
 * Cotações USD/BRL via AwesomeAPI (comercial, turismo, PTAX) + histórico diário.
 * Cache em memória para não martelar a API a cada refresh.
 */

const CACHE_MS = 5 * 60 * 1000;
const LAST_URL =
  'https://economia.awesomeapi.com.br/json/last/USD-BRL,USD-BRLT,USD-BRLPTAX';
const DAILY_URL = 'https://economia.awesomeapi.com.br/json/daily/USD-BRL/12';

let cache = {
  at: 0,
  data: null,
};

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickQuote(raw, key) {
  if (!raw || !raw[key]) return null;
  const q = raw[key];
  return {
    name: q.name || key,
    bid: toNum(q.bid),
    ask: toNum(q.ask),
    high: toNum(q.high),
    low: toNum(q.low),
    varBid: toNum(q.varBid),
    pctChange: toNum(q.pctChange),
    createDate: q.create_date || null,
    timestamp: q.timestamp ? Number(q.timestamp) : null,
  };
}

async function fetchJson(url, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildPayload(last, daily) {
  const comercial = pickQuote(last, 'USDBRL');
  const turismo = pickQuote(last, 'USDBRLT');
  const ptax = pickQuote(last, 'USDBRLPTAX');

  const historico = Array.isArray(daily)
    ? daily
        .map((d) => ({
          bid: toNum(d.bid),
          ask: toNum(d.ask),
          pctChange: toNum(d.pctChange),
          createDate: d.create_date || null,
          timestamp: d.timestamp ? Number(d.timestamp) : null,
        }))
        .filter((d) => d.bid != null)
        .reverse()
    : [];

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    source: 'AwesomeAPI / referências de mercado',
    comercial,
    turismo,
    ptax,
    historico,
    error: null,
  };
}

async function obterCotacoes(force = false) {
  const now = Date.now();
  if (!force && cache.data && now - cache.at < CACHE_MS) {
    return cache.data;
  }

  try {
    const [last, daily] = await Promise.all([
      fetchJson(LAST_URL),
      fetchJson(DAILY_URL).catch(() => []),
    ]);
    const payload = buildPayload(last, daily);
    cache = { at: now, data: payload };
    return payload;
  } catch (err) {
    if (cache.data) {
      return {
        ...cache.data,
        stale: true,
        error: err.message || 'Falha ao atualizar cotações',
      };
    }
    return {
      ok: false,
      updatedAt: new Date().toISOString(),
      source: 'AwesomeAPI',
      comercial: null,
      turismo: null,
      ptax: null,
      historico: [],
      error: err.message || 'Não foi possível obter cotações',
    };
  }
}

module.exports = {
  obterCotacoes,
};
