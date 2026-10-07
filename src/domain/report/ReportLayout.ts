import type { WorksheetData } from '../workbook/Workbook'
import {
  formatReportValue,
  type ReportConfiguration,
  type ReportColumnConfiguration,
} from './ReportConfiguration'
import {
  findReportElement,
  REPORT_ELEMENT_LABELS,
  type ReportElement,
  type ReportElementType,
} from './ReportTemplate'

export interface Point {
  x: number
  y: number
}

export interface Rectangle extends Point {
  width: number
  height: number
}

export interface PageSize {
  width: number
  height: number
}

export interface ReportPageLayout {
  index: number
  rowStart: number
  rowEnd: number
  rowHeights: readonly number[]
  title: Rectangle
  subtitle: Rectangle
  date: Rectangle
  table: Rectangle
  footer: Rectangle
  pageNumber: Rectangle
  image: Rectangle
}

export interface ReportLayout {
  pageSize: PageSize
  pageBounds: Rectangle
  marginBounds: Rectangle
  tableWidth: number
  tableHeaderHeight: number
  dataPageCount: number
  pages: readonly ReportPageLayout[]
}

export interface LayoutOverflow {
  element: string
  message: string
}

export type FontWeight = 'normal' | 'bold'
export type TextMeasurer = (
  text: string,
  fontSize: number,
  weight: FontWeight,
) => number

export const POINTS_PER_INCH = 72
export const CSS_PIXELS_PER_INCH = 96
export const MILLIMETERS_PER_INCH = 25.4
export const A4_PORTRAIT: Readonly<PageSize> = {
  width: mmToPoints(210),
  height: mmToPoints(297),
}

export function mmToPoints(millimeters: number): number {
  return (millimeters / MILLIMETERS_PER_INCH) * POINTS_PER_INCH
}

export function pointsToMillimeters(points: number): number {
  return (points / POINTS_PER_INCH) * MILLIMETERS_PER_INCH
}

export function pointsToPixels(points: number, zoom = 1): number {
  return (points / POINTS_PER_INCH) * CSS_PIXELS_PER_INCH * zoom
}

export function pixelsToPoints(pixels: number, zoom = 1): number {
  return ((pixels / CSS_PIXELS_PER_INCH) * POINTS_PER_INCH) / zoom
}

export function normalizedToPoint(
  normalized: Point,
  pageSize: PageSize,
): Point {
  return {
    x: normalized.x * pageSize.width,
    y: normalized.y * pageSize.height,
  }
}

export function pointToNormalized(point: Point, pageSize: PageSize): Point {
  return {
    x: point.x / pageSize.width,
    y: point.y / pageSize.height,
  }
}

export function pageSizeFor(configuration: ReportConfiguration): PageSize {
  return configuration.orientation === 'portrait'
    ? A4_PORTRAIT
    : { width: A4_PORTRAIT.height, height: A4_PORTRAIT.width }
}

export function rectangleOverflows(
  rectangle: Rectangle,
  bounds: Rectangle,
): boolean {
  return (
    rectangle.x < bounds.x ||
    rectangle.y < bounds.y ||
    rectangle.x + rectangle.width > bounds.x + bounds.width ||
    rectangle.y + rectangle.height > bounds.y + bounds.height
  )
}

export function calculateTableWidth(
  configuration: ReportConfiguration,
): number {
  return mmToPoints(
    configuration.columns
      .filter((column) => column.visible)
      .reduce((total, column) => total + column.widthMm, 0),
  )
}

export function wrapReportText(
  text: string,
  availableWidth: number,
  fontSize: number,
  measureText: TextMeasurer = estimatedTextWidth,
  weight: FontWeight = 'normal',
): readonly string[] {
  if (!text) return ['']
  if (availableWidth <= 0) return [text]
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((paragraph) =>
      paragraph
        ? wrapTextParagraph(
            paragraph,
            availableWidth,
            fontSize,
            measureText,
            weight,
          )
        : [''],
    )
}

function wrapTextParagraph(
  text: string,
  availableWidth: number,
  fontSize: number,
  measureText: TextMeasurer,
  weight: FontWeight,
): readonly string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measureText(candidate, fontSize, weight) <= availableWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    const pieces = splitLongWord(
      word,
      availableWidth,
      fontSize,
      measureText,
      weight,
    )
    lines.push(...pieces.slice(0, -1))
    line = pieces.at(-1) ?? ''
  }
  if (line || !lines.length) lines.push(line)
  return lines
}

export function calculateReportLayout(
  data: WorksheetData,
  configuration: ReportConfiguration,
  measureText: TextMeasurer = estimatedTextWidth,
  elements: readonly ReportElement[] = [],
): ReportLayout {
  const pageSize = pageSizeFor(configuration)
  const margin = mmToPoints(configuration.marginMm)
  const pageBounds: Rectangle = { x: 0, y: 0, ...pageSize }
  const marginBounds: Rectangle = {
    x: margin,
    y: margin,
    width: pageSize.width - margin * 2,
    height: pageSize.height - margin * 2,
  }
  const dateHeight = configuration.showDate
    ? configuration.bodyFontSize * 1.5
    : 0
  const titleHeight =
    wrapReportText(
      configuration.title,
      marginBounds.width,
      configuration.titleFontSize,
      measureText,
      'bold',
    ).length *
    configuration.titleFontSize *
    1.25
  const subtitleHeight = configuration.subtitle
    ? wrapReportText(
        configuration.subtitle,
        marginBounds.width,
        configuration.subtitleFontSize,
        measureText,
      ).length *
      configuration.subtitleFontSize *
      1.25
    : 0
  const headingHeight = Math.max(
    dateHeight + titleHeight + subtitleHeight + 12,
    54,
  )
  const footerLineCount = configuration.footerText
    ? wrapReportText(
        configuration.footerText,
        marginBounds.width * 0.75,
        configuration.bodyFontSize,
        measureText,
      ).length
    : 1
  const footerHeight = Math.max(
    footerLineCount * configuration.bodyFontSize * 1.25 + 4,
    14,
  )
  const defaultTableTop = margin + headingHeight
  const defaultTableHeight =
    pageSize.height - defaultTableTop - margin - footerHeight - 12
  const configuredTableWidth = calculateTableWidth(configuration)
  const defaultTableWidth = Math.min(configuredTableWidth, marginBounds.width)
  const tableRectangle = resolveElementRectangle(
    'table',
    {
      x: marginBounds.x,
      y: defaultTableTop,
      width: defaultTableWidth,
      height: defaultTableHeight,
    },
    elements,
    pageSize,
  )
  const tableWidthScale =
    configuredTableWidth > 0 ? tableRectangle.width / configuredTableWidth : 1
  const visibleColumns = orderedVisibleColumns(configuration)
  const tableHeaderHeight = calculateHeaderHeight(
    visibleColumns,
    configuration,
    measureText,
    tableWidthScale,
  )
  const rowHeights = data.rows.map((row) =>
    calculateRowHeight(
      row,
      data,
      visibleColumns,
      configuration,
      measureText,
      tableWidthScale,
    ),
  )
  const tableElement = findReportElement(elements, 'table')
  const tableIsVisible = tableElement?.visible ?? true
  const pageRanges = tableIsVisible
    ? paginateRows(rowHeights, tableRectangle.height - tableHeaderHeight)
    : []
  const documentPageCount = Math.max(configuration.pageCount, pageRanges.length)
  const pages = Array.from({ length: documentPageCount }, (_, index) =>
    createPageLayout(
      index,
      pageRanges[index] ?? { start: 0, end: 0 },
      rowHeights,
      marginBounds,
      tableRectangle,
      dateHeight,
      titleHeight,
      subtitleHeight,
      footerHeight,
      pageSize,
      elements,
    ),
  )

  return {
    pageSize,
    pageBounds,
    marginBounds,
    tableWidth: tableRectangle.width,
    tableHeaderHeight,
    dataPageCount: pageRanges.length,
    pages,
  }
}

export function findLayoutOverflows(
  layout: ReportLayout,
  elements: readonly ReportElement[] = [],
): readonly LayoutOverflow[] {
  const overflows: LayoutOverflow[] = []
  const tableExceedsWidth = layout.tableWidth > layout.marginBounds.width
  if (tableExceedsWidth)
    overflows.push({
      element: 'table',
      message: 'A tabela ultrapassa a largura disponível entre as margens.',
    })
  for (const page of tableExceedsWidth ? [] : layout.pages) {
    if (rectangleOverflows(page.table, layout.marginBounds))
      overflows.push({
        element: `table-page-${page.index + 1}`,
        message: `A tabela da página ${page.index + 1} ultrapassa as margens.`,
      })
  }
  const firstPage = layout.pages[0]
  if (firstPage) {
    const editableRectangles: readonly [ReportElementType, Rectangle][] = [
      ['title', firstPage.title],
      ['subtitle', firstPage.subtitle],
      ['date', firstPage.date],
      ['image', firstPage.image],
      ['footer', firstPage.footer],
      ['pageNumber', firstPage.pageNumber],
    ]
    for (const [type, rectangle] of editableRectangles) {
      const element = findReportElement(elements, type)
      if (element && !element.visible) continue
      if (rectangleOverflows(rectangle, layout.pageBounds))
        overflows.push({
          element: type,
          message: `${REPORT_ELEMENT_LABELS[type]} ultrapassa os limites da página.`,
        })
    }
  }
  return overflows
}

function orderedVisibleColumns(
  configuration: ReportConfiguration,
): readonly ReportColumnConfiguration[] {
  return [...configuration.columns]
    .filter((column) => column.visible)
    .sort((left, right) => left.order - right.order)
}

function calculateRowHeight(
  row: WorksheetData['rows'][number],
  data: WorksheetData,
  columns: readonly ReportColumnConfiguration[],
  configuration: ReportConfiguration,
  measureText: TextMeasurer,
  widthScale: number,
): number {
  const columnIndexes = new Map(
    data.columns.map((column) => [column.id, column.index]),
  )
  const configuredPadding = mmToPoints(configuration.cellPaddingMm)
  const lineHeight = configuration.bodyFontSize * 1.25
  const lineCount = Math.max(
    1,
    ...columns.map((column) => {
      const index = columnIndexes.get(column.sourceId)
      const text = formatReportValue(
        index === undefined ? undefined : row[index],
        column,
      )
      const columnWidth = mmToPoints(column.widthMm) * widthScale
      const padding = effectiveCellPadding(columnWidth, configuredPadding)
      return wrapReportText(
        text,
        columnWidth - padding * 2,
        configuration.bodyFontSize,
        measureText,
      ).length
    }),
  )
  return Math.max(
    mmToPoints(configuration.rowHeightMm),
    lineCount * lineHeight + configuredPadding * 2,
  )
}

function calculateHeaderHeight(
  columns: readonly ReportColumnConfiguration[],
  configuration: ReportConfiguration,
  measureText: TextMeasurer,
  widthScale: number,
): number {
  const configuredPadding = mmToPoints(configuration.cellPaddingMm)
  const lineHeight = configuration.bodyFontSize * 1.25
  const lineCount = Math.max(
    1,
    ...columns.map((column) => {
      const columnWidth = mmToPoints(column.widthMm) * widthScale
      const padding = effectiveCellPadding(columnWidth, configuredPadding)
      return wrapReportText(
        column.label,
        columnWidth - padding * 2,
        configuration.bodyFontSize,
        measureText,
        'bold',
      ).length
    }),
  )
  return Math.max(
    mmToPoints(configuration.rowHeightMm),
    lineCount * lineHeight + configuredPadding * 2,
  )
}

export function effectiveCellPadding(
  columnWidth: number,
  configuredPadding: number,
): number {
  return Math.min(configuredPadding, Math.max(0, columnWidth / 4))
}

function paginateRows(
  rowHeights: readonly number[],
  availableHeight: number,
): readonly { start: number; end: number }[] {
  if (!rowHeights.length) return [{ start: 0, end: 0 }]
  const ranges: { start: number; end: number }[] = []
  let start = 0
  let usedHeight = 0

  for (let index = 0; index < rowHeights.length; index++) {
    const rowHeight = rowHeights[index] ?? 0
    if (rowHeight > availableHeight)
      throw new Error(
        `A linha ${index + 1} é mais alta que a área disponível da página.`,
      )
    if (index > start && usedHeight + rowHeight > availableHeight) {
      ranges.push({ start, end: index })
      start = index
      usedHeight = 0
    }
    usedHeight += rowHeight
  }
  ranges.push({ start, end: rowHeights.length })
  return ranges
}

