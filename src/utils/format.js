function moneyBrl(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function moneyUsd(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function numberBr(value, digits = 2) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function percentBr(value) {
  const n = Number(value) || 0;
  return `${(n * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

/**
 * Formata número para exibir em inputs no padrão pt-BR.
 * Ex.: 1234.5 → "1.234,50"
 */
function formatInputBr(value, digits = 2) {
  if (value === undefined || value === null || value === '') return '';
  const n = typeof value === 'number' ? value : parseNumber(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Interpreta número digitado em pt-BR (e US).
 * 1.000 → 1000 | 10,50 → 10.5 | 1.234,56 → 1234.56 | 1.5 → 1.5
 */
function parseNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;

  let s = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$|US\$|USD|BRL|\$/gi, '');

  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 10,50 ou 1.000,50 já tratado acima; só vírgula = decimal BR
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2) {
      // 12.345.678 → milhares
      s = parts.join('');
    } else if (parts.length === 2) {
      const [intPart, frac] = parts;
      // 1.000 → milhar; 0.021 / 1.5 → decimal
      if (
        frac.length === 3 &&
        /^\d+$/.test(frac) &&
        intPart !== '' &&
        intPart !== '0'
      ) {
        s = intPart + frac;
      }
      // senão mantém o ponto como decimal
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Converte dd/mm/aaaa (ou d/m/aaaa) para YYYY-MM-DD.
 * Retorna '' se inválida.
 */
function parseDateBr(value) {
  if (value === undefined || value === null || value === '') return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return '';
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Normaliza valor de data para YYYY-MM-DD (input type="date").
 * Aceita ISO (YYYY-MM-DD) ou brasileiro (dd/mm/aaaa).
 */
function toDateInputValue(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const fromBr = parseDateBr(s);
    if (fromBr) return fromBr;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Soma dias a uma data YYYY-MM-DD sem deslocar o dia por fuso.
 * Retorna YYYY-MM-DD ou '' se a base for inválida/vazia.
 */
function addDaysIso(dateStr, days) {
  const base = toDateInputValue(dateStr);
  if (!base) return '';
  const [y, m, d] = base.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Formata data para exibição pt-BR (dd/mm/aaaa).
 */
function formatDateBr(value) {
  const iso = toDateInputValue(value);
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const STATUS_PEDIDO = ['aberta', 'em_transito', 'embarcada', 'finalizada'];

const STATUS_PEDIDO_LABELS = {
  aberta: 'Aberta',
  em_transito: 'Em Trânsito',
  embarcada: 'Embarcada',
  finalizada: 'Finalizada',
};

function statusPedidoLabel(status) {
  if (!status) return '—';
  return STATUS_PEDIDO_LABELS[status] || String(status);
}

const STATUS_PEDIDO_BADGE = {
  aberta: 'badge-info',
  em_transito: 'badge-warn',
  embarcada: 'badge-ok',
  finalizada: 'badge-muted',
};

function statusPedidoBadgeClass(status) {
  return STATUS_PEDIDO_BADGE[status] || 'badge-info';
}

function isPedidoAberto(status) {
  return status !== 'embarcada' && status !== 'finalizada';
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnpj(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCep(value) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calc = (base, factors) => {
    let sum = 0;
    for (let i = 0; i < factors.length; i += 1) {
      sum += Number(base[i]) * factors[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

module.exports = {
  moneyBrl,
  moneyUsd,
  numberBr,
  percentBr,
  formatInputBr,
  parseNumber,
  toDateInputValue,
  parseDateBr,
  addDaysIso,
  formatDateBr,
  STATUS_PEDIDO,
  STATUS_PEDIDO_LABELS,
  statusPedidoLabel,
  statusPedidoBadgeClass,
  isPedidoAberto,
  onlyDigits,
  formatCnpj,
  formatCep,
  isValidCnpj,
};
