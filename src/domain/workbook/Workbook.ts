export type CellValue =
  string | number | boolean | Date | null | { error: string }
export type WorkbookRow = readonly CellValue[]

export interface Worksheet {
  name: string
  rows: readonly WorkbookRow[]
}

export interface Workbook {
  fileName: string
  fileSize: number
  sheets: readonly Worksheet[]
}

export interface WorkbookColumn {
  id: string
  index: number
  sourceColumnIndex?: number
  label: string
  headerValue: CellValue
}

export interface WorksheetData {
  name: string
  headerRow: number
  columns: readonly WorkbookColumn[]
  rows: readonly WorkbookRow[]
  sourceRowNumbers?: readonly number[]
}

export type IssueSeverity = 'error' | 'warning' | 'suggestion'

export interface WorkbookIssue {
  code: string
  severity: IssueSeverity
  message: string
  suggestion: string
  autoFixable: boolean
  count: number
  row?: number
  column?: number
}

export interface ImportLimits {
  maxBytes: number
  maxRows: number
  maxColumns: number
  maxCells: number
  maxSheets: number
  timeoutMs: number
}

export const DEFAULT_IMPORT_LIMITS: Readonly<ImportLimits> = {
  maxBytes: 20 * 1024 * 1024,
  maxRows: 50_000,
  maxColumns: 256,
  maxCells: 1_000_000,
  maxSheets: 50,
  timeoutMs: 30_000,
}

export type ImportErrorCode =
  | 'extension'
  | 'mime'
  | 'size'
  | 'empty'
  | 'parse'
  | 'limits'
  | 'timeout'
  | 'read'
export type ImportResult =
  | { ok: true; workbook: Workbook }
  | { ok: false; code: ImportErrorCode; message: string }

export const isEmptyCell = (cell: CellValue | undefined): boolean =>
  cell == null || (typeof cell === 'string' && cell.trim() === '')

export function formatCell(cell: CellValue | undefined): string {
  if (cell == null) return ''
  if (cell instanceof Date)
    return cell.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  if (typeof cell === 'object') return cell.error
  if (typeof cell === 'boolean') return cell ? 'Sim' : 'Não'
  return String(cell)
}
