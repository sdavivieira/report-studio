import { describe, expect, it } from 'vitest'
import { createDefaultReportConfiguration } from '../../domain/report/ReportConfiguration'
import { createDefaultReportElements } from '../../domain/report/ReportLayout'
import {
  applyTemplateColumnMapping,
  createReportTemplate,
  parseReportTemplate,
  serializeReportTemplate,
} from './ReportTemplateFiles'

const data = {
  name: 'Dados',
  headerRow: 1,
  columns: [
    { id: 'column-0', index: 0, label: 'Produto', headerValue: 'Produto' },
    { id: 'column-1', index: 1, label: 'Valor', headerValue: 'Valor' },
  ],
  rows: [['Café', 20]],
} as const

describe('report template files', () => {
  it('serializes versioned settings without worksheet rows', () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    const template = createReportTemplate(
      configuration,
      createDefaultReportElements(data, configuration),
      null,
      false,
    )
    const serialized = serializeReportTemplate(template)
    expect(serialized).toContain('"version": 1')
    expect(serialized).not.toContain('Café')
    expect(parseReportTemplate(serialized, data).ok).toBe(true)
  })

  it('rejects unknown fields and incompatible versions', () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    const template = createReportTemplate(
      configuration,
      createDefaultReportElements(data, configuration),
      null,
      false,
    )
    expect(
      parseReportTemplate(
        JSON.stringify({ ...template, unexpected: true }),
        data,
      ),
    ).toMatchObject({ ok: false })
    expect(
      parseReportTemplate(JSON.stringify({ ...template, version: 99 }), data),
    ).toEqual({
      ok: false,
      message:
        'Versão de modelo incompatível. Esta aplicação aceita a versão 1.',
    })
  })

  it('reports missing columns and applies an explicit mapping', () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    const template = createReportTemplate(
      configuration,
      createDefaultReportElements(data, configuration),
      null,
      false,
    )
    const otherData = {
      ...data,
      columns: [
        { id: 'new-0', index: 0, label: 'Item', headerValue: 'Item' },
        { id: 'new-1', index: 1, label: 'Total', headerValue: 'Total' },
      ],
    }
    const result = parseReportTemplate(
      serializeReportTemplate(template),
      otherData,
    )
    expect(result.ok && result.missingColumns).toEqual(['column-0', 'column-1'])
    const mapped = applyTemplateColumnMapping(template, {
      'column-0': 'new-0',
      'column-1': 'new-1',
    })
    expect(
      mapped.configuration.columns.map((column) => column.sourceId),
    ).toEqual(['new-0', 'new-1'])
  })
})
