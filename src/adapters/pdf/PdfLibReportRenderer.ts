import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import regularFontUrl from '../../assets/fonts/NotoSans-Regular.ttf?url'
import boldFontUrl from '../../assets/fonts/NotoSans-Bold.ttf?url'
import type {
  PdfRenderer,
  PdfRenderRequest,
} from '../../application/export-pdf/createReportPdf'
import type { CellValue } from '../../domain/workbook/Workbook'
import {
  formatReportValue,
  type ReportColumnConfiguration,
  type TextAlignment,
} from '../../domain/report/ReportConfiguration'
import {
  calculateReportLayout,
  findLayoutOverflows,
  mmToPoints,
  wrapReportText,
  effectiveCellPadding,
  type Rectangle,
  type TextMeasurer,
} from '../../domain/report/ReportLayout'
import { findReportElement } from '../../domain/report/ReportTemplate'
import { calculateSummary } from '../../domain/report/ReportSummary'
import {
  calculateChartSeries,
  calculateDataTable,
  calculateFormula,
  type ChartSeriesItem,
  type DataTableResult,
} from '../../domain/report/ReportDataElements'
import type { ReportElement } from '../../domain/report/ReportTemplate'
import {
  dataFieldMatchesOriginal,
  dataFieldValue,
} from '../../domain/report/PdfTemplateDetection'

export const pdfLibReportRenderer: PdfRenderer = {
  async render(request) {
    const document = await PDFDocument.create()
    document.registerFontkit(fontkit)
    document.setTitle(request.configuration.title)
    document.setSubject('Relatório gerado localmente pelo Report Studio')
    document.setCreator('Report Studio')
    document.setProducer('Report Studio e pdf-lib')
    document.setCreationDate(request.generatedAt)

    const [regularBytes, boldBytes] = await Promise.all([
      loadFont(regularFontUrl),
      loadFont(boldFontUrl),
    ])
    const regularFont = await document.embedFont(regularBytes, { subset: true })
    const boldFont = await document.embedFont(boldBytes, { subset: true })
    const measureText: TextMeasurer = (text, size, weight) =>
      (weight === 'bold' ? boldFont : regularFont).widthOfTextAtSize(text, size)
    const layout = calculateReportLayout(
      request.data,
      request.configuration,
      measureText,
      request.elements,
    )
    const overflow = request.pdfTemplate
      ? undefined
      : findLayoutOverflows(layout, request.elements)[0]
    if (overflow) throw new Error(overflow.message)
    const reportImage = request.image
      ? await embedReportImage(
          document,
          request.image.dataUrl,
          request.image.mimeType,
        )
      : null
    const columns = [...request.configuration.columns]
      .filter((column) => column.visible)
      .sort((left, right) => left.order - right.order)
    const columnIndexes = new Map(
      request.data.columns.map((column) => [column.id, column.index]),
    )
    const sourceDocument =
      request.pdfTemplate?.reconstructionMode !== 'editable' &&
      request.pdfTemplate
        ? await PDFDocument.load(
            dataUrlBytes(request.pdfTemplate.sourceDataUrl),
          )
        : null

    for (const pageLayout of layout.pages) {
      const sourcePage =
        sourceDocument && pageLayout.index < sourceDocument.getPageCount()
          ? sourceDocument.getPage(pageLayout.index)
          : undefined
      const templatePage = request.pdfTemplate?.pages[pageLayout.index]
      const page = sourcePage
        ? (await document.copyPages(sourceDocument!, [pageLayout.index]))[0]
        : document.addPage([
            templatePage?.width ?? layout.pageSize.width,
            templatePage?.height ?? layout.pageSize.height,
          ])
      if (!page)
        throw new Error('Não foi possível copiar uma página do modelo.')
      if (sourcePage) document.addPage(page)
      else drawPageBackground(page, request)
      drawHeading(page, request, pageLayout, regularFont, boldFont)
      if (
        pageLayout.index < layout.dataPageCount &&
        elementIsVisible(request, 'table', pageLayout.index)
      )
        drawTable(
          page,
          request,
          pageLayout,
          layout.tableHeaderHeight,
          columns,
          columnIndexes,
          regularFont,
          boldFont,
        )
      if (reportImage && elementIsVisible(request, 'image', pageLayout.index))
        drawImage(page, reportImage, pageLayout.image)
      drawFooter(page, request, pageLayout, layout.pages.length, regularFont)
      drawCustomElements(page, request, pageLayout.index, regularFont, boldFont)
    }

    return {
      bytes: await document.save({ objectsPerTick: 1_000 }),
      pageCount: document.getPageCount(),
    }
  },
}

