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

module.exports = {
  moneyBrl,
  moneyUsd,
  numberBr,
  percentBr,
  formatInputBr,
  parseNumber,
};
