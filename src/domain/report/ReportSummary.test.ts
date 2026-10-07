import { describe, expect, it } from 'vitest'
import { createDefaultReportConfiguration } from './ReportConfiguration'
import { calculateSummary, summaryOperationsForColumn } from './ReportSummary'

const columns = [
  { id: 'amount', index: 0, label: 'Valor', headerValue: 'Valor' },
  { id: 'date', index: 1, label: 'Data', headerValue: 'Data' },
  { id: 'name', index: 2, label: 'Nome', headerValue: 'Nome' },
]
const data = {
  name: 'Dados',
  headerRow: 1,
  columns,
  rows: [
    [10.1, new Date(Date.UTC(2026, 0, 2)), 'A'],
    [20.2, new Date(Date.UTC(2026, 0, 1)), 'B'],
    [null, null, 'C'],
  ],
}

describe('report summaries', () => {
  const configuration = createDefaultReportConfiguration(columns)

  it('offers calculations appropriate to numeric, date and text columns', () => {
    expect(summaryOperationsForColumn(data, 'amount')).toContain('sum')
    expect(summaryOperationsForColumn(data, 'date')).toEqual([
      'minimum',
      'maximum',
      'count',
      'distinctCount',
    ])
    expect(summaryOperationsForColumn(data, 'name')).toEqual([
      'count',
      'distinctCount',
    ])
  })

  it('calculates formatted totals and dates from the complete worksheet', () => {
    expect(
      calculateSummary(
        { label: 'Total', sourceId: 'amount', operation: 'sum' },
        data,
        configuration,
      ),
    ).toBe('30,3')
    expect(
      calculateSummary(
        { label: 'Primeira', sourceId: 'date', operation: 'minimum' },
        data,
        configuration,
      ),
    ).toBe('01/01/2026')
    expect(
      calculateSummary(
        { label: 'Itens', sourceId: 'name', operation: 'count' },
        data,
        configuration,
      ),
    ).toBe('3')
    expect(
      calculateSummary(
        { label: 'Distintos', sourceId: 'name', operation: 'distinctCount' },
        data,
        configuration,
      ),
    ).toBe('3')
  })
})
