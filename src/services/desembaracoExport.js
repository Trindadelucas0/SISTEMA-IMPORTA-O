const ExcelJS = require('exceljs');

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const FIELD_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF334155' },
};
const TOTAL_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF7F8FA' },
};
const HIGHLIGHT_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8EEF8' },
};
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFD8DCE3' } },
  left: { style: 'thin', color: { argb: 'FFD8DCE3' } },
  bottom: { style: 'thin', color: { argb: 'FFD8DCE3' } },
  right: { style: 'thin', color: { argb: 'FFD8DCE3' } },
};

const GROUP_FILLS = {
  id: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
  usd: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } },
  produto: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } },
  imposto: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } },
  outras: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } },
  resultado: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163F7C' } },
};

const NUM_2 = '#,##0.00';
const NUM_4 = '#,##0.0000';
const PCT = '0.00%';
const BRL = 'R$ #,##0.00';
const USD = '"US$"#,##0.00';

function styleHeaderRow(row, fill = HEADER_FILL) {
  row.eachCell((cell) => {
    cell.fill = fill;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });
  row.height = 28;
}

function styleDataCell(cell, numFmt) {
  cell.border = THIN_BORDER;
  cell.alignment = { vertical: 'middle' };
  if (numFmt) cell.numFmt = numFmt;
}

