import { describe, expect, it } from 'vitest'
import { createDefaultReportConfiguration } from '../../domain/report/ReportConfiguration'
import { createBatchReportPdf, createReportPdf } from './createReportPdf'

const data = {
  name: 'Dados',
  headerRow: 1,
  columns: [{ id: 'a', index: 0, label: 'Nome', headerValue: 'Nome' }],
  rows: [['Ação']],
} as const

describe('PDF generation use case', () => {
  it('validates before rendering and returns a safe download', async () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    configuration.title = 'Relatório de Ações / 2026'
    const result = await createReportPdf(data, configuration, {
      render: async () => ({ bytes: new Uint8Array([1, 2, 3]), pageCount: 2 }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fileName).toBe('relatorio-de-acoes-2026.pdf')
    expect(result.blob.type).toBe('application/pdf')
    expect(result.pageCount).toBe(2)
  })

  it('does not call the renderer for invalid configuration', async () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    configuration.title = ''
    let called = false
    const result = await createReportPdf(data, configuration, {
      render: async () => {
        called = true
        return { bytes: new Uint8Array([1]), pageCount: 1 }
      },
    })
    expect(result).toEqual({
      ok: false,
      message: 'Informe o título do relatório.',
    })
    expect(called).toBe(false)
  })

  it('reports renderer failures without exposing an exception', async () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    const result = await createReportPdf(data, configuration, {
      render: async () => {
        throw new Error('fonte indisponível')
      },
    })
    expect(result).toEqual({
      ok: false,
      message: 'Não foi possível gerar o PDF: fonte indisponível',
    })
  })

  it('generates one report per selected row and merges the pages', async () => {
    const batchData = { ...data, rows: [['Ação'], ['Café'], ['Chá']] }
    const configuration = createDefaultReportConfiguration(batchData.columns)
    const renderedRows: string[] = []
    const progress: number[] = []
    const result = await createBatchReportPdf(
      batchData,
      configuration,
      {
        render: async (request) => {
          renderedRows.push(String(request.data.rows[0]?.[0]))
          return { bytes: new Uint8Array([renderedRows.length]), pageCount: 1 }
        },
      },
      {
        merge: async (documents) =>
          new Uint8Array(documents.flatMap((document) => [...document])),
      },
      [],
      null,
      null,
      1,
      2,
      (completed) => progress.push(completed),
    )
    expect(result.ok).toBe(true)
    expect(renderedRows).toEqual(['Café', 'Chá'])
    expect(progress).toEqual([1, 2])
    if (result.ok) {
      expect(result.pageCount).toBe(2)
      expect(result.fileName).toContain('lote-2-3')
    }
  })

  it('stops a batch when a record produces an empty PDF', async () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    let mergeCalled = false
    const result = await createBatchReportPdf(
      data,
      configuration,
      { render: async () => ({ bytes: new Uint8Array(), pageCount: 0 }) },
      {
        merge: async () => {
          mergeCalled = true
          return new Uint8Array([1])
        },
      },
    )

    expect(result).toEqual({
      ok: false,
      message: 'O gerador produziu um PDF vazio no registro 1.',
    })
    expect(mergeCalled).toBe(false)
  })
})
