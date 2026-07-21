/**
 * Desembaraço: amarelos J/L manuais.
 * Custo produto em R$ vem das alocações (dólar de cada pagamento), sem média.
 */
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeDiv(a, b) {
  const denom = toNumber(b);
  if (denom === 0) return 0;
  return toNumber(a) / denom;
}

/**
 * @param {object} item
 * @param {object} contexto
 *   totalAmountUsd, coberto, custoProdutoBrl, custoDesembaracoTotal, divisorBcIcms
 */
function calcularLinha(item, contexto) {
  const quantidade = toNumber(item.quantidade);
  const precoUsd = toNumber(item.preco_usd);
  const amountUsd = quantidade * precoUsd;
  const totalAmountUsd = toNumber(contexto.totalAmountUsd);
  const coberto = Boolean(contexto.coberto);
  const custoProdutoBrl = toNumber(contexto.custoProdutoBrl);
  const custoDesembaracoTotal = toNumber(contexto.custoDesembaracoTotal);
  const divisorBc = toNumber(contexto.divisorBcIcms, 0.94) || 0.94;
  const base = toNumber(item.base_desembaraco);

  const aliqIi = toNumber(item.aliq_ii);
  const aliqIpi = toNumber(item.aliq_ipi);
  const aliqPis = toNumber(item.aliq_pis);
  const aliqCofins = toNumber(item.aliq_cofins);
  const aliqIcms = toNumber(item.aliq_icms);

  const pctRateio = safeDiv(amountUsd, totalAmountUsd);

  // Parcela do produto em R$ conforme % da carga
  const custoRs = coberto ? custoProdutoBrl * pctRateio : null;
  const custoUnitRs = coberto ? safeDiv(custoRs, quantidade) : null;

  const iiValor = base * aliqIi;
  const ipiValor = (base + iiValor) * aliqIpi;
  const pisRs = base * aliqPis;
  const cofinsValor = base * aliqCofins;
  const bcIcms = safeDiv(base + iiValor + ipiValor + pisRs + cofinsValor, divisorBc);
  const valorIcms = bcIcms * aliqIcms;
  const custoImposto = iiValor + ipiValor + pisRs + cofinsValor + valorIcms;
  const outrasDespesas = custoDesembaracoTotal * pctRateio;
  const outrasUnit = safeDiv(outrasDespesas, quantidade);
  const totalCustoUnit = coberto ? (custoUnitRs || 0) + custoImposto + outrasUnit : null;

  return {
    amount_usd: amountUsd,
    pct_rateio: pctRateio,
    custo_rs: custoRs,
    custo_unit_rs: custoUnitRs,
    base_desembaraco: base,
    aliq_ii: aliqIi,
    ii_valor: iiValor,
    aliq_ipi: aliqIpi,
    ipi_valor: ipiValor,
    aliq_pis: aliqPis,
    pis_rs: pisRs,
    aliq_cofins: aliqCofins,
    cofins_valor: cofinsValor,
    bc_icms: bcIcms,
    aliq_icms: aliqIcms,
    valor_icms: valorIcms,
    custo_imposto: custoImposto,
    pct_imposto: coberto ? safeDiv(custoImposto, custoUnitRs) : null,
    outras_despesas: outrasDespesas,
    // % outras = Outras unit / Custo unit R$
    pct_outras_despesas: coberto ? safeDiv(outrasUnit, custoUnitRs) : null,
    outras_despesas_unit: outrasUnit,
    total_custo_unit: totalCustoUnit,
  };
}

/**
 * @param {Array} itens
 * @param {object} desembaraco
 * @param {{ coberto: boolean, custoProdutoBrl: number }} cobertura
 */
function calcularPedido(itens, desembaraco, cobertura = {}) {
  const totalAmountUsd = itens.reduce(
    (acc, item) => acc + toNumber(item.quantidade) * toNumber(item.preco_usd),
    0
  );

  const coberto = Boolean(cobertura.coberto);
  const contexto = {
    totalAmountUsd,
    coberto,
    custoProdutoBrl: coberto ? toNumber(cobertura.custoProdutoBrl) : 0,
    custoDesembaracoTotal: toNumber(desembaraco?.custo_desembaraco_total),
    divisorBcIcms: toNumber(desembaraco?.divisor_bc_icms, 0.94),
  };

  const linhas = itens.map((item) => {
    const calc = calcularLinha(item, contexto);
    return { ...item, ...calc };
  });

  const totais = linhas.reduce(
    (acc, linha) => {
      acc.quantidade += toNumber(linha.quantidade);
      acc.amount_usd += linha.amount_usd;
      if (coberto) acc.custo_rs += linha.custo_rs || 0;
      acc.custo_imposto += linha.custo_imposto;
      acc.outras_despesas += linha.outras_despesas;
      return acc;
    },
    {
      quantidade: 0,
      amount_usd: 0,
      custo_rs: coberto ? 0 : null,
      custo_imposto: 0,
      outras_despesas: 0,
    }
  );

  return { linhas, totais, contexto };
}

module.exports = { calcularLinha, calcularPedido, toNumber, safeDiv };