function nullOrNumber(value, coberto = true) {
  if (!coberto || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDateTime(date) {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function applyGroupHeader(sheet, rowNumber, groups) {
  const row = sheet.getRow(rowNumber);
  let col = 1;
  for (const group of groups) {
    const start = col;
    const end = col + group.span - 1;
    if (group.span > 1) {
      sheet.mergeCells(rowNumber, start, rowNumber, end);
    }
    const cell = row.getCell(start);
    cell.value = group.label;
    cell.fill = GROUP_FILLS[group.key] || HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
    for (let c = start; c <= end; c += 1) {
      const edge = row.getCell(c);
      edge.fill = GROUP_FILLS[group.key] || HEADER_FILL;
      edge.border = THIN_BORDER;
      edge.font = HEADER_FONT;
    }
    col = end + 1;
  }
  row.height = 22;
}

async function buildCustoUnitarioWorkbook({
  pedido,
  desembaraco,
  linhas,
  totais,
  saldo,
  alocacoes,
  custoProdutoBrl,
  custoDelta,
  coberturaPct,
  geradoEm,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Importação';
  workbook.created = geradoEm;
  workbook.modified = geradoEm;

  const coberto = Boolean(saldo.coberto);

  // --- Resumo ---
  const resumo = workbook.addWorksheet('Resumo', {
    properties: { defaultRowHeight: 18 },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  resumo.columns = [
    { key: 'campo', width: 36 },
    { key: 'valor', width: 28 },
  ];

  resumo.mergeCells('A1:B1');
  resumo.getCell('A1').value = 'Importação — Relatório de Custo Unitário';
  resumo.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

  resumo.mergeCells('A2:B2');
  resumo.getCell('A2').value = `Gerado em ${formatDateTime(geradoEm)}`;
  resumo.getCell('A2').font = { size: 10, color: { argb: 'FF6B7280' } };

  const resumoRows = [
    ['Pedido', pedido.codigo],
    ['Fornecedor', pedido.fornecedor || '—'],
    ['Status', pedido.status],
    ['Cobertura', coberto ? 'Coberto' : 'Pendente'],
    ['Cobertura %', (Number(coberturaPct) || 0) / 100],
    ['Invoice USD', Number(saldo.invoice_usd) || 0],
    ['Custo produto BRL', coberto ? Number(custoProdutoBrl) || 0 : null],
    ['Custo desembaraço L', Number(desembaraco.custo_desembaraco_total) || 0],
    ['Divisor BC ICMS', Number(desembaraco.divisor_bc_icms) || 0],
    [
      'Custo landado',
      desembaraco.custo_total_atual != null ? Number(desembaraco.custo_total_atual) : null,
    ],
    ['Amount USD (totais)', Number(totais.amount_usd) || 0],
    ['Custo produto R$ (totais)', coberto ? Number(totais.custo_rs) || 0 : null],
    ['Impostos (totais)', Number(totais.custo_imposto) || 0],
    ['Outras despesas (totais)', Number(totais.outras_despesas) || 0],
  ];

  if (custoDelta) {
    resumoRows.push(
      ['Custo anterior', Number(custoDelta.anterior) || 0],
      ['Variação do custo', Number(custoDelta.delta) || 0]
    );
  }

  if (!coberto) {
    resumoRows.push([
      'Observação',
      'Pedido não coberto no saldo — custo unitário indisponível.',
    ]);
  }

  resumoRows.push([
    'Fórmula custo unitário',
    'Total custo unit = Custo unit R$ + Custo imposto + Outras unit',
  ]);

  let rowIdx = 4;
  resumo.getRow(rowIdx).values = ['Campo', 'Valor'];
  styleHeaderRow(resumo.getRow(rowIdx));
  rowIdx += 1;

  for (const [campo, valor] of resumoRows) {
    const row = resumo.getRow(rowIdx);
    row.getCell(1).value = campo;
    row.getCell(2).value = valor;
    styleDataCell(row.getCell(1));
    styleDataCell(row.getCell(2));
    row.getCell(1).font = { bold: true };

    if (campo === 'Cobertura %') styleDataCell(row.getCell(2), PCT);
    if (campo.includes('USD') && typeof valor === 'number') styleDataCell(row.getCell(2), USD);
    if (
      (campo.includes('BRL') ||
        campo.includes('R$') ||
        campo.includes('landado') ||
        campo.includes('desembaraço') ||
        campo.includes('Impostos') ||
        campo.includes('Outras') ||
        campo.includes('anterior') ||
        campo.includes('Variação')) &&
      typeof valor === 'number'
    ) {
      styleDataCell(row.getCell(2), BRL);
    }
    if (campo === 'Divisor BC ICMS' && typeof valor === 'number') {
      styleDataCell(row.getCell(2), NUM_4);
    }

    rowIdx += 1;
  }

  // --- Custo Unitario ---
  // Colunas alinhadas ao HTML: Identificação | USD | Produto R$ | Impostos | Outras | Resultado
  const sheet = workbook.addWorksheet('Custo Unitario', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
    properties: { defaultRowHeight: 18 },
  });

  const colDefs = [
    { header: 'REF', key: 'referencia', width: 14 },
    { header: 'NCM', key: 'ncm', width: 12 },
    { header: 'Qtd', key: 'quantidade', width: 10 },
    { header: 'Unit USD', key: 'preco_usd', width: 12 },
    { header: 'Amount USD', key: 'amount_usd', width: 12 },
    { header: '%', key: 'pct_rateio', width: 10 },
    { header: 'Custo R$', key: 'custo_rs', width: 12 },
    { header: 'Custo unit R$', key: 'custo_unit_rs', width: 13 },
    { header: 'Base J', key: 'base_desembaraco', width: 12 },
    { header: 'II %', key: 'aliq_ii', width: 10 },
    { header: 'II', key: 'ii_valor', width: 11 },
    { header: 'IPI %', key: 'aliq_ipi', width: 10 },
    { header: 'IPI', key: 'ipi_valor', width: 11 },
    { header: 'PIS %', key: 'aliq_pis', width: 10 },
    { header: 'PIS', key: 'pis_rs', width: 11 },
    { header: 'COFINS %', key: 'aliq_cofins', width: 10 },
    { header: 'COFINS', key: 'cofins_valor', width: 11 },
    { header: 'BC ICMS', key: 'bc_icms', width: 12 },
    { header: 'ICMS %', key: 'aliq_icms', width: 10 },
    { header: 'ICMS', key: 'valor_icms', width: 11 },
    { header: 'Custo imposto', key: 'custo_imposto', width: 13 },
    { header: '% imposto', key: 'pct_imposto', width: 11 },
    { header: 'Outras desp.', key: 'outras_despesas', width: 12 },
    { header: '% s/ unit', key: 'pct_outras_despesas', width: 12 },
    { header: 'Outras unit', key: 'outras_despesas_unit', width: 12 },
    { header: 'Total custo unit', key: 'total_custo_unit', width: 14 },
  ];
  sheet.columns = colDefs;

  applyGroupHeader(sheet, 1, [
    { label: 'Identificação', span: 3, key: 'id' },
    { label: 'USD', span: 3, key: 'usd' },
    { label: 'Produto R$', span: 2, key: 'produto' },
    { label: 'Impostos', span: 14, key: 'imposto' },
    { label: 'Outras', span: 3, key: 'outras' },
    { label: 'Resultado', span: 1, key: 'resultado' },
  ]);

  const headerRow = sheet.getRow(2);
  colDefs.forEach((col, i) => {
    headerRow.getCell(i + 1).value = col.header;
  });
  styleHeaderRow(headerRow, FIELD_FILL);

  linhas.forEach((linha) => {
    const row = sheet.addRow({
      referencia: linha.referencia,
      ncm: linha.ncm || '',
      quantidade: Number(linha.quantidade) || 0,
      preco_usd: Number(linha.preco_usd) || 0,
      amount_usd: Number(linha.amount_usd) || 0,
      pct_rateio: Number(linha.pct_rateio) || 0,
      custo_rs: nullOrNumber(linha.custo_rs, coberto),
      custo_unit_rs: nullOrNumber(linha.custo_unit_rs, coberto),
      base_desembaraco: Number(linha.base_desembaraco) || 0,
      aliq_ii: Number(linha.aliq_ii) || 0,
      ii_valor: Number(linha.ii_valor) || 0,
      aliq_ipi: Number(linha.aliq_ipi) || 0,
      ipi_valor: Number(linha.ipi_valor) || 0,
      aliq_pis: Number(linha.aliq_pis) || 0,
      pis_rs: Number(linha.pis_rs) || 0,
      aliq_cofins: Number(linha.aliq_cofins) || 0,
      cofins_valor: Number(linha.cofins_valor) || 0,
      bc_icms: Number(linha.bc_icms) || 0,
      aliq_icms: Number(linha.aliq_icms) || 0,
      valor_icms: Number(linha.valor_icms) || 0,
      custo_imposto: Number(linha.custo_imposto) || 0,
      pct_imposto: nullOrNumber(linha.pct_imposto, coberto),
      outras_despesas: Number(linha.outras_despesas) || 0,
      pct_outras_despesas: nullOrNumber(linha.pct_outras_despesas, coberto),
      outras_despesas_unit: Number(linha.outras_despesas_unit) || 0,
      total_custo_unit: nullOrNumber(linha.total_custo_unit, coberto),
    });

    const fmts = {
      quantidade: NUM_2,
      preco_usd: NUM_2,
      amount_usd: NUM_2,
      pct_rateio: PCT,
      custo_rs: NUM_2,
      custo_unit_rs: NUM_2,
      base_desembaraco: NUM_2,
      aliq_ii: PCT,
      ii_valor: NUM_2,
      aliq_ipi: PCT,
      ipi_valor: NUM_2,
      aliq_pis: PCT,
      pis_rs: NUM_2,
      aliq_cofins: PCT,
      cofins_valor: NUM_2,
      bc_icms: NUM_2,
      aliq_icms: PCT,
      valor_icms: NUM_2,
      custo_imposto: NUM_2,
      pct_imposto: PCT,
      outras_despesas: NUM_2,
      pct_outras_despesas: PCT,
      outras_despesas_unit: NUM_2,
      total_custo_unit: NUM_2,
    };

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = colDefs[colNumber - 1]?.key;
      styleDataCell(cell, fmts[key]);
      if (key === 'total_custo_unit') {
        cell.fill = HIGHLIGHT_FILL;
        cell.font = { bold: true };
      }
      if (key === 'referencia') cell.font = { bold: true };
    });
  });

  const totalRow = sheet.addRow({
    referencia: 'TOTAL',
    ncm: '',
    quantidade: Number(totais.quantidade) || 0,
    preco_usd: null,
    amount_usd: Number(totais.amount_usd) || 0,
    pct_rateio: 1,
    custo_rs: nullOrNumber(totais.custo_rs, coberto),
    custo_unit_rs: null,
    base_desembaraco: null,
    aliq_ii: null,
    ii_valor: null,
    aliq_ipi: null,
    ipi_valor: null,
    aliq_pis: null,
    pis_rs: null,
    aliq_cofins: null,
    cofins_valor: null,
    bc_icms: null,
    aliq_icms: null,
    valor_icms: null,
    custo_imposto: Number(totais.custo_imposto) || 0,
    pct_imposto: null,
    outras_despesas: Number(totais.outras_despesas) || 0,
    pct_outras_despesas: null,
    outras_despesas_unit: null,
    total_custo_unit: null,
  });
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = THIN_BORDER;
    cell.fill = TOTAL_FILL;
    cell.font = { bold: true };
  });
  totalRow.getCell('quantidade').numFmt = NUM_2;
  totalRow.getCell('amount_usd').numFmt = NUM_2;
  totalRow.getCell('pct_rateio').numFmt = PCT;
  totalRow.getCell('custo_rs').numFmt = NUM_2;
  totalRow.getCell('custo_imposto').numFmt = NUM_2;
  totalRow.getCell('outras_despesas').numFmt = NUM_2;

  // --- Anexo Alocacoes ---
  const alocSheet = workbook.addWorksheet('Anexo Alocacoes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  alocSheet.columns = [
    { header: 'Pagamento ID', key: 'pagamento_id', width: 14 },
    { header: 'Descrição', key: 'pagamento_descricao', width: 36 },
    { header: 'USD', key: 'valor_usd', width: 14 },
    { header: 'Dólar', key: 'dolar_dia', width: 12 },
    { header: 'BRL', key: 'valor_brl', width: 14 },
  ];
  styleHeaderRow(alocSheet.getRow(1));

  (alocacoes || []).forEach((a) => {
    const row = alocSheet.addRow({
      pagamento_id: a.pagamento_id,
      pagamento_descricao: a.pagamento_descricao || '',
      valor_usd: Number(a.valor_usd) || 0,
      dolar_dia: Number(a.dolar_dia) || 0,
      valor_brl: Number(a.valor_brl) || 0,
    });
    styleDataCell(row.getCell(1));
    styleDataCell(row.getCell(2));
    styleDataCell(row.getCell(3), USD);
    styleDataCell(row.getCell(4), NUM_4);
    styleDataCell(row.getCell(5), BRL);
  });

  if (!alocacoes || !alocacoes.length) {
    const empty = alocSheet.addRow({
      pagamento_id: '—',
      pagamento_descricao: 'Nenhuma alocação neste pedido',
      valor_usd: null,
      dolar_dia: null,
      valor_brl: null,
    });
    empty.eachCell((cell) => {
      cell.border = THIN_BORDER;
      cell.font = { italic: true, color: { argb: 'FF6B7280' } };
    });
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildCustoUnitarioWorkbook };
