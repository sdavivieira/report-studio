import type { WorksheetData } from '../../domain/workbook/Workbook'
import type { ReportConfiguration } from '../../domain/report/ReportConfiguration'
import { validateReportConfiguration } from '../../domain/report/ReportConfiguration'
import type {
  PdfTemplateAsset,
  ReportElement,
  ReportImage,
} from '../../domain/report/ReportTemplate'
import { findElementBoundaryMessages } from '../../domain/report/ReportElementLayout'

export interface PdfRenderRequest {
  data: WorksheetData
  configuration: ReportConfiguration
  elements: readonly ReportElement[]
  image: ReportImage | null
  pdfTemplate: PdfTemplateAsset | null
  generatedAt: Date
}

export interface PdfRenderOutput {
  bytes: Uint8Array
  pageCount: number
}

export interface PdfRenderer {
  render(request: PdfRenderRequest): Promise<PdfRenderOutput>
}

export interface PdfDocumentMerger {
  merge(documents: readonly Uint8Array[]): Promise<Uint8Array>
}

export type PdfGenerationResult =
  | {
      ok: true
      blob: Blob
      fileName: string
      pageCount: number
    }
  | { ok: false; message: string }

export async function createReportPdf(
  data: WorksheetData,
  configuration: ReportConfiguration,
  renderer: PdfRenderer,
  elements: readonly ReportElement[] = [],
  image: ReportImage | null = null,
  pdfTemplate: PdfTemplateAsset | null = null,
  generatedAt = new Date(),
): Promise<PdfGenerationResult> {
  const validationErrors = validateReportConfiguration(configuration)
  if (validationErrors.length)
    return {
      ok: false,
      message: validationErrors[0] ?? 'Configuração inválida.',
    }

  try {
    const boundaryMessage = findElementBoundaryMessages(elements)[0]
    if (boundaryMessage) return { ok: false, message: boundaryMessage }
    const output = await renderer.render({
      data,
      configuration,
      elements,
      image,
      pdfTemplate,
      generatedAt,
    })
    if (!output.bytes.length || output.pageCount < 1)
      return { ok: false, message: 'O gerador produziu um PDF vazio.' }
    return {
      ok: true,
      blob: new Blob([output.bytes.slice().buffer], {
        type: 'application/pdf',
      }),
      fileName: `${safeFileName(configuration.title)}.pdf`,
      pageCount: output.pageCount,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erro desconhecido'
    return {
      ok: false,
      message: `Não foi possível gerar o PDF: ${detail}`,
    }
  }
}

export async function createBatchReportPdf(
  data: WorksheetData,
  configuration: ReportConfiguration,
  renderer: PdfRenderer,
  merger: PdfDocumentMerger,
  elements: readonly ReportElement[] = [],
  image: ReportImage | null = null,
  pdfTemplate: PdfTemplateAsset | null = null,
  startRow = 0,
  rowCount = 25,
  onProgress?: (completed: number, total: number) => void,
): Promise<PdfGenerationResult> {
  const selectedRows = data.rows.slice(startRow, startRow + rowCount)
  if (!selectedRows.length)
    return { ok: false, message: 'Não há registros no intervalo escolhido.' }
  if (selectedRows.length > 100)
    return {
      ok: false,
      message: 'Gere no máximo 100 registros por lote.',
    }

  const validationErrors = validateReportConfiguration(configuration)
  if (validationErrors.length)
    return {
      ok: false,
      message: validationErrors[0] ?? 'Configuração inválida.',
    }
  const boundaryMessage = findElementBoundaryMessages(elements)[0]
  if (boundaryMessage) return { ok: false, message: boundaryMessage }

  try {
    const documents: Uint8Array[] = []
    let pageCount = 0
    const generatedAt = new Date()
    for (const [index, row] of selectedRows.entries()) {
      const recordData: WorksheetData = {
        ...data,
        rows: [row],
        sourceRowNumbers: data.sourceRowNumbers
          ? [data.sourceRowNumbers[startRow + index] ?? startRow + index + 2]
          : [startRow + index + 2],
      }
      const output = await renderer.render({
        data: recordData,
        configuration,
        elements: elements.map(resetDataFieldRow),
        image,
        pdfTemplate,
        generatedAt,
      })
      if (!output.bytes.length || output.pageCount < 1)
        return {
          ok: false,
          message: `O gerador produziu um PDF vazio no registro ${startRow + index + 1}.`,
        }
      documents.push(output.bytes)
      pageCount += output.pageCount
      onProgress?.(index + 1, selectedRows.length)
    }
    const bytes = await merger.merge(documents)
    return {
      ok: true,
      blob: new Blob([bytes.slice().buffer], { type: 'application/pdf' }),
      fileName: `${safeFileName(configuration.title)}-lote-${startRow + 1}-${startRow + selectedRows.length}.pdf`,
      pageCount,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erro desconhecido'
    return {
      ok: false,
      message: `Não foi possível gerar o lote: ${detail}`,
    }
  }
}

function resetDataFieldRow(element: ReportElement): ReportElement {
  return element.dataField && !element.dataField.originalText
    ? { ...element, dataField: { ...element.dataField, rowIndex: 0 } }
    : element
}

function safeFileName(title: string): string {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return normalized || 'relatorio'
}