function drawCustomElements(
  page: PDFPage,
  request: PdfRenderRequest,
  pageIndex: number,
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const { width, height } = page.getSize()
  for (const element of request.elements) {
    if (
      !element.visible ||
      ![
        'customText',
        'summary',
        'formula',
        'chart',
        'dataTable',
        'dataField',
        'shape',
      ].includes(element.type) ||
      (!element.repeatOnEveryPage && (element.pageIndex ?? 0) !== pageIndex)
    )
      continue
    const rectangle = {
      x: element.position.x * width,
      y: element.position.y * height,
      width: element.size.width * width,
      height: element.size.height * height,
    }
    if (element.type === 'shape' && element.shape) {
      drawShape(page, element, rectangle)
      continue
    }
    if (
      element.type === 'dataField' &&
      request.pdfTemplate?.reconstructionMode !== 'editable' &&
      dataFieldMatchesOriginal(element, request.data, request.configuration)
    )
      continue
    if (element.style.backgroundColor)
      page.drawRectangle({
        x: rectangle.x,
        y: fromTop(page, rectangle.y + rectangle.height),
        width: rectangle.width,
        height: rectangle.height,
        color: parseColor(element.style.backgroundColor),
      })
    if (element.type === 'chart' && element.chart) {
      drawChart(
        page,
        element,
        rectangle,
        calculateChartSeries(element.chart, request.data),
        regularFont,
        boldFont,
      )
      continue
    }
    if (element.type === 'dataTable' && element.dataTable) {
      drawIndependentTable(
        page,
        element,
        rectangle,
        calculateDataTable(
          element.dataTable,
          request.data,
          request.configuration,
        ),
        regularFont,
        boldFont,
      )
      continue
    }
    const text =
      element.type === 'summary' && element.summary
        ? `${element.summary.label}: ${calculateSummary(element.summary, request.data, request.configuration)}`
        : element.type === 'formula' && element.formula
          ? `${element.formula.label}: ${calculateFormula(element.formula, request.data)}`
          : element.type === 'dataField'
            ? dataFieldValue(element, request.data, request.configuration)
            : (element.content ?? '')
    drawWrappedText(
      page,
      text,
      rectangle,
      element.style.bold ? boldFont : regularFont,
      element.style.fontSize ?? 12,
      parseColor(element.style.color ?? '#253c36'),
      element.style.alignment ?? 'left',
      0,
    )
  }
}

function drawShape(
  page: PDFPage,
  element: ReportElement,
  rectangle: Rectangle,
) {
  const lineColor = parseColor(element.style.color ?? '#777777')
  const borderWidth = element.shape?.borderWidth ?? 0.7
  if (element.shape?.kind === 'line') {
    const horizontal = rectangle.width >= rectangle.height
    const start = horizontal
      ? { x: rectangle.x, y: fromTop(page, rectangle.y + rectangle.height / 2) }
      : { x: rectangle.x + rectangle.width / 2, y: fromTop(page, rectangle.y) }
    const end = horizontal
      ? {
          x: rectangle.x + rectangle.width,
          y: fromTop(page, rectangle.y + rectangle.height / 2),
        }
      : {
          x: rectangle.x + rectangle.width / 2,
          y: fromTop(page, rectangle.y + rectangle.height),
        }
    page.drawLine({
      start,
      end,
      color: lineColor,
      thickness: borderWidth,
    })
    return
  }
  page.drawRectangle({
    x: rectangle.x,
    y: fromTop(page, rectangle.y + rectangle.height),
    width: rectangle.width,
    height: rectangle.height,
    ...(element.style.backgroundColor
      ? { color: parseColor(element.style.backgroundColor) }
      : {}),
    ...(element.style.color
      ? {
          borderColor: lineColor,
          borderWidth,
        }
      : {}),
  })
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(',', 2)[1]
  if (!encoded) throw new Error('O arquivo do modelo PDF está inválido.')
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}

const CHART_COLORS = ['#234e45', '#b93f3c', '#d29b36', '#527aa3', '#76578c']

