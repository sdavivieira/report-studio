import { PDFDocument } from 'pdf-lib'
import type { PdfDocumentMerger } from '../../application/export-pdf/createReportPdf'

export const pdfLibDocumentMerger: PdfDocumentMerger = {
  async merge(documents) {
    const merged = await PDFDocument.create()
    for (const bytes of documents) {
      const source = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(source, source.getPageIndices())
      for (const page of pages) merged.addPage(page)
    }
    return merged.save({ objectsPerTick: 1_000 })
  },
}
