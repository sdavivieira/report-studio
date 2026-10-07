import { describe, expect, it } from 'vitest'
import type { ReportElement } from './ReportTemplate'
import { validateReportContent } from './ReportValidation'

const data = {
  name: 'Dados',
  headerRow: 1,
  columns: [{ id: 'name', index: 0, label: 'Nome', headerValue: 'Nome' }],
  rows: [['Ana']],
} as const

function field(overrides: Partial<ReportElement> = {}): ReportElement {
  return {
    id: 'field',
    type: 'dataField',
    visible: true,
    position: { x: 0.1, y: 0.1 },
    size: { width: 0.2, height: 0.1 },
    keepAspectRatio: false,
    style: {},
    pageIndex: 0,
    dataField: {
      sourceId: 'name',
      rowIndex: 0,
      prefix: '',
      suffix: '',
    },
    ...overrides,
  }
}

describe('report preflight validation', () => {
  it('accepts a valid mapped field', () => {
    expect(validateReportContent(data, [field()])).toEqual([
      {
        severity: 'info',
        message: 'Nenhum problema encontrado antes da exportação.',
      },
    ])
  })

  it('reports missing columns, invalid rows and strong overlaps', () => {
    const issues = validateReportContent(data, [
      field({
        id: 'missing',
        dataField: {
          sourceId: 'unknown',
          rowIndex: 4,
          prefix: '',
          suffix: '',
        },
      }),
      field({ id: 'second' }),
    ])
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true)
    expect(issues.some((issue) => issue.message.includes('sobrepostos'))).toBe(
      true,
    )
  })
})