function createPageLayout(
  index: number,
  range: { start: number; end: number },
  allRowHeights: readonly number[],
  marginBounds: Rectangle,
  tableRectangle: Rectangle,
  dateHeight: number,
  titleHeight: number,
  subtitleHeight: number,
  footerHeight: number,
  pageSize: PageSize,
  elements: readonly ReportElement[],
): ReportPageLayout {
  const defaults = {
    index,
    rowStart: range.start,
    rowEnd: range.end,
    rowHeights: allRowHeights.slice(range.start, range.end),
    title: {
      x: marginBounds.x,
      y: marginBounds.y + dateHeight,
      width: marginBounds.width,
      height: titleHeight,
    },
    subtitle: {
      x: marginBounds.x,
      y: marginBounds.y + dateHeight + titleHeight,
      width: marginBounds.width,
      height: subtitleHeight,
    },
    date: {
      x: marginBounds.x,
      y: marginBounds.y,
      width: marginBounds.width,
      height: dateHeight,
    },
    table: tableRectangle,
    footer: {
      x: marginBounds.x,
      y: marginBounds.y + marginBounds.height - footerHeight,
      width: marginBounds.width * 0.75,
      height: footerHeight,
    },
    pageNumber: {
      x: marginBounds.x + marginBounds.width * 0.75,
      y: marginBounds.y + marginBounds.height - footerHeight,
      width: marginBounds.width * 0.25,
      height: footerHeight,
    },
    image: {
      x: marginBounds.x + marginBounds.width * 0.78,
      y: marginBounds.y,
      width: marginBounds.width * 0.22,
      height: Math.min(54, marginBounds.height * 0.12),
    },
  }
  return {
    ...defaults,
    title: resolveElementRectangle('title', defaults.title, elements, pageSize),
    subtitle: resolveElementRectangle(
      'subtitle',
      defaults.subtitle,
      elements,
      pageSize,
    ),
    date: resolveElementRectangle('date', defaults.date, elements, pageSize),
    table: resolveElementRectangle('table', defaults.table, elements, pageSize),
    footer: resolveElementRectangle(
      'footer',
      defaults.footer,
      elements,
      pageSize,
    ),
    pageNumber: resolveElementRectangle(
      'pageNumber',
      defaults.pageNumber,
      elements,
      pageSize,
    ),
    image: resolveElementRectangle('image', defaults.image, elements, pageSize),
  }
}

function resolveElementRectangle(
  type: ReportElementType,
  fallback: Rectangle,
  elements: readonly ReportElement[],
  pageSize: PageSize,
): Rectangle {
  const element = findReportElement(elements, type)
  if (!element) return fallback
  return {
    x: element.position.x * pageSize.width,
    y: element.position.y * pageSize.height,
    width: element.size.width * pageSize.width,
    height: element.size.height * pageSize.height,
  }
}

export function createDefaultReportElements(
  data: WorksheetData,
  configuration: ReportConfiguration,
): readonly ReportElement[] {
  const layout = calculateReportLayout({ ...data, rows: [] }, configuration)
  const page = layout.pages[0]
  if (!page) return []
  const definitions: readonly [ReportElementType, Rectangle, boolean][] = [
    ['title', page.title, true],
    ['subtitle', page.subtitle, Boolean(configuration.subtitle)],
    ['date', page.date, configuration.showDate],
    ['table', page.table, true],
    ['image', page.image, false],
    ['footer', page.footer, Boolean(configuration.footerText)],
    ['pageNumber', page.pageNumber, configuration.showPageNumbers],
  ]
  return definitions.map(([type, rectangle, visible]) => ({
    id: type,
    type,
    visible,
    position: pointToNormalized(rectangle, layout.pageSize),
    size: {
      width: rectangle.width / layout.pageSize.width,
      height: rectangle.height / layout.pageSize.height,
    },
    keepAspectRatio: type === 'image',
    pageIndex: 0,
    repeatOnEveryPage: ['table', 'footer', 'pageNumber'].includes(type),
    style: elementStyle(type, configuration),
  }))
}

function elementStyle(
  type: ReportElementType,
  configuration: ReportConfiguration,
) {
  if (type === 'title')
    return {
      color: configuration.colors.title,
      fontSize: configuration.titleFontSize,
      alignment: configuration.titleAlignment,
    }
  if (type === 'subtitle')
    return {
      color: configuration.colors.subtitle,
      fontSize: configuration.subtitleFontSize,
      alignment: configuration.titleAlignment,
    }
  return {
    color: configuration.colors.subtitle,
    fontSize: configuration.bodyFontSize,
    alignment: type === 'pageNumber' || type === 'date' ? 'right' : 'left',
  } as const
}

function estimatedTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((width, character) => {
    if (/\s/.test(character)) return width + fontSize * 0.3
    if (/[ilI1.,:;]/.test(character)) return width + fontSize * 0.3
    if (/[MWmw@%]/.test(character)) return width + fontSize * 0.85
    if (/[A-ZÁÉÍÓÚÃÕÇ]/.test(character)) return width + fontSize * 0.66
    return width + fontSize * 0.56
  }, 0)
}

function splitLongWord(
  word: string,
  availableWidth: number,
  fontSize: number,
  measureText: TextMeasurer,
  weight: FontWeight,
): readonly string[] {
  const pieces: string[] = []
  let piece = ''
  for (const character of word) {
    if (
      piece &&
      measureText(`${piece}${character}`, fontSize, weight) > availableWidth
    ) {
      pieces.push(piece)
      piece = character
    } else piece += character
  }
  if (piece) pieces.push(piece)
  return pieces.length ? pieces : ['']
}
