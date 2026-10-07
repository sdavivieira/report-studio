/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process */

const XLSX = require('xlsx')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const exampleDirectory = path.join(root, 'examples')
const outputDirectory = path.join(root, 'output', 'demonstracao')
fs.mkdirSync(exampleDirectory, { recursive: true })
fs.mkdirSync(outputDirectory, { recursive: true })

const headers = [
  'Produto',
  'Categoria',
  'Quantidade',
  'Preço de venda',
  'Receita',
  'Custo total',
  'Lucro',
  'Margem',
]
const rows = [
  ['Notebook Pro X14', 'Notebook', 18, 5299, 95382, 70020, 25362, 0.266],
  ['Notebook Office 15', 'Notebook', 14, 3799, 53186, 38920, 14266, 0.268],
  ['Desktop Performance i7', 'Desktop', 9, 6499, 58491, 42480, 16011, 0.274],
  ['Desktop Office i5', 'Desktop', 11, 4299, 47289, 34650, 12639, 0.267],
  ['Mini PC Business', 'Mini PC', 8, 3199, 25592, 18240, 7352, 0.287],
  ['Workstation Creator', 'Workstation', 4, 11990, 47960, 35400, 12560, 0.262],
  ['All-in-One 24', 'All-in-One', 7, 4599, 32193, 23870, 8323, 0.259],
  ['Gaming Tower RTX', 'Desktop Gamer', 6, 8990, 53940, 40440, 13500, 0.25],
  ['Chromebook EDU', 'Notebook', 12, 2199, 26388, 19320, 7068, 0.268],
]

const workbook = XLSX.utils.book_new()
const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
sheet['!cols'] = [
  { wch: 28 },
  { wch: 18 },
  { wch: 12 },
  { wch: 16 },
  { wch: 14 },
  { wch: 14 },
  { wch: 14 },
  { wch: 10 },
]
XLSX.utils.book_append_sheet(workbook, sheet, 'Vendas')
XLSX.writeFile(
  workbook,
  path.join(exampleDirectory, 'vendas-computadores-demonstracao.xlsx'),
)

const reorderedHeaders = [
  'Margem',
  'Produto',
  'Receita',
  'Categoria',
  'Lucro',
  'Quantidade',
  'Custo total',
  'Preço de venda',
]
const headerIndexes = new Map(headers.map((header, index) => [header, index]))
const reorderedRows = rows.map((row) =>
  reorderedHeaders.map((header) => row[headerIndexes.get(header)]),
)
const reorderedWorkbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  reorderedWorkbook,
  XLSX.utils.aoa_to_sheet([reorderedHeaders, ...reorderedRows]),
  'Vendas reorganizadas',
)
XLSX.writeFile(
  reorderedWorkbook,
  path.join(exampleDirectory, 'vendas-computadores-colunas-reordenadas.xlsx'),
)

const columns = headers.map((label, order) => ({
  sourceId: `column-${order}`,
  visible: true,
  order,
  label,
  widthMm: [42, 27, 18, 25, 24, 24, 24, 18][order],
  alignment: order < 2 ? 'left' : 'right',
  numberFormat:
    order === 2
      ? 'integer'
      : order >= 3 && order <= 6
        ? 'currency'
        : order === 7
          ? 'percentage'
          : 'automatic',
  dateFormat: 'automatic',
}))

const baseStyle = { color: '#333333', fontSize: 9, alignment: 'left' }
const element = (id, type, pageIndex, x, y, width, height, extra = {}) => ({
  id,
  type,
  visible: true,
  position: { x, y },
  size: { width, height },
  keepAspectRatio: false,
  style: { ...baseStyle },
  pageIndex,
  repeatOnEveryPage: false,
  ...extra,
})
const text = (id, page, content, x, y, width, height, style = {}) =>
  element(id, 'customText', page, x, y, width, height, {
    content,
    style: { ...baseStyle, ...style },
  })
