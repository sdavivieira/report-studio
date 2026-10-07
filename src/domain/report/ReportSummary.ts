import type { CellValue, WorksheetData } from '../workbook/Workbook'
import {
  formatReportValue,
  type ReportConfiguration,
} from './ReportConfiguration'
import type { SummaryDefinition, SummaryOperation } from './ReportTemplate'

export const SUMMARY_OPERATION_LABELS: Readonly<
  Record<SummaryOperation, string>
> = {
  sum: 'Soma',
  average: 'Média',
  minimum: 'Mínimo',
  maximum: 'Máximo',
  count: 'Contagem',
  distinctCount: 'Contagem distinta',
}

export function summaryOperationsForColumn(
  data: WorksheetData,
  sourceId: string,
): readonly SummaryOperation[] {
  const index = data.columns.find((column) => column.id === sourceId)?.index
  if (index === undefined) return ['count', 'distinctCount']
  const values = data.rows
    .map((row) => row[index])
    .filter((value) => value != null && value !== '')
  if (values.some((value) => typeof value === 'number'))
    return ['sum', 'average', 'minimum', 'maximum', 'count', 'distinctCount']
  if (values.some((value) => value instanceof Date))
    return ['minimum', 'maximum', 'count', 'distinctCount']
  return ['count', 'distinctCount']
}

export function calculateSummary(
  definition: SummaryDefinition,
  data: WorksheetData,
  configuration: ReportConfiguration,
): string {
  const sourceColumn = data.columns.find(
    (column) => column.id === definition.sourceId,
  )
  const configuredColumn = configuration.columns.find(
    (column) => column.sourceId === definition.sourceId,
  )
  if (!sourceColumn || !configuredColumn) return '—'
  const values = data.rows
    .map((row) => row[sourceColumn.index])
    .filter((value) => value != null && value !== '')
  if (definition.operation === 'count') return String(values.length)
  if (definition.operation === 'distinctCount')
    return String(new Set(values.map(distinctKey)).size)

  const comparable = values.filter(
    (value): value is number | Date =>
      typeof value === 'number' || value instanceof Date,
  )
  if (!comparable.length) return '—'
  if (definition.operation === 'sum' || definition.operation === 'average') {
    const numbers = comparable.filter(
      (value): value is number => typeof value === 'number',
    )
    if (!numbers.length) return '—'
    const sum = numbers.reduce((total, value) => total + value, 0)
    const result =
      definition.operation === 'average' ? sum / numbers.length : sum
    if (configuredColumn.numberFormat === 'automatic')
      return new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: 10,
      }).format(result)
    return formatReportValue(result, configuredColumn)
  }
  const timestamps = comparable.map((value) =>
    value instanceof Date ? value.getTime() : value,
  )
  const result =
    definition.operation === 'minimum'
      ? Math.min(...timestamps)
      : Math.max(...timestamps)
  const original = comparable.some((value) => value instanceof Date)
    ? new Date(result)
    : result
  return formatReportValue(original, configuredColumn)
}

function distinctKey(value: CellValue | undefined): string {
  if (value == null) return 'empty'
  if (value instanceof Date) return `date:${value.getTime()}`
  if (typeof value === 'object') return `error:${value.error}`
  return `${typeof value}:${String(value)}`
}