function drawChart(
  page: PDFPage,
  element: ReportElement,
  rectangle: Rectangle,
  series: readonly ChartSeriesItem[],
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  if (!element.chart) return
  const color = parseColor(element.style.color ?? '#253c36')
  const fontSize = Math.max(6, element.style.fontSize ?? 10)
  drawSingleLine(
    page,
    element.chart.title,
    { ...rectangle, height: fontSize * 1.5 },
    boldFont,
    fontSize,
    color,
    'left',
  )
  const plot = {
    x: rectangle.x,
    y: rectangle.y + fontSize * 1.8,
    width: rectangle.width,
    height: Math.max(0, rectangle.height - fontSize * 1.8),
  }
  if (!series.length || plot.height <= 0) return
  if (element.chart.chartType === 'pie') {
    drawPieChart(page, plot, series, regularFont, fontSize)
    return
  }
  drawBarChart(page, plot, series, regularFont, fontSize)
}

function drawBarChart(
  page: PDFPage,
  rectangle: Rectangle,
  series: readonly ChartSeriesItem[],
  font: PDFFont,
  fontSize: number,
) {
  const rowHeight = rectangle.height / Math.max(series.length, 1)
  const labelWidth = rectangle.width * 0.28
  const valueWidth = rectangle.width * 0.18
  const barWidth = Math.max(0, rectangle.width - labelWidth - valueWidth - 8)
  const maximum = Math.max(1, ...series.map((item) => Math.abs(item.value)))
  series.forEach((item, index) => {
    const y = rectangle.y + index * rowHeight
    drawSingleLine(
      page,
      item.label,
      { x: rectangle.x, y, width: labelWidth, height: rowHeight },
      font,
      Math.min(fontSize, rowHeight * 0.45),
      parseColor('#253c36'),
      'left',
    )
    page.drawRectangle({
      x: rectangle.x + labelWidth,
      y: fromTop(page, y + rowHeight * 0.68),
      width: barWidth * (Math.abs(item.value) / maximum),
      height: Math.max(1, rowHeight * 0.34),
      color: parseColor(CHART_COLORS[index % CHART_COLORS.length] ?? '#234e45'),
    })
    drawSingleLine(
      page,
      new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
        item.value,
      ),
      {
        x: rectangle.x + labelWidth + barWidth + 4,
        y,
        width: valueWidth,
        height: rowHeight,
      },
      font,
      Math.min(fontSize, rowHeight * 0.45),
      parseColor('#253c36'),
      'right',
    )
  })
}

function drawPieChart(
  page: PDFPage,
  rectangle: Rectangle,
  series: readonly ChartSeriesItem[],
  font: PDFFont,
  fontSize: number,
) {
  const radius = Math.min(rectangle.height * 0.42, rectangle.width * 0.22)
  const centerX = rectangle.x + radius + 4
  const centerYTop = rectangle.y + rectangle.height / 2
  const centerY = fromTop(page, centerYTop)
  const total = Math.max(1, sum(series.map((item) => Math.abs(item.value))))
  let angle = -Math.PI / 2
  series.forEach((item, index) => {
    const nextAngle = angle + (Math.abs(item.value) / total) * Math.PI * 2
    drawPieSlice(
      page,
      centerX,
      centerY,
      radius,
      angle,
      nextAngle,
      parseColor(CHART_COLORS[index % CHART_COLORS.length] ?? '#234e45'),
    )
    angle = nextAngle
  })
  const legendX = centerX + radius + 12
  const legendWidth = Math.max(0, rectangle.x + rectangle.width - legendX)
  const rowHeight = rectangle.height / Math.max(series.length, 1)
  series.forEach((item, index) => {
    const y = rectangle.y + index * rowHeight
    page.drawRectangle({
      x: legendX,
      y: fromTop(page, y + rowHeight * 0.65),
      width: 7,
      height: 7,
      color: parseColor(CHART_COLORS[index % CHART_COLORS.length] ?? '#234e45'),
    })
    drawSingleLine(
      page,
      `${item.label} (${((Math.abs(item.value) / total) * 100).toFixed(1)}%)`,
      { x: legendX + 10, y, width: legendWidth - 10, height: rowHeight },
      font,
      Math.min(fontSize, rowHeight * 0.45),
      parseColor('#253c36'),
      'left',
    )
  })
}

