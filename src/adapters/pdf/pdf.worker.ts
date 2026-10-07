import { pdfLibReportRenderer } from './PdfLibReportRenderer'
import type { PdfRenderRequest } from '../../application/export-pdf/createReportPdf'

self.onmessage = async (event: MessageEvent<PdfRenderRequest>) => {
  try {
    const output = await pdfLibReportRenderer.render(event.data)
    self.postMessage(
      { ok: true, bytes: output.bytes, pageCount: output.pageCount },
      { transfer: [output.bytes.buffer] },
    )
  } catch (error) {
    self.postMessage({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar o documento.',
    })
  }
}
