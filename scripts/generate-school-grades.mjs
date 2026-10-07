/* global console */

import fs from 'node:fs/promises'
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool'

const outputDirectory = 'output/spreadsheets'
await fs.mkdir(outputDirectory, { recursive: true })

const workbook = Workbook.create()
const sheet = workbook.worksheets.add('Boletim')
sheet.showGridLines = false
sheet.freezePanes.freezeRows(1)
sheet.getRange('A1:L7').values = [
  [
    'Aluno',
    'Matrícula',
    'Turma',
    'Turno',
    'Disciplina',
    'Nota 1',
    'Nota 2',
    'Média',
    'Faltas',
    'Situação',
    'Média geral',
    'Total de faltas',
  ],
  [
    'Mariana Oliveira',
    'ALU-2026-047',
    '8º Ano A',
    'Manhã',
    'Língua Portuguesa',
    8.4,
    9.1,
    8.75,
    0,
    'Aprovado',
    8.63,
    6,
  ],
  [
    null,
    null,
    null,
    null,
    'Matemática',
    7.8,
    8.6,
    8.2,
    1,
    'Aprovado',
    null,
    null,
  ],
  [
    null,
    null,
    null,
    null,
    'Ciências',
    9.3,
    9.0,
    9.15,
    2,
    'Aprovado',
    null,
    null,
  ],
  [
    null,
    null,
    null,
    null,
    'História',
    8.1,
    8.7,
    8.4,
    1,
    'Aprovado',
    null,
    null,
  ],
  [
    null,
    null,
    null,
    null,
    'Geografia',
    7.6,
    8.3,
    7.95,
    0,
    'Aprovado',
    null,
    null,
  ],
  [
    null,
    null,
    null,
    null,
    'Língua Inglesa',
    9.4,
    9.2,
    9.3,
    2,
    'Aprovado',
    null,
    null,
  ],
]

sheet.getRange('A1:L1').format = {
  fill: '#163A5F',
  font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
}
sheet.getRange('A2:L7').format = {
  font: { name: 'Arial', size: 10, color: '#24313D' },
  verticalAlignment: 'center',
}
sheet.getRange('F2:H7').format.numberFormat = '0.00'
sheet.getRange('K2:K7').format.numberFormat = '0.00'
sheet.getRange('I2:I7').format.numberFormat = '0'
sheet.getRange('L2:L7').format.numberFormat = '0'
sheet.getRange('A1:L7').format.borders = {
  preset: 'inside',
  style: 'thin',
  color: '#D5DEE5',
}
sheet.getRange('A1:L7').format.rowHeight = 22
sheet.getRange('A:A').format.columnWidth = 20
sheet.getRange('B:B').format.columnWidth = 17
sheet.getRange('C:D').format.columnWidth = 12
sheet.getRange('E:E').format.columnWidth = 22
sheet.getRange('F:I').format.columnWidth = 11
sheet.getRange('J:J').format.columnWidth = 14
sheet.getRange('K:L').format.columnWidth = 15

workbook.recalculate()
const inspection = await workbook.inspect({
  kind: 'table',
  range: 'Boletim!A1:L7',
  include: 'values,formulas',
  tableMaxRows: 8,
  tableMaxCols: 12,
})
console.log(inspection.ndjson)

const errorScan = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 50 },
  summary: 'school grade workbook error scan',
})
console.log(errorScan.ndjson)

const preview = await workbook.render({
  sheetName: 'Boletim',
  range: 'A1:L7',
  scale: 1.3,
  format: 'png',
})
await fs.mkdir('tmp/school-report-card', { recursive: true })
await fs.writeFile(
  'tmp/school-report-card/workbook-preview.png',
  new Uint8Array(await preview.arrayBuffer()),
)

const output = await SpreadsheetFile.exportXlsx(workbook)
await output.save(`${outputDirectory}/boletim-escolar-dados-ficticios.xlsx`)