function drawPieSlice(
  page: PDFPage,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: RGB,
) {
  const maximumStep = Math.PI / 24
  const steps = Math.max(1, Math.ceil((endAngle - startAngle) / maximumStep))
  for (let index = 0; index < steps; index++) {
    const firstAngle = startAngle + ((endAngle - startAngle) * index) / steps
    const secondAngle =
      startAngle + ((endAngle - startAngle) * (index + 1)) / steps
    const firstX = radius * Math.cos(firstAngle)
    const firstY = radius * Math.sin(firstAngle)
    const secondX = radius * Math.cos(secondAngle)
    const secondY = radius * Math.sin(secondAngle)
    page.drawSvgPath(`M 0 0 L ${firstX} ${firstY} L ${secondX} ${secondY} Z`, {
      x: centerX,
      y: centerY,
      color,
      borderColor: color,
      borderWidth: 0.4,
    })
  }
}

function drawIndependentTable(
  page: PDFPage,
  element: ReportElement,
  rectangle: Rectangle,
  table: DataTableResult,
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  if (!element.dataTable || !table.headers.length) return
  const fontSize = Math.max(6, element.style.fontSize ?? 8)
  const titleHeight = element.dataTable.showTitle === false ? 0 : fontSize * 1.7
  if (titleHeight)
    drawSingleLine(
      page,
      element.dataTable.title,
      { ...rectangle, height: titleHeight },
      boldFont,
      fontSize,
      parseColor(element.style.color ?? '#253c36'),
      'left',
    )
  const availableHeight = rectangle.height - titleHeight
  const requestedRows = table.rows.length + 1 + (table.totals ? 1 : 0)
  const rowHeight = Math.max(fontSize * 1.6, availableHeight / requestedRows)
  const visibleBodyRows = Math.max(
    0,
    Math.floor(availableHeight / rowHeight) - 1 - (table.totals ? 1 : 0),
  )
  const rows = table.rows.slice(0, visibleBodyRows)
  const allRows = [
    table.headers,
    ...rows,
    ...(table.totals ? [table.totals] : []),
  ]
  const columnWidths = table.columnWeights.map(
    (weight) => rectangle.width * weight,
  )
  allRows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const columnX = columnWidths
        .slice(0, columnIndex)
        .reduce((total, width) => total + width, 0)
      const cellRectangle = {
        x: rectangle.x + columnX,
        y: rectangle.y + titleHeight + rowIndex * rowHeight,
        width: columnWidths[columnIndex] ?? 0,
        height: rowHeight,
      }
      page.drawRectangle({
        x: cellRectangle.x,
        y: fromTop(page, cellRectangle.y + cellRectangle.height),
        width: cellRectangle.width,
        height: cellRectangle.height,
        color: parseColor(
          rowIndex === 0
            ? (element.dataTable?.headerBackgroundColor ?? '#eef2ef')
            : row === table.totals
              ? '#eef2ef'
              : (element.dataTable?.cellBackgroundColor ?? '#ffffff'),
        ),
        borderColor: parseColor(element.dataTable?.borderColor ?? '#dedfd7'),
        borderWidth: 0.5,
      })
      drawWrappedText(
        page,
        cell,
        cellRectangle,
        rowIndex === 0 || row === table.totals ? boldFont : regularFont,
        fontSize,
        parseColor(
          rowIndex === 0
            ? (element.dataTable?.headerTextColor ?? '#253c36')
            : (element.dataTable?.cellTextColor ?? '#253c36'),
        ),
        columnIndex === 0 ? 'left' : 'right',
        2,
      )
    })
  })
}

async function loadFont(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('A fonte Noto Sans não pôde ser carregada.')
  return new Uint8Array(await response.arrayBuffer())
}

function drawPageBackground(page: PDFPage, request: PdfRenderRequest) {
  const { width, height } = page.getSize()
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: parseColor(request.configuration.colors.background),
  })
}

function drawHeading(
  page: PDFPage,
  request: PdfRenderRequest,
  layout: ReturnType<typeof calculateReportLayout>['pages'][number],
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const { configuration, generatedAt } = request
  if (elementIsVisible(request, 'title', layout.index))
    drawWrappedText(
      page,
      configuration.title,
      layout.title,
      boldFont,
      configuration.titleFontSize,
      parseColor(configuration.colors.title),
      configuration.titleAlignment,
      0,
    )
  if (
    configuration.subtitle &&
    elementIsVisible(request, 'subtitle', layout.index)
  )
    drawWrappedText(
      page,
      configuration.subtitle,
      layout.subtitle,
      regularFont,
      configuration.subtitleFontSize,
      parseColor(configuration.colors.subtitle),
      configuration.titleAlignment,
      0,
    )
  if (
    configuration.showDate &&
    elementIsVisible(request, 'date', layout.index)
  ) {
    const format: Intl.DateTimeFormatOptions = configuration.showTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' }
    drawSingleLine(
      page,
      new Intl.DateTimeFormat('pt-BR', format).format(generatedAt),
      layout.date,
      regularFont,
      configuration.bodyFontSize,
      parseColor(configuration.colors.subtitle),
      'right',
    )
  }
}

