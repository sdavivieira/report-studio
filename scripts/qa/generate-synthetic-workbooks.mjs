import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  SpreadsheetFile,
  Workbook,
} from '../../tmp/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'

const root = process.cwd()
const qaRoot = path.join(root, 'tmp', 'qa', 'synthetic')
const xlsxDir = path.join(qaRoot, 'xlsx')
const previewDir = path.join(qaRoot, 'xlsx-previews')
await fs.mkdir(xlsxDir, { recursive: true })
await fs.mkdir(previewDir, { recursive: true })

const money = (value) => Number(value.toFixed(2))
const rows = (count, factory) =>
  Array.from({ length: count }, (_, index) => factory(index))

const cases = [
  {
    id: 's01-minimal',
    title: 'Cadastro mínimo',
    page: 'A5',
    orientation: 'portrait',
    pages: 1,
    headers: ['Código'],
    rows: [['MIN-001']],
    notes: ['uma coluna', 'uma linha'],
  },
  {
    id: 's02-small-sales',
    title: 'Vendas rápidas',
    page: 'A4',
    orientation: 'portrait',
    pages: 1,
    headers: ['Produto', 'Quantidade', 'Preço'],
    rows: [
      ['Café', 3, 18.9],
      ['Chá', 7, 12.5],
    ],
    notes: ['moeda', 'acentos'],
  },
  {
    id: 's03-wide-inventory',
    title: 'Estoque com muitas colunas',
    page: 'A3',
    orientation: 'landscape',
    pages: 1,
    headers: rows(
      30,
      (i) => `Indicador operacional extremamente detalhado ${i + 1}`,
    ),
    rows: [rows(30, (i) => (i % 3 === 0 ? `Item ${i + 1}` : i * 10.25))],
    notes: ['30 colunas', 'cabeçalhos longos'],
  },
  {
    id: 's04-many-pages',
    title: 'Movimentações extensas',
    page: 'A4',
    orientation: 'portrait',
    pages: 4,
    headers: ['ID', 'Descrição', 'Quantidade', 'Valor'],
    rows: rows(500, (i) => [
      `MOV-${String(i + 1).padStart(4, '0')}`,
      `Movimentação ${i + 1}`,
      i % 97,
      money(i * 3.17),
    ]),
    notes: ['500 linhas', 'quatro páginas'],
  },
  {
    id: 's05-long-text',
    title: 'Atendimentos com observações longas',
    page: 'Legal',
    orientation: 'landscape',
    pages: 2,
    headers: [
      'Protocolo',
      'Cliente',
      'Observação muito extensa para validar quebra automática dentro da célula',
    ],
    rows: rows(35, (i) => [
      `AT-${1000 + i}`,
      `Cliente ${i + 1}`,
      `${'Texto longo com contexto, pontuação e palavras extensas '.repeat(4)}fim ${i + 1}.`,
    ]),
    notes: ['texto longo', 'quebra de linha'],
  },
  {
    id: 's06-unicode',
    title: 'Cadastro internacional',
    page: 'A4',
    orientation: 'portrait',
    pages: 1,
    headers: ['Nome', 'Cidade', 'Observação'],
    rows: [
      ['João d’Ávila', 'São Luís', 'Ação, coração, maçã'],
      ['Miyuki', 'Tóquio', '日本語'],
      ['Zoë', 'München', 'naïve façade'],
    ],
    notes: ['acentos', 'unicode'],
  },
  {
    id: 's07-dates',
    title: 'Agenda de serviços',
    page: 'A4',
    orientation: 'portrait',
    pages: 2,
    headers: ['Serviço', 'Data', 'Hora', 'Prazo'],
    rows: rows(60, (i) => [
      `Serviço ${i + 1}`,
      new Date(2026, i % 12, (i % 27) + 1),
      `${String(8 + (i % 10)).padStart(2, '0')}:30`,
      i % 2 ? 'No prazo' : 'Atrasado',
    ]),
    notes: ['datas reais', 'horários'],
    dateColumns: [1],
  },
  {
    id: 's08-currencies',
    title: 'Moedas e localidades',
    page: 'A4',
    orientation: 'landscape',
    pages: 1,
    headers: ['Moeda', 'Receita', 'Despesa', 'Saldo'],
    rows: [
      ['BRL', 1234567.89, 98765.43, 1135802.46],
      ['USD', 234567.01, 34567.89, 199999.12],
      ['EUR', 199999.99, 210000.11, -10000.12],
    ],
    notes: ['moedas', 'milhares', 'negativos'],
    currencyColumns: [1, 2, 3],
  },
  {
    id: 's09-decimals',
    title: 'Medições laboratoriais',
    page: 'A4',
    orientation: 'portrait',
    pages: 1,
    headers: ['Amostra', 'Mínimo', 'Máximo', 'Média'],
    rows: [
      ['A-01', -0.0001, 0, 0.333333],
      ['A-02', -99999.99, 99999.99, 1.005],
      ['A-03', 1.234, 12.345, 6.789],
    ],
    notes: ['decimais', 'zero', 'precisão'],
  },
  {
    id: 's10-blanks',
    title: 'Dados incompletos',
    page: 'A4',
    orientation: 'portrait',
    pages: 1,
    headers: ['Nome', 'E-mail', 'Telefone', 'Status'],
    rows: [
      ['Ana', null, '21999990000', 'Pendente'],
      [null, 'sem-nome@example.com', null, ''],
      ['Carlos', '', '', 'Ativo'],
    ],
    notes: ['células vazias', 'nulos'],
  },
  {
    id: 's11-repeated',
    title: 'Valores repetidos',
    page: 'A4',
    orientation: 'landscape',
    pages: 2,
    headers: ['Grupo', 'Descrição', 'Valor'],
    rows: rows(120, (i) => [
      'Mesmo grupo',
      i % 2 ? 'Repetido' : 'Repetido',
      100,
    ]),
    notes: ['valores repetidos', 'ambiguidade de mapeamento'],
  },
  {
    id: 's12-mixed-types',
    title: 'Importação heterogênea',
    page: 'A4',
    orientation: 'portrait',
    pages: 1,
    headers: ['Chave', 'Valor', 'Ativo', 'Comentário'],
    rows: [
      ['texto', '00123', true, '=não é fórmula'],
      ['número', 123, false, '#N/A literal'],
      ['decimal', 12.34, true, 'null'],
      ['especial', '@#$%&*()', false, 'fim'],
    ],
    notes: ['booleanos', 'dados inesperados'],
  },
  {
    id: 's13-edge-fields',
    title: 'Campos nos limites',
    page: 'A4',
    orientation: 'portrait',
    pages: 1,
    headers: [
      'Superior esquerdo',
      'Superior direito',
      'Inferior esquerdo',
      'Inferior direito',
    ],
    rows: [['BORDA-SE', 'BORDA-SD', 'BORDA-IE', 'BORDA-ID']],
    notes: ['campos próximos das bordas'],
    design: 'edges',
  },
  {
    id: 's14-legal-landscape',
    title: 'Contrato de serviços',
    page: 'Legal',
    orientation: 'landscape',
    pages: 2,
    headers: [
      'Contrato',
      'Contratante',
      'Serviço',
      'Início',
      'Término',
      'Valor mensal',
      'Índice de reajuste',
    ],
    rows: rows(45, (i) => [
      `CTR-${i + 1}`,
      `Empresa ${i + 1}`,
      `Serviço recorrente ${i + 1}`,
      new Date(2026, i % 12, 1),
      new Date(2027, i % 12, 1),
      money(1000 + i * 37.5),
      0.05 + (i % 4) / 100,
    ]),
    notes: ['papel legal', 'paisagem'],
    dateColumns: [3, 4],
    currencyColumns: [5],
    percentColumns: [6],
  },
  {
    id: 's15-a5-budget',
    title: 'Orçamento compacto',
    page: 'A5',
    orientation: 'portrait',
    pages: 2,
    headers: ['Item', 'Qtd.', 'Unitário', 'Total'],
    rows: rows(28, (i) => [
      `Item ${i + 1}`,
      i + 1,
      money(9.9 + i),
      money((i + 1) * (9.9 + i)),
    ]),
    notes: ['A5', 'orçamento'],
    currencyColumns: [2, 3],
  },
  {
    id: 's16-multi-sheet',
    title: 'Consolidação multissetorial',
    page: 'A4',
    orientation: 'landscape',
    pages: 1,
    headers: ['Departamento', 'Responsável', 'Meta', 'Realizado'],
    rows: [
      ['Comercial', 'Beatriz', 100, 110],
      ['Operações', 'Rafael', 95, 92],
      ['Financeiro', 'Lívia', 98, 98],
    ],
    notes: ['múltiplas abas'],
    extraSheets: true,
  },
  {
    id: 's17-percentages',
    title: 'Indicadores gerenciais',
    page: 'A4',
    orientation: 'landscape',
    pages: 1,
    headers: ['Indicador', 'Atual', 'Meta', 'Variação'],
    rows: [
      ['Conversão', 0.237, 0.25, -0.013],
      ['SLA', 0.991, 0.98, 0.011],
      ['Retenção', 0.8765, 0.9, -0.0235],
    ],
    notes: ['percentuais'],
    percentColumns: [1, 2, 3],
  },
  {
    id: 's18-duplicate-headers',
    title: 'Cabeçalhos duplicados',
    page: 'A4',
    orientation: 'portrait',
    pages: 1,
    headers: ['Valor', 'Valor', 'Data', 'Data', ''],
    rows: [
      [10, 20, new Date(2026, 0, 1), new Date(2026, 0, 2), 'sem cabeçalho'],
      [30, 40, new Date(2026, 1, 1), new Date(2026, 1, 2), 'linha 2'],
    ],
    notes: ['cabeçalhos duplicados e vazio'],
    dateColumns: [2, 3],
  },
  {
    id: 's19-ten-thousand',
    title: 'Catálogo massivo',
    page: 'A4',
    orientation: 'landscape',
    pages: 3,
    headers: ['SKU', 'Produto', 'Categoria', 'Estoque', 'Preço'],
    rows: rows(10050, (i) => [
      `SKU-${String(i + 1).padStart(6, '0')}`,
      `Produto ${i + 1}`,
      `Categoria ${i % 20}`,
      i % 500,
      money(1 + (i % 1000) / 3),
    ]),
    notes: ['mais de 10 mil linhas'],
    currencyColumns: [4],
  },
  {
    id: 's20-fifty-columns',
    title: 'Matriz operacional',
    page: 'A3',
    orientation: 'landscape',
    pages: 3,
    headers: rows(
      50,
      (i) =>
        `C${String(i + 1).padStart(2, '0')} - ${i % 2 ? 'Texto' : 'Número'}`,
    ),
    rows: rows(100, (r) =>
      rows(50, (c) => (c % 2 ? `R${r + 1}C${c + 1}` : r * 100 + c + 0.5)),
    ),
    notes: ['50 colunas', '100 linhas'],
  },
]

