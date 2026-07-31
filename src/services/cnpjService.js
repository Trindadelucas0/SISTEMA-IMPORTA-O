const { onlyDigits, isValidCnpj } = require('../utils/format');

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function mapBrasilApi(data) {
  const cnpj = onlyDigits(data.cnpj);
  const telefone = [data.ddd_telefone_1, data.ddd_telefone_2]
    .filter(Boolean)
    .map((t) => String(t).trim())
    .filter(Boolean)
    .join(' / ');

  const fantasia = String(data.nome_fantasia || '').trim();
  const razao = String(data.razao_social || '').trim();

  return {
    cnpj,
    razao_social: razao || null,
    nome_fantasia: fantasia || null,
    nome: fantasia || razao || null,
    email: data.email ? String(data.email).trim().toLowerCase() : null,
    telefone: telefone || null,
    cep: onlyDigits(data.cep).slice(0, 8) || null,
    logradouro: data.logradouro ? String(data.logradouro).trim() : null,
    numero: data.numero ? String(data.numero).trim() : null,
    complemento: data.complemento ? String(data.complemento).trim() : null,
    bairro: data.bairro ? String(data.bairro).trim() : null,
    cidade: data.municipio ? String(data.municipio).trim() : null,
    uf: data.uf ? String(data.uf).trim().toUpperCase().slice(0, 2) : null,
    pais: 'Brasil',
  };
}

function mapOpenCnpj(data) {
  const cnpj = onlyDigits(data.cnpj || data.taxId);
  const fantasia = String(data.alias || data.nome_fantasia || '').trim();
  const razao = String(data.company?.name || data.razao_social || data.name || '').trim();
  const addr = data.address || {};
  const phones = Array.isArray(data.phones) ? data.phones : [];
  const telefone = phones
    .map((p) => {
      if (typeof p === 'string') return p;
      const area = p.area || p.ddd || '';
      const number = p.number || p.telefone || '';
      return [area, number].filter(Boolean).join('');
    })
    .filter(Boolean)
    .join(' / ');

  const emails = Array.isArray(data.emails) ? data.emails : [];
  const emailRaw = emails[0]?.address || emails[0] || data.email || '';

  return {
    cnpj,
    razao_social: razao || null,
    nome_fantasia: fantasia || null,
    nome: fantasia || razao || null,
    email: emailRaw ? String(emailRaw).trim().toLowerCase() : null,
    telefone: telefone || null,
    cep: onlyDigits(addr.postalCode || addr.zip || data.cep).slice(0, 8) || null,
    logradouro: addr.street || data.logradouro || null,
    numero: addr.number || data.numero || null,
    complemento: addr.details || addr.complement || data.complemento || null,
    bairro: addr.district || addr.neighborhood || data.bairro || null,
    cidade: addr.city || data.municipio || data.cidade || null,
    uf: String(addr.state || data.uf || '')
      .trim()
      .toUpperCase()
      .slice(0, 2) || null,
    pais: 'Brasil',
  };
}

async function consultarOpenCnpj(cnpj) {
  let res;
  try {
    res = await fetch(`https://api.opencnpj.org/${cnpj}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Importacao/1.0 (cadastro-fornecedor)',
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    return { ok: false, error: 'Falha de rede ao consultar CNPJ. Tente de novo.' };
  }

  if (res.status === 404) {
    return { ok: false, error: 'CNPJ não encontrado na Receita.' };
  }
  if (!res.ok) {
    return { ok: false, error: `Não foi possível consultar o CNPJ (${res.status}).` };
  }

  const json = await res.json();
  const data = mapOpenCnpj(json);
  cache.set(cnpj, { at: Date.now(), data });
  return { ok: true, data, cached: false };
}

/**
 * Consulta CNPJ (BrasilAPI, com fallback OpenCNPJ). Só com 14 dígitos válidos.
 */
async function consultarCnpj(raw) {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) {
    return { ok: false, error: 'Informe um CNPJ com 14 dígitos.' };
  }
  if (!isValidCnpj(cnpj)) {
    return { ok: false, error: 'CNPJ inválido.' };
  }

  const cached = cache.get(cnpj);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ok: true, data: cached.data, cached: true };
  }

  let res;
  try {
    res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Importacao/1.0 (cadastro-fornecedor)',
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    return consultarOpenCnpj(cnpj);
  }

  if (res.status === 404) {
    return { ok: false, error: 'CNPJ não encontrado na Receita.' };
  }
  if (res.status === 429) {
    return { ok: false, error: 'Limite de consultas atingido. Aguarde e tente novamente.' };
  }
  if (res.status === 403 || res.status === 401 || !res.ok) {
    return consultarOpenCnpj(cnpj);
  }

  const json = await res.json();
  const data = mapBrasilApi(json);
  cache.set(cnpj, { at: Date.now(), data });
  return { ok: true, data, cached: false };
}

module.exports = { consultarCnpj };
