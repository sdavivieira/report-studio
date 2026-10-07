import { isEmptyCell } from '../../domain/workbook/Workbook'
import type { CellValue } from '../../domain/workbook/Workbook'
import type {
  CleaningOptions,
  CleaningSummary,
} from '../../domain/workbook/CleaningOptions'
import {
  parseCalendarDate,
  parsePlainNumber,
} from '../../domain/workbook/normalizeCell'

export function createValueConverter(
  options: CleaningOptions,
  summary: CleaningSummary,
) {
  const numericColumns = new Set(options.numericColumns)
  const dateColumns = new Set(options.dateColumns)

  function convertNumber(value: string): CellValue {
    const number = parsePlainNumber(value, options.decimalSeparator)
    if (number === null) {
      summary.preservedNumbers++
      return value
    }
    if (options.convertNumbers) {
      summary.convertedNumbers++
      return number
    }
    return value.replace(
      options.decimalSeparator,
      options.targetDecimalSeparator,
    )
  }

  function convertDate(value: string): CellValue {
    const date = parseCalendarDate(value, options.dateFormat)
    if (date === null) {
      summary.preservedDates++
      return value
    }
    summary.convertedDates++
    return date
  }

  return (cell: CellValue, columnId: string): CellValue => {
    if (isEmptyCell(cell))
      return options.fillEmpty && options.fillValue !== ''
        ? options.fillValue
        : cell
    if (typeof cell !== 'string') return cell
    if (
      numericColumns.has(columnId) &&
      (options.convertNumbers || options.normalizeDecimals)
    )
      return convertNumber(cell)
    if (dateColumns.has(columnId) && options.normalizeDates)
      return convertDate(cell)
    return cell
  }
}