function drawTable(
  page: PDFPage,
  request: PdfRenderRequest,
  layout: ReturnType<typeof calculateReportLayout>['pages'][number],
  headerHeight: number,
  columns: readonly ReportColumnConfiguration[],
  columnIndexes: ReadonlyMap<string, number>,
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const { configuration, data } = request
  const border = parseColor(configuration.colors.border)
  const headerBackground = parseColor(configuration.colors.tableHeader)
  const headerText = parseColor(configuration.colors.tableHeaderText)
  const cellBackground = parseColor(configuration.colors.cell)
  const cellText = parseColor(configuration.colors.cellText)
  const configuredPadding = mmToPoints(configuration.cellPaddingMm)
  const configuredWidth = columns.reduce(
    (total, column) => total + mmToPoints(column.widthMm),
    0,
  )
  const widthScale =
    configuredWidth > 0 ? layout.table.width / configuredWidth : 1
  const widths = columns.map(
    (column) => mmToPoints(column.widthMm) * widthScale,
  )
  const bodyHeight = layout.rowHeights.reduce(
    (total, height) => total + height,
    0,
  )
  drawTableAreas(
    page,
    layout.table,
    headerHeight,
    bodyHeight,
    headerBackground,
    cellBackground,
    border,
  )
  drawTableGrid(
    page,
    layout.table,
    headerHeight,
    layout.rowHeights,
    widths,
    border,
  )
  let x = layout.table.x

  columns.forEach((column, index) => {
    const width = widths[index] ?? 0
    const padding = effectiveCellPadding(width, configuredPadding)
    drawWrappedText(
      page,
      column.label,
      { x, y: layout.table.y, width, height: headerHeight },
      boldFont,
      configuration.bodyFontSize,
      headerText,
      column.alignment,
      padding,
    )
    x += width
  })

  let y = layout.table.y + headerHeight
  for (
    let localIndex = 0;
    localIndex < layout.rowHeights.length;
    localIndex++
  ) {
    const rowIndex = layout.rowStart + localIndex
    const row = data.rows[rowIndex]
    const height = layout.rowHeights[localIndex]
    if (!row || height === undefined) continue
    x = layout.table.x
    columns.forEach((column, columnIndex) => {
      const width = widths[columnIndex] ?? 0
      const padding = effectiveCellPadding(width, configuredPadding)
      const rectangle = { x, y, width, height }
      const sourceIndex = columnIndexes.get(column.sourceId)
      const value: CellValue | undefined =
        sourceIndex === undefined ? undefined : row[sourceIndex]
      drawWrappedText(
        page,
        formatReportValue(value, column),
        rectangle,
        regularFont,
        configuration.bodyFontSize,
        cellText,
        column.alignment,
        padding,
      )
      x += width
    })
    y += height
  }
}

function drawFooter(
  page: PDFPage,
  request: PdfRenderRequest,
  layout: ReturnType<typeof calculateReportLayout>['pages'][number],
  pageCount: number,
  font: PDFFont,
) {
  const { configuration } = request
  const showFooter =
    Boolean(configuration.footerText) &&
    elementIsVisible(request, 'footer', layout.index)
  const showPageNumber =
    configuration.showPageNumbers &&
    elementIsVisible(request, 'pageNumber', layout.index)
  if (!showFooter && !showPageNumber) return
  const color = parseColor(configuration.colors.subtitle)
  const border = parseColor(configuration.colors.border)
  const lineY = fromTop(page, layout.footer.y - 4)
  page.drawLine({
    start: { x: layout.footer.x, y: lineY },
    end: {
      x: layout.pageNumber.x + layout.pageNumber.width,
      y: lineY,
    },
    thickness: 0.5,
    color: border,
  })
  if (showFooter)
    drawWrappedText(
      page,
      configuration.footerText,
      layout.footer,
      font,
      configuration.bodyFontSize,
      color,
      'left',
      0,
    )
  if (showPageNumber)
    drawSingleLine(
      page,
      `Página ${layout.index + 1} de ${pageCount}`,
      layout.pageNumber,
      font,
      configuration.bodyFontSize,
      color,
      'right',
    )
}

