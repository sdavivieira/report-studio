import type {
  PdfRenderer,
  PdfRenderRequest,
  PdfRenderOutput,
} from '../../application/export-pdf/createReportPdf'
import type { CellValue } from '../../domain/workbook/Workbook'

const PDF_TIMEOUT_MS = 120_000

export const browserPdfWorkerRenderer: PdfRenderer = {
  render(request) {
    return new Promise<PdfRenderOutput>((resolve, reject) => {
      const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), {
        type: 'module',
      })
      const timeout = window.setTimeout(() => {
        worker.terminate()
        reject(new Error('A geração excedeu o limite de 2 minutos.'))
      }, PDF_TIMEOUT_MS)

      worker.onmessage = (
        event: MessageEvent<
          | { ok: true; bytes: Uint8Array; pageCount: number }
          | { ok: false; message: string }
        >,
      ) => {
        window.clearTimeout(timeout)
        worker.terminate()
        if (!event.data.ok) {
          reject(new Error(event.data.message))
          return
        }
        resolve({ bytes: event.data.bytes, pageCount: event.data.pageCount })
      }
      worker.onerror = () => {
        window.clearTimeout(timeout)
        worker.terminate()
        reject(new Error('O processo local de PDF foi interrompido.'))
      }
      worker.postMessage(cloneRenderRequest(request))
    })
  },
}

function cloneRenderRequest(request: PdfRenderRequest): PdfRenderRequest {
  return {
    data: {
      name: request.data.name,
      headerRow: request.data.headerRow,
      columns: request.data.columns.map((column) => ({ ...column })),
      rows: request.data.rows.map((row) => row.map(cloneCell)),
      ...(request.data.sourceRowNumbers
        ? { sourceRowNumbers: [...request.data.sourceRowNumbers] }
        : {}),
    },
    configuration: {
      ...request.configuration,
      colors: { ...request.configuration.colors },
      columns: request.configuration.columns.map((column) => ({ ...column })),
    },
    elements: request.elements.map((element) => ({
      ...element,
      position: { ...element.position },
      size: { ...element.size },
      style: { ...element.style },
      ...(element.summary ? { summary: { ...element.summary } } : {}),
      ...(element.formula ? { formula: { ...element.formula } } : {}),
      ...(element.chart ? { chart: { ...element.chart } } : {}),
      ...(element.dataTable
        ? {
            dataTable: {
              ...element.dataTable,
              sourceIds: [...element.dataTable.sourceIds],
              ...(element.dataTable.columnWidths
                ? { columnWidths: [...element.dataTable.columnWidths] }
                : {}),
              ...(element.dataTable.columnFormats
                ? {
                    columnFormats: element.dataTable.columnFormats.map(
                      (format) => ({ ...format }),
                    ),
                  }
                : {}),
            },
          }
        : {}),
      ...(element.dataField ? { dataField: { ...element.dataField } } : {}),
      ...(element.shape ? { shape: { ...element.shape } } : {}),
    })),
    image: request.image ? { ...request.image } : null,
    pdfTemplate: request.pdfTemplate
      ? {
          ...request.pdfTemplate,
          pages: request.pdfTemplate.pages.map((page) => ({
            ...page,
            detectedTexts: page.detectedTexts.map((text) => ({ ...text })),
            detectedShapes: page.detectedShapes?.map((shape) => ({ ...shape })),
          })),
        }
      : null,
    generatedAt: new Date(request.generatedAt),
  }
}

function cloneCell(cell: CellValue): CellValue {
  if (cell instanceof Date) return new Date(cell)
  if (typeof cell === 'object' && cell !== null) return { ...cell }
  return cell
}
