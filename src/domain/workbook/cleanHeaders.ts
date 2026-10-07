import { formatCell } from './Workbook'
import type { WorkbookColumn } from './Workbook'
import type { CleaningOptions } from './CleaningOptions'
import { cleanText } from './normalizeCell'

const headerKey = (label: string) => label.trim().toLocaleLowerCase('pt-BR')

export function cleanHeaders(
  columns: readonly WorkbookColumn[],
  options: CleaningOptions,
): WorkbookColumn[] {
  const values = columns.map((column) => cleanText(column.headerValue, options))
  const reservedNames = new Set(
    values.map((value) => headerKey(formatCell(value))),
  )
  const seenNames = new Set<string>()

  return columns.map((column, index) => {
    let headerValue = values[index] ?? null
    const name = formatCell(headerValue)
    const key = headerKey(name)

    if (options.renameDuplicateHeaders && key && seenNames.has(key)) {
      let suffix = 2
      while (reservedNames.has(headerKey(`${name} (${suffix})`))) suffix++
      headerValue = `${name} (${suffix})`
      reservedNames.add(headerKey(headerValue))
    }

    seenNames.add(key)
    const sourceColumnIndex = column.sourceColumnIndex ?? column.index
    return {
      ...column,
      index,
      sourceColumnIndex,
      headerValue,
      label: formatCell(headerValue) || `Coluna ${sourceColumnIndex + 1}`,
    }
  })
}
