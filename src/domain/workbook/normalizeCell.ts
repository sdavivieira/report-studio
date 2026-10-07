import type { CellValue } from './Workbook'
import type { CleaningOptions } from './CleaningOptions'

export function cleanText(
  value: CellValue,
  options: CleaningOptions,
): CellValue {
  if (typeof value !== 'string') return value
  let result = value
  if (options.removeInvisible)
    result = result.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
  if (options.trimSpaces) result = result.trim()
  if (options.collapseSpaces) result = result.replace(/[\t\u00A0 ]{2,}/g, ' ')
  return result
}

// Only plain decimal notation is accepted: no guessing of thousands separators,
// scientific notation, identifiers with leading zeros, or unsafe precision.
export function parsePlainNumber(
  value: string,
  separator: ',' | '.',
): number | null {
  const pattern =
    separator === ',' ? /^[+-]?\d+(?:,\d+)?$/ : /^[+-]?\d+(?:\.\d+)?$/
  if (!pattern.test(value)) return null
  const unsigned = value.replace(/^[+-]/, '')
  const integer = unsigned.split(separator)[0] ?? ''
  if (integer.length > 1 && integer.startsWith('0')) return null
  const significantDigits = unsigned.replace(/[.,]/, '').replace(/^0+/, '')
  if (significantDigits.length > 15) return null
  const result = Number(value.replace(',', '.'))
  const losesNonzeroValue = result === 0 && significantDigits.length > 0
  if (losesNonzeroValue) return null
  return Number.isFinite(result) && Math.abs(result) <= Number.MAX_SAFE_INTEGER
    ? result
    : null
}

export function parseCalendarDate(
  value: string,
  format: 'dmy' | 'ymd',
): Date | null {
  const match = (
    format === 'dmy'
      ? /^(\d{2})\/(\d{2})\/(\d{4})$/
      : /^(\d{4})-(\d{2})-(\d{2})$/
  ).exec(value)
  if (!match) return null
  const year = Number(format === 'dmy' ? match[3] : match[1])
  const month = Number(match[2])
  const day = Number(format === 'dmy' ? match[1] : match[3])
  if (year < 100 || year > 9999) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null
}

export function sameCell(a: CellValue, b: CellValue): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    'error' in a &&
    'error' in b
  )
    return a.error === b.error
  return a === b
}