const summary = (id, page, label, sourceId, operation, x, y) =>
  element(id, 'summary', page, x, y, 0.205, 0.075, {
    summary: { label, sourceId, operation },
    style: {
      color: '#ffffff',
      backgroundColor: '#b93f3c',
      fontSize: 10,
      alignment: 'center',
      bold: true,
    },
  })
const metric = (id, page, content, x, y) =>
  text(id, page, content, x, y, 0.205, 0.075, {
    color: '#ffffff',
    backgroundColor: '#b93f3c',
    fontSize: 10,
    alignment: 'center',
    bold: true,
  })

const elements = [
  element('title', 'title', 0, 0.06, 0.075, 0.88, 0.11, {
    style: { color: '#333333', fontSize: 30, alignment: 'left', bold: true },
  }),
  element('subtitle', 'subtitle', 0, 0.06, 0.19, 0.88, 0.045, {
    style: { color: '#666666', fontSize: 12, alignment: 'left' },
  }),
  element('date', 'date', 0, 0.7, 0.035, 0.24, 0.035, {
    style: { color: '#666666', fontSize: 8, alignment: 'right' },
  }),
  element('table', 'table', 0, 0.06, 0.25, 0.88, 0.58, {
    visible: false,
    repeatOnEveryPage: false,
  }),
  element('image', 'image', 0, 0.78, 0.08, 0.15, 0.1, { visible: false }),
  element('footer', 'footer', 0, 0.06, 0.955, 0.7, 0.025, {
    repeatOnEveryPage: true,
    style: { color: '#666666', fontSize: 7, alignment: 'left' },
  }),
  element('pageNumber', 'pageNumber', 0, 0.78, 0.955, 0.16, 0.025, {
    repeatOnEveryPage: true,
    style: { color: '#666666', fontSize: 7, alignment: 'right' },
  }),

  text(
    'cover-company',
    0,
    'TECHNOVA COMÉRCIO DE INFORMÁTICA LTDA.',
    0.06,
    0.03,
    0.58,
    0.035,
    {
      fontSize: 10,
      bold: true,
    },
  ),
  text(
    'cover-info',
    0,
    'Responsável: Área Comercial e Controladoria\nTipo: Relatório gerencial demonstrativo\nEmissão: 04/10/2026',
    0.06,
    0.27,
    0.88,
    0.1,
    { backgroundColor: '#f0f0f0', fontSize: 10 },
  ),
  text(
    'cover-summary-title',
    0,
    'RESUMO DO DOCUMENTO',
    0.06,
    0.41,
    0.88,
    0.04,
    { fontSize: 14, bold: true },
  ),
  text(
    'cover-summary',
    0,
    'Consolidação demonstrativa das vendas de computadores, com faturamento, custos, lucro bruto, margem, desempenho por produto e distribuição por categoria. Todos os valores e nomes são fictícios.',
    0.06,
    0.46,
    0.88,
    0.105,
    { fontSize: 10 },
  ),
  summary('cover-revenue', 0, 'Faturamento', 'column-4', 'sum', 0.06, 0.62),
  summary('cover-quantity', 0, 'Unidades', 'column-2', 'sum', 0.285, 0.62),
  summary('cover-profit', 0, 'Lucro bruto', 'column-6', 'sum', 0.51, 0.62),
  metric('cover-margin', 0, 'Margem bruta: 26,6%', 0.735, 0.62),
  text(
    'cover-note',
    0,
    'DOCUMENTO DEMONSTRATIVO — NÃO UTILIZAR PARA FINS FISCAIS OU CONTÁBEIS.',
    0.06,
    0.82,
    0.88,
    0.04,
    { color: '#b93f3c', fontSize: 9, bold: true, alignment: 'center' },
  ),

  text('executive-title', 1, '1. RESUMO EXECUTIVO', 0.06, 0.055, 0.88, 0.055, {
    fontSize: 19,
    bold: true,
  }),
  text(
    'executive-copy',
    1,
    'No período analisado foram comercializadas 89 unidades, gerando faturamento bruto de R$ 440.421,00. O custo consolidado foi de R$ 323.340,00, resultando em lucro bruto de R$ 117.081,00 e margem aproximada de 26,6%.',
    0.06,
    0.12,
    0.88,
    0.095,
    { fontSize: 10 },
  ),
  summary('exec-revenue', 1, 'Faturamento', 'column-4', 'sum', 0.06, 0.235),
  summary('exec-quantity', 1, 'Unidades', 'column-2', 'sum', 0.285, 0.235),
  summary('exec-profit', 1, 'Lucro bruto', 'column-6', 'sum', 0.51, 0.235),
  metric('exec-margin', 1, 'Margem bruta: 26,6%', 0.735, 0.235),
  element('revenue-chart', 'chart', 1, 0.06, 0.35, 0.88, 0.32, {
    chart: {
      title: 'Faturamento por produto',
      chartType: 'bar',
      categorySourceId: 'column-0',
      valueSourceId: 'column-4',
      aggregation: 'sum',
      maxItems: 9,
    },
    style: { color: '#333333', backgroundColor: '#ffffff', fontSize: 9 },
  }),
  text(
    'management-reading',
    1,
    'LEITURA GERENCIAL\nOs produtos de maior valor agregado puxaram o faturamento mesmo com menor volume. As linhas de notebook apresentaram maior recorrência e sustentaram o volume de vendas.',
    0.06,
    0.72,
    0.88,
    0.13,
    { backgroundColor: '#f0f0f0', fontSize: 10, bold: true },
  ),

  text(
    'detail-title',
    2,
    '2. DETALHAMENTO DAS VENDAS',
    0.06,
    0.055,
    0.88,
    0.055,
    {
      fontSize: 19,
      bold: true,
    },
  ),
  text(
    'detail-copy',
    2,
    'Quantidade, receita, custo estimado e lucro bruto de cada produto.',
    0.06,
    0.115,
    0.88,
    0.04,
    { fontSize: 9 },
  ),
  element('detail-table', 'dataTable', 2, 0.06, 0.17, 0.88, 0.56, {
    dataTable: {
      title: 'Vendas por produto',
      sourceIds: [
        'column-0',
        'column-1',
        'column-2',
        'column-4',
        'column-5',
        'column-6',
      ],
      sortSourceId: 'column-4',
      sortDirection: 'descending',
      limit: 9,
      showRank: false,
      showTotals: true,
    },
    style: { color: '#333333', backgroundColor: '#ffffff', fontSize: 7 },
  }),
  summary('detail-revenue', 2, 'Receita total', 'column-4', 'sum', 0.06, 0.77),
  summary('detail-cost', 2, 'Custo total', 'column-5', 'sum', 0.285, 0.77),
  summary('detail-profit', 2, 'Lucro total', 'column-6', 'sum', 0.51, 0.77),
  summary('detail-units', 2, 'Unidades', 'column-2', 'sum', 0.735, 0.77),

  text(
    'mix-title',
    3,
    '3. MIX DE PRODUTOS E RANKING',
    0.06,
    0.055,
    0.88,
    0.055,
    {
      fontSize: 19,
      bold: true,
    },
  ),
  element('mix-chart', 'chart', 3, 0.06, 0.14, 0.38, 0.34, {
    chart: {
      title: 'Participação por categoria',
      chartType: 'pie',
      categorySourceId: 'column-1',
      valueSourceId: 'column-4',
      aggregation: 'sum',
      maxItems: 8,
    },
    style: { color: '#333333', backgroundColor: '#ffffff', fontSize: 8 },
  }),
  element('ranking-table', 'dataTable', 3, 0.47, 0.14, 0.47, 0.5, {
    dataTable: {
      title: 'Ranking por faturamento',
      sourceIds: ['column-0', 'column-4', 'column-2', 'column-6'],
      sortSourceId: 'column-4',
      sortDirection: 'descending',
      limit: 9,
      showRank: true,
      showTotals: false,
    },
    style: { color: '#333333', backgroundColor: '#ffffff', fontSize: 7 },
  }),
  text(
    'highlights',
    3,
    'DESTAQUES\n• Maior faturamento: Notebook Pro X14.\n• Maior preço unitário: Workstation Creator.\n• Maior volume: Notebook Pro X14, com 18 unidades.\n• Oportunidade: ampliar kits, garantias e acessórios de maior margem.',
    0.06,
    0.69,
    0.88,
    0.17,
    { backgroundColor: '#f0f0f0', fontSize: 10, bold: true },
  ),

  text(
    'closing-title',
    4,
    '4. FECHAMENTO FINANCEIRO E RECOMENDAÇÕES',
    0.06,
    0.055,
    0.88,
    0.06,
    {
      fontSize: 18,
      bold: true,
    },
  ),
  summary('closing-revenue', 4, 'Receita bruta', 'column-4', 'sum', 0.06, 0.15),
  summary('closing-cost', 4, 'Custo', 'column-5', 'sum', 0.285, 0.15),
  summary('closing-profit', 4, 'Lucro bruto', 'column-6', 'sum', 0.51, 0.15),
  metric('closing-margin', 4, 'Margem bruta: 26,6%', 0.735, 0.15),
  element('profit-formula', 'formula', 4, 0.06, 0.25, 0.42, 0.065, {
    formula: {
      label: 'Receita menos custo',
      leftSourceId: 'column-4',
      rightSourceId: 'column-5',
      operator: 'subtract',
      aggregation: 'sum',
    },
    style: {
      color: '#333333',
      backgroundColor: '#f0f0f0',
      fontSize: 11,
      alignment: 'left',
      bold: true,
    },
  }),
  text(
    'recommendations',
    4,
    'RECOMENDAÇÕES GERENCIAIS\n1. Priorizar produtos com boa combinação de margem e volume.\n2. Criar ofertas com monitor, periféricos e garantia estendida.\n3. Acompanhar margem por canal para identificar descontos excessivos.\n4. Definir estoque mínimo com base no giro e prazo de reposição.\n5. Monitorar mensalmente faturamento, custo, lucro, margem e ticket médio.',
    0.06,
    0.35,
    0.88,
    0.25,
    { fontSize: 10, bold: true },
  ),
  text(
    'methodology',
    4,
    'OBSERVAÇÕES METODOLÓGICAS\nO lucro apresentado é bruto e corresponde à diferença entre receita e custo dos equipamentos. Impostos, fretes, comissões, taxas e outras despesas operacionais não foram considerados.',
    0.06,
    0.66,
    0.88,
    0.15,
    { backgroundColor: '#f0f0f0', fontSize: 9 },
  ),
  text('report-end', 4, 'FIM DO RELATÓRIO', 0.06, 0.86, 0.88, 0.04, {
    color: '#b93f3c',
    fontSize: 10,
    bold: true,
    alignment: 'center',
  }),
]

const template = {
  version: 1,
  configuration: {
    pageCount: 5,
    title: 'RELATÓRIO DE VENDAS DE COMPUTADORES',
    subtitle: 'Período de referência: Setembro de 2026',
    showDate: true,
    showTime: false,
    footerText: 'Relatório demonstrativo — dados fictícios',
    showPageNumbers: true,
    orientation: 'portrait',
    marginMm: 12,
    colors: {
      background: '#ffffff',
      title: '#333333',
      subtitle: '#666666',
      tableHeader: '#b93f3c',
      tableHeaderText: '#ffffff',
      cell: '#ffffff',
      cellText: '#333333',
      border: '#d8d8d8',
    },
    titleFontSize: 30,
    subtitleFontSize: 12,
    bodyFontSize: 8,
    titleAlignment: 'left',
    rowHeightMm: 7,
    cellPaddingMm: 1.5,
    columns,
  },
  elements,
}

fs.writeFileSync(
  path.join(
    exampleDirectory,
    'relatorio-vendas-computadores.report-template.json',
  ),
  `${JSON.stringify(template, null, 2)}\n`,
  'utf8',
)