for (const scenario of cases) {
  const workbook = Workbook.create()
  const sheet = workbook.worksheets.add('Dados')
  sheet.showGridLines = false
  const matrix = [scenario.headers, ...scenario.rows]
  sheet.getRangeByIndexes(0, 0, matrix.length, scenario.headers.length).values =
    matrix
  const used = sheet.getRangeByIndexes(
    0,
    0,
    matrix.length,
    scenario.headers.length,
  )
  used.format.font = { name: 'Arial', size: 10, color: '#1f2937' }
  used.format.verticalAlignment = 'center'
  const header = sheet.getRangeByIndexes(0, 0, 1, scenario.headers.length)
  header.format = {
    fill: '#174d44',
    font: { name: 'Arial', size: 10, bold: true, color: '#ffffff' },
    wrapText: true,
  }
  header.format.rowHeight = 32
  used.format.autofitColumns()
  for (let column = 0; column < scenario.headers.length; column += 1) {
    const columnRange = sheet.getRangeByIndexes(0, column, matrix.length, 1)
    if ((scenario.dateColumns ?? []).includes(column))
      columnRange.format.numberFormat = 'dd/mm/yyyy'
    if ((scenario.currencyColumns ?? []).includes(column))
      columnRange.format.numberFormat = 'R$ #,##0.00'
    if ((scenario.percentColumns ?? []).includes(column))
      columnRange.format.numberFormat = '0.00%'
  }
  sheet.freezePanes.freezeRows(1)
  if (scenario.extraSheets) {
    const summary = workbook.worksheets.add('Resumo')
    summary.getRange('A1:B4').values = [
      ['Indicador', 'Valor'],
      ['Áreas', 3],
      ['Meta total', 293],
      ['Realizado total', 300],
    ]
    const archive = workbook.worksheets.add('Arquivo')
    archive.getRange('A1:C3').values = [
      ['ID', 'Ano', 'Status'],
      ['ARQ-1', 2025, 'Fechado'],
      ['ARQ-2', 2024, 'Fechado'],
    ]
  }
  workbook.recalculate()
  const preview = await workbook.render({
    sheetName: 'Dados',
    range: `A1:${columnName(Math.min(scenario.headers.length, 12))}${Math.min(matrix.length, 24)}`,
    scale: 1,
    format: 'png',
  })
  await fs.writeFile(
    path.join(previewDir, `${scenario.id}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  )
  const exported = await SpreadsheetFile.exportXlsx(workbook)
  await exported.save(path.join(xlsxDir, `${scenario.id}.xlsx`))
}

await fs.writeFile(
  path.join(qaRoot, 'manifest.json'),
  JSON.stringify(
    cases.map((scenario) => ({
      ...scenario,
      rows: scenario.rows.slice(0, 20),
    })),
    null,
    2,
  ),
)
globalThis.console.log(`Generated ${cases.length} workbooks in ${xlsxDir}`)

function columnName(count) {
  let value = count
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}