async function embedReportImage(
  document: PDFDocument,
  dataUrl: string,
  mimeType: 'image/png' | 'image/jpeg',
): Promise<PDFImage> {
  const response = await fetch(dataUrl)
  const bytes = await response.arrayBuffer()
  return mimeType === 'image/png'
    ? document.embedPng(bytes)
    : document.embedJpg(bytes)
}

function drawImage(page: PDFPage, image: PDFImage, rectangle: Rectangle) {
  const scale = Math.min(
    rectangle.width / image.width,
    rectangle.height / image.height,
  )
  const width = image.width * scale
  const height = image.height * scale
  page.drawImage(image, {
    x: rectangle.x + (rectangle.width - width) / 2,
    y: fromTop(page, rectangle.y + (rectangle.height + height) / 2),
    width,
    height,
  })
}

function elementIsVisible(
  request: PdfRenderRequest,
  type: Parameters<typeof findReportElement>[1],
  pageIndex: number,
): boolean {
  const element = findReportElement(request.elements, type)
  if (!element) return true
  return (
    element.visible &&
    (element.repeatOnEveryPage || (element.pageIndex ?? 0) === pageIndex)
  )
}

function drawTableAreas(
  page: PDFPage,
  table: Rectangle,
  headerHeight: number,
  bodyHeight: number,
  headerBackground: RGB,
  cellBackground: RGB,
  border: RGB,
) {
  page.drawRectangle({
    x: table.x,
    y: fromTop(page, table.y + headerHeight),
    width: table.width,
    height: headerHeight,
    color: headerBackground,
    borderColor: border,
    borderWidth: 0.5,
  })
  if (bodyHeight > 0)
    page.drawRectangle({
      x: table.x,
      y: fromTop(page, table.y + headerHeight + bodyHeight),
      width: table.width,
      height: bodyHeight,
      color: cellBackground,
      borderColor: border,
      borderWidth: 0.5,
    })
}

function drawTableGrid(
  page: PDFPage,
  table: Rectangle,
  headerHeight: number,
  rowHeights: readonly number[],
  widths: readonly number[],
  color: RGB,
) {
  const bottom = table.y + headerHeight + sum(rowHeights)
  let x = table.x
  for (const width of widths.slice(0, -1)) {
    x += width
    drawLine(page, x, table.y, x, bottom, color)
  }
  let y = table.y + headerHeight
  for (const height of rowHeights.slice(0, -1)) {
    y += height
    drawLine(page, table.x, y, table.x + table.width, y, color)
  }
}

function drawLine(
  page: PDFPage,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: RGB,
) {
  page.drawLine({
    start: { x: startX, y: fromTop(page, startY) },
    end: { x: endX, y: fromTop(page, endY) },
    thickness: 0.5,
    color,
  })
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  rectangle: Rectangle,
  font: PDFFont,
  size: number,
  color: RGB,
  alignment: TextAlignment,
  padding: number,
) {
  const lines = wrapReportText(
    text,
    rectangle.width - padding * 2,
    size,
    (value, fontSize) => font.widthOfTextAtSize(value, fontSize),
  )
  const lineHeight = size * 1.25
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size)
    const x = alignedX(
      rectangle.x + padding,
      rectangle.width - padding * 2,
      lineWidth,
      alignment,
    )
    page.drawText(line, {
      x,
      y: fromTop(page, rectangle.y + padding + size + index * lineHeight),
      size,
      font,
      color,
    })
  })
}

function drawSingleLine(
  page: PDFPage,
  text: string,
  rectangle: Rectangle,
  font: PDFFont,
  size: number,
  color: RGB,
  alignment: TextAlignment,
) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, {
    x: alignedX(rectangle.x, rectangle.width, width, alignment),
    y: fromTop(page, rectangle.y + size),
    size,
    font,
    color,
  })
}

function alignedX(
  x: number,
  availableWidth: number,
  textWidth: number,
  alignment: TextAlignment,
): number {
  if (alignment === 'center') return x + (availableWidth - textWidth) / 2
  if (alignment === 'right') return x + availableWidth - textWidth
  return x
}

function fromTop(page: PDFPage, top: number): number {
  return page.getHeight() - top
}

function parseColor(value: string): RGB {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
  if (!match) throw new Error(`Cor inválida: ${value}`)
  return rgb(
    Number.parseInt(match[1] ?? '0', 16) / 255,
    Number.parseInt(match[2] ?? '0', 16) / 255,
    Number.parseInt(match[3] ?? '0', 16) / 255,
  )
}
