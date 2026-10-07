import { GlobalWorkerOptions, getDocument, OPS, Util } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type {
  DetectedPdfShape,
  DetectedPdfText,
  PdfTemplateAsset,
  PdfTemplatePage,
} from '../../domain/report/ReportTemplate'

GlobalWorkerOptions.workerSrc = workerUrl

const MAX_PDF_BYTES = 20 * 1024 * 1024
const MAX_PAGES = 20

export async function readPdfTemplate(file: File): Promise<PdfTemplateAsset> {
  if (!file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('Selecione um arquivo PDF.')
  if (file.size === 0) throw new Error('O PDF está vazio.')
  if (file.size > MAX_PDF_BYTES)
    throw new Error('O PDF deve ter no máximo 20 MB.')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const document = await getDocument({ data: bytes.slice() }).promise
  if (document.numPages > MAX_PAGES)
    throw new Error(`O PDF deve ter no máximo ${MAX_PAGES} páginas.`)

  const pages: PdfTemplatePage[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const renderViewport = page.getViewport({ scale: 1.5 })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.ceil(renderViewport.width)
    canvas.height = Math.ceil(renderViewport.height)
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Não foi possível preparar a prévia do PDF.')
    await page.render({
      canvas,
      canvasContext: context,
      viewport: renderViewport,
    }).promise
    const content = await page.getTextContent()
    const detectedTexts = content.items.flatMap((item) =>
      'str' in item
        ? [
            detectedText(
              item,
              viewport.transform,
              viewport.width,
              viewport.height,
            ),
          ]
        : [],
    )
    pages.push({
      width: viewport.width,
      height: viewport.height,
      imageDataUrl: canvas.toDataURL('image/png'),
      detectedTexts: detectedTexts.map((text) => {
        const backgroundColor = sampleBackgroundColor(context, canvas, text)
        return {
          ...text,
          backgroundColor,
          color: sampleTextColor(context, canvas, {
            ...text,
            backgroundColor,
          }),
        }
      }),
      detectedShapes: detectShapes(
        await page.getOperatorList(),
        viewport.width,
        viewport.height,
      ),
    })
    page.cleanup()
  }

  return {
    name: file.name,
    sourceDataUrl: bytesToDataUrl(bytes),
    pages,
    reconstructionMode: 'editable',
  }
}

function sampleTextColor(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: DetectedPdfText,
): string {
  const left = Math.max(0, Math.floor(text.x * canvas.width))
  const top = Math.max(0, Math.floor(text.y * canvas.height))
  const width = Math.max(
    1,
    Math.min(canvas.width - left, Math.ceil(text.width * canvas.width)),
  )
  const height = Math.max(
    1,
    Math.min(canvas.height - top, Math.ceil(text.height * canvas.height)),
  )
  const pixels = context.getImageData(left, top, width, height).data
  const background = hexChannels(text.backgroundColor ?? '#ffffff')
  let best: readonly number[] = [34, 34, 34]
  let bestDistance = 0
  for (let index = 0; index < pixels.length; index += 16) {
    const candidate = [
      pixels[index] ?? 255,
      pixels[index + 1] ?? 255,
      pixels[index + 2] ?? 255,
    ]
    const distance = candidate.reduce(
      (total, channel, channelIndex) =>
        total + Math.abs(channel - (background[channelIndex] ?? 255)),
      0,
    )
    if (distance > bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return rgbHex(best)
}

function detectShapes(
  operatorList: { fnArray: number[]; argsArray: unknown[][] },
  pageWidth: number,
  pageHeight: number,
): DetectedPdfShape[] {
  let fillColor = '#000000'
  let borderColor = '#000000'
  let borderWidth = 1
  const shapes = new Map<string, DetectedPdfShape>()
  const fillOperations = new Set([
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ])
  const strokeOperations = new Set([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ])

  operatorList.fnArray.forEach((operation, index) => {
    const args = operatorList.argsArray[index] ?? []
    if (operation === OPS.setFillRGBColor) fillColor = pdfColor(args[0])
    if (operation === OPS.setStrokeRGBColor) borderColor = pdfColor(args[0])
    if (operation === OPS.setLineWidth && typeof args[0] === 'number')
      borderWidth = Math.max(0.5, args[0])
    if (operation !== OPS.constructPath) return
    const paintOperation = Number(args[0])
    const bounds = args[2]
    if (
      !ArrayBuffer.isView(bounds) ||
      (bounds as unknown as { length: number }).length < 4 ||
      paintOperation === OPS.endPath
    )
      return
    const values = Array.from(bounds as unknown as ArrayLike<number>)
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = values
    const width = Math.abs(x1 - x0) / pageWidth
    const height = Math.abs(y1 - y0) / pageHeight
    if (width < 0.0003 && height < 0.0003) return
    const kind = width < 0.001 || height < 0.001 ? 'line' : 'rectangle'
    const key = [kind, x0, y0, x1, y1]
      .map((value) => (typeof value === 'number' ? value.toFixed(2) : value))
      .join(':')
    const current = shapes.get(key) ?? {
      kind,
      x: Math.min(x0, x1) / pageWidth,
      y: (pageHeight - Math.max(y0, y1)) / pageHeight,
      width: Math.max(width, 0.001),
      height: Math.max(height, 0.001),
    }
    if (fillOperations.has(paintOperation)) current.fillColor = fillColor
    if (strokeOperations.has(paintOperation)) {
      current.borderColor = borderColor
      current.borderWidth = borderWidth
    }
    shapes.set(key, current)
  })
  return [...shapes.values()].slice(0, 500)
}

function pdfColor(value: unknown): string {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value
  if (Array.isArray(value) || ArrayBuffer.isView(value))
    return rgbHex(
      Array.from(value as ArrayLike<number>).map((channel) =>
        channel <= 1 ? channel * 255 : channel,
      ),
    )
  return '#000000'
}

function rgbHex(channels: readonly number[]): string {
  return `#${[0, 1, 2]
    .map((index) =>
      Math.max(0, Math.min(255, Math.round(channels[index] ?? 0)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

function hexChannels(color: string): number[] {
  return [1, 3, 5].map((index) =>
    Number.parseInt(color.slice(index, index + 2), 16),
  )
}

function sampleBackgroundColor(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: DetectedPdfText,
): string {
  const left = text.x * canvas.width
  const top = text.y * canvas.height
  const width = text.width * canvas.width
  const height = text.height * canvas.height
  const points = [
    [left - 2, top + height / 2],
    [left + width + 2, top + height / 2],
    [left + width / 2, top - 2],
    [left + width / 2, top + height + 2],
  ]
  const colors = points.map(([x, y]) => {
    const pixel = context.getImageData(
      Math.max(0, Math.min(canvas.width - 1, Math.round(x ?? 0))),
      Math.max(0, Math.min(canvas.height - 1, Math.round(y ?? 0))),
      1,
      1,
    ).data
    return [pixel[0] ?? 255, pixel[1] ?? 255, pixel[2] ?? 255]
  })
  const channelMedian = (channel: number) =>
    [...colors]
      .map((color) => color[channel] ?? 255)
      .sort((first, second) => first - second)[Math.floor(colors.length / 2)] ??
    255
  return `#${[0, 1, 2]
    .map((channel) => channelMedian(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function detectedText(
  item: {
    str: string
    transform: number[]
    width: number
  },
  viewportTransform: number[],
  pageWidth: number,
  pageHeight: number,
): DetectedPdfText {
  const transform = Util.transform(viewportTransform, item.transform)
  const fontHeight = Math.hypot(transform[2] ?? 0, transform[3] ?? 0)
  return {
    text: item.str,
    x: Math.max(0, (transform[4] ?? 0) / pageWidth),
    y: Math.max(0, ((transform[5] ?? 0) - fontHeight) / pageHeight),
    width: Math.max(0.005, item.width / pageWidth),
    height: Math.max(0.008, fontHeight / pageHeight),
    fontSize: Math.max(6, fontHeight),
    bold: fontHeight >= 13 || isUppercaseLabel(item.str),
  }
}

function isUppercaseLabel(value: string): boolean {
  const letters = value.replace(/[^\p{L}]/gu, '')
  return letters.length >= 3 && letters === letters.toLocaleUpperCase('pt-BR')
}

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  return `data:application/pdf;base64,${btoa(binary)}`
}
