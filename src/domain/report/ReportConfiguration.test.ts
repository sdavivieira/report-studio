import { describe, expect, it } from 'vitest'
import {
  availablePageWidth,
  createDefaultReportConfiguration,
  formatReportValue,
  moveReportColumn,
  validateReportConfiguration,
} from './ReportConfiguration'

const columns = [
  { id: 'name', index: 0, label: 'Nome', headerValue: 'Nome' },
  { id: 'value', index: 1, label: 'Valor', headerValue: 'Valor' },
]

describe('report configuration', () => {
  it('creates a valid, readable default from worksheet columns', () => {
    const configuration = createDefaultReportConfiguration(columns)
    expect(configuration.columns.map((column) => column.label)).toEqual([
      'Nome',
      'Valor',
    ])
    expect(validateReportConfiguration(configuration)).toEqual([])
    expect(availablePageWidth(configuration)).toBe(180)
  })

  it('validates each width while allowing many columns to fit proportionally', () => {
    const configuration = createDefaultReportConfiguration(columns)
    configuration.columns = configuration.columns.map((column) => ({
      ...column,
      widthMm: 120,
    }))
    expect(validateReportConfiguration(configuration)).toEqual([])
    configuration.columns[0]!.widthMm = 121
    expect(validateReportConfiguration(configuration)).toContain(
      'Use larguras entre 8 e 120 mm nas colunas visíveis.',
    )
    configuration.columns = configuration.columns.map((column) => ({
      ...column,
      visible: false,
    }))
    expect(validateReportConfiguration(configuration)).toContain(
      'Selecione ao menos uma coluna.',
    )
  })

  it('allows narrow content because cells wrap instead of overflowing', () => {
    const configuration = createDefaultReportConfiguration(columns)
    configuration.cellPaddingMm = 10
    configuration.bodyFontSize = 18
    configuration.columns = configuration.columns.map((column) => ({
      ...column,
      widthMm: 8,
    }))
    expect(validateReportConfiguration(configuration)).toEqual([])
  })

  it('reorders columns without mutating the source array', () => {
    const configuration = createDefaultReportConfiguration(columns)
    const reordered = moveReportColumn(configuration.columns, 'value', -1)
    expect(reordered.map((column) => column.sourceId)).toEqual([
      'value',
      'name',
    ])
    expect(configuration.columns[0]?.sourceId).toBe('name')
  })

  it('formats numbers, dates, booleans and errors for the report', () => {
    const column = createDefaultReportConfiguration(columns).columns[0]!
    expect(
      formatReportValue(12.5, { ...column, numberFormat: 'decimal' }),
    ).toBe('12,50')
    expect(
      formatReportValue(0.266, { ...column, numberFormat: 'percentage' }),
    ).toBe('26,6%')
    expect(
      formatReportValue(new Date(Date.UTC(2024, 1, 29)), {
        ...column,
        dateFormat: 'short',
      }),
    ).toBe('29/02/2024')
    expect(formatReportValue(true, column)).toBe('Sim')
    expect(formatReportValue({ error: '#N/A' }, column)).toBe('#N/A')
  })
})
