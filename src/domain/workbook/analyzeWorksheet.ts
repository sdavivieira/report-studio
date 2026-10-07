import { formatCell, isEmptyCell } from './Workbook'
import type { CellValue, WorkbookIssue, WorksheetData } from './Workbook'

function valueType(cell: CellValue): string {
  if (cell instanceof Date) return 'date'
  return typeof cell
}

export function analyzeWorksheet(data: WorksheetData): WorkbookIssue[] {
  const findings = new Map<string, WorkbookIssue>()
  const add = (issue: Omit<WorkbookIssue, 'count'>) => {
    const key = `${issue.code}:${issue.column ?? ''}`
    const previous = findings.get(key)
    if (previous) previous.count++
    else findings.set(key, { ...issue, count: 1 })
  }
  if (
    !data.columns.length ||
    (data.rows.every((row) => row.every(isEmptyCell)) &&
      data.columns.every((c) => isEmptyCell(c.headerValue)))
  ) {
    add({
      code: 'EMPTY_SHEET',
      severity: 'error',
      message: 'A aba está vazia.',
      suggestion: 'Selecione uma aba com dados.',
      autoFixable: false,
    })
    return [...findings.values()]
  }
  if (!data.rows.length)
    add({
      code: 'NO_DATA',
      severity: 'error',
      message: 'Não há linhas de dados após o cabeçalho.',
      suggestion: 'Escolha outra linha de cabeçalho ou outra aba.',
      autoFixable: false,
    })
  if (data.rows.length > 10_000)
    add({
      code: 'MANY_ROWS',
      severity: 'warning',
      message: 'Esta aba tem mais de 10.000 linhas.',
      suggestion:
        'A prévia é limitada; todas as linhas permanecem disponíveis.',
      autoFixable: false,
    })
  if (data.columns.length > 30)
    add({
      code: 'MANY_COLUMNS',
      severity: 'warning',
      message: 'Esta aba tem mais de 30 colunas.',
      suggestion:
        'Selecione somente as colunas necessárias na futura configuração do relatório.',
      autoFixable: false,
    })

  const seen = new Set<string>()
  const expectedWidth = data.columns.reduce(
    (end, col) => (isEmptyCell(col.headerValue) ? end : col.index + 1),
    0,
  )
  for (const col of data.columns) {
    const name = formatCell(col.headerValue).trim().toLocaleLowerCase('pt-BR')
    const location = {
      column: (col.sourceColumnIndex ?? col.index) + 1,
      row: data.headerRow,
    }
    if (!name)
      add({
        ...location,
        code: 'EMPTY_HEADER',
        severity: 'warning',
        message: 'Cabeçalho vazio; um nome provisório é exibido.',
        suggestion: 'Defina um nome para a coluna ao configurar o relatório.',
        autoFixable: false,
      })
    else if (seen.has(name))
      add({
        ...location,
        code: 'DUPLICATE_HEADER',
        severity: 'warning',
        message: 'Cabeçalho duplicado.',
        suggestion:
          'Diferencie os nomes das colunas antes de mapear um modelo.',
        autoFixable: true,
      })
    seen.add(name)
    const types = new Set<string>()
    const decimals = new Set<string>()
    const dateStyles = new Set<string>()
    let nonEmpty = 0
    for (let index = 0; index < data.rows.length; index++) {
      const cell = data.rows[index]?.[col.index] ?? null
      if (isEmptyCell(cell)) continue
      nonEmpty++
      types.add(valueType(cell))
      const position = {
        row: data.sourceRowNumbers?.[index] ?? data.headerRow + index + 1,
        column: (col.sourceColumnIndex ?? col.index) + 1,
      }
      if (cell instanceof Date) dateStyles.add('native')
      else if (typeof cell === 'object' && cell !== null)
        add({
          ...position,
          code: 'CELL_ERROR',
          severity: 'warning',
          message: 'Célula com erro ou fórmula sem valor calculado.',
          suggestion: 'Revise a célula no Excel e salve os valores calculados.',
          autoFixable: false,
        })
      if (typeof cell !== 'string') continue
      if (
        cell !== cell.trim() ||
        /\s{2,}/.test(cell) ||
        /[\u200B-\u200D\uFEFF]/.test(cell)
      )
        add({
          ...position,
          code: 'EXTRA_SPACES',
          severity: 'suggestion',
          message: 'Espaços desnecessários ou caracteres invisíveis.',
          suggestion: 'Revise a limpeza de espaços antes de aplicar.',
          autoFixable: true,
        })
      if (/^[+-]?\d+(?:[.,]\d+)?$/.test(cell.trim())) {
        add({
          ...position,
          code: 'NUMBER_AS_TEXT',
          severity: 'suggestion',
          message: 'Possível número armazenado como texto.',
          suggestion:
            'Confirme a conversão; códigos e zeros à esquerda podem ser intencionais.',
          autoFixable: true,
        })
        if (cell.includes(',')) decimals.add(',')
        if (cell.includes('.')) decimals.add('.')
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(cell)) dateStyles.add('iso')
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(cell)) dateStyles.add('slash')
    }
    const position = { column: (col.sourceColumnIndex ?? col.index) + 1 }
    if (!nonEmpty && data.rows.length)
      add({
        ...position,
        code: 'EMPTY_COLUMN',
        severity: 'suggestion',
        message: 'Coluna sem valores nas linhas de dados.',
        suggestion: 'Considere remover a coluna da cópia de trabalho.',
        autoFixable: true,
      })
    if (types.size > 1)
      add({
        ...position,
        code: 'MIXED_TYPES',
        severity: 'warning',
        message: 'A coluna contém tipos de dados diferentes.',
        suggestion: 'Revise os valores antes de escolher um formato.',
        autoFixable: false,
      })
    if (decimals.size > 1)
      add({
        ...position,
        code: 'MIXED_DECIMALS',
        severity: 'warning',
        message: 'Separadores decimais diferentes na mesma coluna.',
        suggestion: 'Confirme qual separador representa os decimais.',
        autoFixable: true,
      })
    if (dateStyles.size > 1)
      add({
        ...position,
        code: 'MIXED_DATES',
        severity: 'warning',
        message: 'Representações de data diferentes na mesma coluna.',
        suggestion: 'Confirme o formato de origem antes de normalizar datas.',
        autoFixable: true,
      })
  }
  data.rows.forEach((row, index) => {
    if (row.every(isEmptyCell))
      add({
        row: data.sourceRowNumbers?.[index] ?? data.headerRow + index + 1,
        code: 'EMPTY_ROW',
        severity: 'suggestion',
        message: 'Linha completamente vazia.',
        suggestion: 'Considere remover a linha da cópia de trabalho.',
        autoFixable: true,
      })
    else if (
      row.some((cell, column) => column >= expectedWidth && !isEmptyCell(cell))
    )
      add({
        row: data.sourceRowNumbers?.[index] ?? data.headerRow + index + 1,
        code: 'EXTRA_CELLS',
        severity: 'warning',
        message: 'Há valores além da última coluna com cabeçalho.',
        suggestion: 'Verifique a linha de cabeçalho e as células adicionais.',
        autoFixable: false,
      })
  })
  return [...findings.values()]
}
