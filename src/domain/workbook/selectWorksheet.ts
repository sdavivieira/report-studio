import { formatCell } from './Workbook'
import type { CellValue, Worksheet, WorksheetData } from './Workbook'

function copyCell(cell: CellValue): CellValue {
  if (cell instanceof Date) return new Date(cell.getTime())
  if (typeof cell === 'object' && cell !== null) return { ...cell }
  return cell
}

export function selectWorksheet(
  sheet: Worksheet,
  headerRow: number,
): WorksheetData {
  const safeHeader = Math.min(
    Math.max(Math.trunc(headerRow) || 1, 1),
    Math.max(sheet.rows.length, 1),
  )
  const width = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const header = sheet.rows[safeHeader - 1] ?? []
  return {
    name: sheet.name,
    headerRow: safeHeader,
    sourceRowNumbers: sheet.rows
      .slice(safeHeader)
      .map((_, index) => safeHeader + index + 1),
    columns: Array.from({ length: width }, (_, index) => ({
      id: `column-${index}`,
      index,
      label: formatCell(header[index]) || `Coluna ${index + 1}`,
      headerValue: copyCell(header[index] ?? null),
    })),
    rows: sheet.rows.slice(safeHeader).map((row) => row.map(copyCell)),
  }
}
