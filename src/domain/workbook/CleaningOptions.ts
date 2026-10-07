import type { CellValue, WorksheetData } from './Workbook'

export interface CleaningOptions {
  trimSpaces: boolean
  collapseSpaces: boolean
  removeInvisible: boolean
  removeEmptyRows: boolean
  removeEmptyColumns: boolean
  renameDuplicateHeaders: boolean
  fillEmpty: boolean
  fillValue: string
  normalizeDecimals: boolean
  convertNumbers: boolean
  decimalSeparator: ',' | '.'
  targetDecimalSeparator: ',' | '.'
  numericColumns: readonly string[]
  normalizeDates: boolean
  dateFormat: 'dmy' | 'ymd'
  dateColumns: readonly string[]
}

export function defaultCleaningOptions(): CleaningOptions {
  return {
    trimSpaces: false,
    collapseSpaces: false,
    removeInvisible: false,
    removeEmptyRows: false,
    removeEmptyColumns: false,
    renameDuplicateHeaders: false,
    fillEmpty: false,
    fillValue: '',
    normalizeDecimals: false,
    convertNumbers: false,
    decimalSeparator: ',',
    targetDecimalSeparator: '.',
    numericColumns: [],
    normalizeDates: false,
    dateFormat: 'dmy',
    dateColumns: [],
  }
}

export interface CellChange {
  row: number
  column: number
  before: CellValue
  after: CellValue
}

export interface CleaningSummary {
  changedCells: number
  removedRows: number
  removedColumns: number
  removedCells: number
  convertedNumbers: number
  convertedDates: number
  preservedNumbers: number
  preservedDates: number
  operations: readonly string[]
}

export interface CleaningPlan {
  data: WorksheetData
  summary: CleaningSummary
  samples: readonly CellChange[]
  removedRowNumbers: readonly number[]
  removedColumnNames: readonly string[]
}

export type CleaningResult =
  { ok: true; plan: CleaningPlan } | { ok: false; message: string }

export function hasCleaningChanges(summary: CleaningSummary): boolean {
  return summary.changedCells + summary.removedRows + summary.removedColumns > 0
}
