import type { CellValue, WorksheetData } from '../workbook/Workbook'
import {
  formatReportValue,
  type ReportConfiguration,
} from './ReportConfiguration'
import type {
  ChartDefinition,
  DataTableColumnFormat,
  DataTableDefinition,
  FormulaDefinition,
} from './ReportTemplate'

export interface ChartSeriesItem {
  label: string
  value: number
}

export interface DataTableResult {
  headers: readonly string[]
  rows: readonly (readonly string[])[]
  totals: readonly string[] | null
  columnWeights: readonly number[]
}

export function calculateFormula(
  definition: FormulaDefinition,
  data: WorksheetData,
): string {
  const leftIndex = sourceIndex(data, definition.leftSourceId)
  const rightIndex = sourceIndex(data, definition.rightSourceId)
  if (leftIndex === undefined || rightIndex === undefined) return '—'

  const results = data.rows.flatMap((row) => {
    const left = numericValue(row[leftIndex])
    const right = numericValue(row[rightIndex])
    if (left === null || right === null) return []
    if (definition.operator === 'divide' && right === 0) return []
    return [applyFormula(left, right, definition.operator)]
  })
  if (!results.length) return '—'
  const sum = results.reduce((total, value) => total + value, 0)
  const value =
    definition.aggregation === 'average'
      ? sum / results.length
      : definition.aggregation === 'minimum'
        ? Math.min(...results)
        : definition.aggregation === 'maximum'
          ? Math.max(...results)
          : sum
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 10 }).format(
    value,
  )
}

export function calculateChartSeries(
  definition: ChartDefinition,
  data: WorksheetData,
): readonly ChartSeriesItem[] {
  const categoryIndex = sourceIndex(data, definition.categorySourceId)
  const valueIndex = sourceIndex(data, definition.valueSourceId)
  if (categoryIndex === undefined || valueIndex === undefined) return []

  const groups = new Map<string, number[]>()
  for (const row of data.rows) {
    const label = printableValue(row[categoryIndex]) || 'Sem categoria'
    const values = groups.get(label) ?? []
    if (definition.aggregation === 'count') values.push(1)
    else {
      const value = numericValue(row[valueIndex])
      if (value !== null) values.push(value)
    }
    groups.set(label, values)
  }

  return [...groups]
    .map(([label, values]) => ({
      label,
      value:
        definition.aggregation === 'average'
          ? sum(values) / Math.max(values.length, 1)
          : sum(values),
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, definition.maxItems)
}

export function calculateDataTable(
  definition: DataTableDefinition,
  data: WorksheetData,
  configuration: ReportConfiguration,
): DataTableResult {
  const columns = definition.sourceIds.flatMap((sourceId) => {
    const workbookColumn = data.columns.find((column) => column.id === sourceId)
    const configuredColumn = configuration.columns.find(
      (column) => column.sourceId === sourceId,
    )
    return workbookColumn && configuredColumn
      ? [{ workbookColumn, configuredColumn }]
      : []
  })
  const sortIndex = sourceIndex(data, definition.sortSourceId)
  const sortedRows = [...data.rows].sort((left, right) => {
    if (sortIndex === undefined || definition.sortDirection === 'original')
      return 0
    const comparison = compareValues(left[sortIndex], right[sortIndex])
    return definition.sortDirection === 'descending' ? -comparison : comparison
  })
  const limitedRows = sortedRows.slice(0, definition.limit)
  const headers = [
    ...(definition.showRank ? ['Posição'] : []),
    ...columns.map(({ configuredColumn }) => configuredColumn.label),
  ]
  const rows = limitedRows.map((row, index) => [
    ...(definition.showRank ? [String(index + 1)] : []),
    ...columns.map(({ workbookColumn, configuredColumn }, columnIndex) =>
      formatTableValue(
        row[workbookColumn.index],
        configuredColumn,
        definition.columnFormats?.[columnIndex],
      ),
    ),
  ])
  const labelColumnIndex = columns.findIndex(({ workbookColumn }) =>
    limitedRows.some((row) => numericValue(row[workbookColumn.index]) === null),
  )
  const totals = definition.showTotals
    ? [
        ...(definition.showRank ? ['Total'] : []),
        ...columns.map(({ workbookColumn, configuredColumn }, index) => {
          if (!definition.showRank && index === labelColumnIndex) return 'Total'
          const values = limitedRows
            .map((row) => numericValue(row[workbookColumn.index]))
            .filter((value): value is number => value !== null)
          return values.length
            ? formatReportValue(sum(values), configuredColumn)
            : ''
        }),
      ]
    : null
  return {
    headers,
    rows,
    totals,
    columnWeights: dataTableColumnWeights(definition, columns.length),
  }
}

function formatTableValue(
  value: CellValue | undefined,
  configuredColumn: ReportConfiguration['columns'][number],
  detected: DataTableColumnFormat | undefined,
): string {
  if (typeof value !== 'number' || !detected)
    return formatReportValue(value, configuredColumn)
  const numericValue = detected.suffix.trim() === '%' ? value * 100 : value
  const fractionDigits = detected.fractionDigits ?? 0
  const [integer = '0', fraction] = numericValue
    .toFixed(fractionDigits)
    .split('.')
  const grouped = detected.thousandsSeparator
    ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, detected.thousandsSeparator)
    : integer
  const formatted = fraction
    ? `${grouped}${detected.decimalSeparator ?? '.'}${fraction}`
    : grouped
  return `${detected.prefix}${formatted}${detected.suffix}`
}

export function dataTableColumnWeights(
  definition: DataTableDefinition,
  sourceColumnCount = definition.sourceIds.length,
): readonly number[] {
  const configured = definition.columnWidths?.slice(0, sourceColumnCount) ?? []
  const sourceWeights = Array.from({ length: sourceColumnCount }, (_, index) =>
    Math.max(1, configured[index] ?? 100 / Math.max(1, sourceColumnCount)),
  )
  const weights = definition.showRank ? [12, ...sourceWeights] : sourceWeights
  const total = sum(weights)
  return weights.map((weight) => weight / Math.max(1, total))
}

function sourceIndex(
  data: WorksheetData,
  sourceId: string,
): number | undefined {
  return data.columns.find((column) => column.id === sourceId)?.index
}

function numericValue(value: CellValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function printableValue(value: CellValue | undefined): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toLocaleDateString('pt-BR')
  if (typeof value === 'object') return value.error
  return String(value)
}

function applyFormula(
  left: number,
  right: number,
  operator: FormulaDefinition['operator'],
): number {
  if (operator === 'add') return left + right
  if (operator === 'subtract') return left - right
  if (operator === 'multiply') return left * right
  if (operator === 'percentage') return right === 0 ? 0 : (left / right) * 100
  return left / right
}

function compareValues(
  left: CellValue | undefined,
  right: CellValue | undefined,
) {
  const leftNumber = left instanceof Date ? left.getTime() : numericValue(left)
  const rightNumber =
    right instanceof Date ? right.getTime() : numericValue(right)
  if (leftNumber !== null && rightNumber !== null)
    return leftNumber - rightNumber
  return printableValue(left).localeCompare(printableValue(right), 'pt-BR')
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
