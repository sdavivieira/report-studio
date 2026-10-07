import { isEmptyCell } from '../../domain/workbook/Workbook'
import type { CellValue, WorksheetData } from '../../domain/workbook/Workbook'
import type {
  CellChange,
  CleaningOptions,
  CleaningPlan,
  CleaningSummary,
} from '../../domain/workbook/CleaningOptions'
import { cleanText, sameCell } from '../../domain/workbook/normalizeCell'
import { cleanHeaders } from '../../domain/workbook/cleanHeaders'
import { createValueConverter } from './convertSelectedValues'

const operationLabels: Partial<Record<keyof CleaningOptions, string>> = {
  trimSpaces: 'Aparar espaços',
  collapseSpaces: 'Normalizar espaços repetidos',
  removeInvisible: 'Remover caracteres invisíveis',
  removeEmptyRows: 'Remover linhas vazias',
  removeEmptyColumns: 'Remover colunas vazias',
  renameDuplicateHeaders: 'Renomear cabeçalhos duplicados',
  fillEmpty: 'Preencher células vazias',
  normalizeDecimals: 'Normalizar separador decimal',
  convertNumbers: 'Converter números',
  normalizeDates: 'Normalizar datas',
}

export interface CleaningProcessor {
  prepare(data: WorksheetData, options: CleaningOptions): Promise<CleaningPlan>
}

function createSummary(options: CleaningOptions): CleaningSummary {
  return {
    changedCells: 0,
    removedRows: 0,
    removedColumns: 0,
    removedCells: 0,
    convertedNumbers: 0,
    convertedDates: 0,
    preservedNumbers: 0,
    preservedDates: 0,
    operations: Object.entries(operationLabels)
      .filter(([key]) => options[key as keyof CleaningOptions] === true)
      .map(([, label]) => label),
  }
}

export function prepareCleaning(
  worksheet: WorksheetData,
  options: CleaningOptions,
): CleaningPlan {
  const summary = createSummary(options)
  const samples: CellChange[] = []
  const sourceRowNumber = (index: number) =>
    worksheet.sourceRowNumbers?.[index] ?? worksheet.headerRow + index + 1

  function recordChange(
    before: CellValue,
    after: CellValue,
    row: number,
    column: number,
  ) {
    if (sameCell(before, after)) return
    summary.changedCells++
    if (samples.length < 50) samples.push({ row, column, before, after })
  }

  const normalizedRows = worksheet.rows.map((row) =>
    worksheet.columns.map((column) =>
      cleanText(row[column.index] ?? null, options),
    ),
  )
  const retainedRowIndexes: number[] = []
  const removedRowNumbers: number[] = []

  normalizedRows.forEach((row, index) => {
    if (options.removeEmptyRows && row.every(isEmptyCell)) {
      summary.removedRows++
      if (removedRowNumbers.length < 20)
        removedRowNumbers.push(sourceRowNumber(index))
    } else retainedRowIndexes.push(index)
  })

  const retainedColumns = worksheet.columns.filter(
    (column) =>
      !options.removeEmptyColumns ||
      !normalizedRows.length ||
      !normalizedRows.every((row) => isEmptyCell(row[column.index])),
  )
  summary.removedColumns = worksheet.columns.length - retainedColumns.length
  summary.removedCells =
    summary.removedRows * worksheet.columns.length +
    summary.removedColumns * (retainedRowIndexes.length + 1)

  const columns = cleanHeaders(retainedColumns, options)
  columns.forEach((column, index) => {
    const before = retainedColumns[index]?.headerValue ?? null
    recordChange(
      before,
      column.headerValue,
      worksheet.headerRow,
      (column.sourceColumnIndex ?? column.index) + 1,
    )
  })

  const convertValue = createValueConverter(options, summary)
  const rows = retainedRowIndexes.map((rowIndex) =>
    retainedColumns.map((column) => {
      const normalizedValue = normalizedRows[rowIndex]?.[column.index] ?? null
      const value = convertValue(normalizedValue, column.id)
      recordChange(
        worksheet.rows[rowIndex]?.[column.index] ?? null,
        value,
        sourceRowNumber(rowIndex),
        (column.sourceColumnIndex ?? column.index) + 1,
      )
      return value
    }),
  )

  const retainedColumnIds = new Set(retainedColumns.map((column) => column.id))
  return {
    data: {
      ...worksheet,
      columns,
      rows,
      sourceRowNumbers: retainedRowIndexes.map(sourceRowNumber),
    },
    summary,
    samples,
    removedRowNumbers,
    removedColumnNames: worksheet.columns
      .filter((column) => !retainedColumnIds.has(column.id))
      .map((column) => column.label),
  }
}
