import {
  formatCell,
  type CellValue,
  type WorksheetData,
} from '../workbook/Workbook'
import {
  formatReportValue,
  type ReportColors,
  type ReportConfiguration,
} from './ReportConfiguration'
import type {
  DataTableDefinition,
  DataFieldDefinition,
  DetectedPdfText,
  PdfTemplateAsset,
  ReportElement,
} from './ReportTemplate'

export function createDetectedDataFields(
  template: PdfTemplateAsset,
  data: WorksheetData,
): readonly ReportElement[] {
  const candidates = createCellCandidates(data)
  const fields: ReportElement[] = []

  template.pages.forEach((page, pageIndex) => {
    for (const detected of page.detectedTexts) {
      const match = findMatchingCell(detected, candidates)
      if (!match) continue
      const totalizer = detectedTotalizer(
        data,
        match,
        page.detectedTexts,
        detected,
      )
      fields.push({
        id: `pdf-field-${pageIndex}-${fields.length}`,
        type: 'dataField',
        visible: true,
        position: { x: detected.x, y: detected.y },
        size: {
          width: Math.min(
            1 - detected.x,
            Math.max(detected.width * 1.3, 0.045),
          ),
          height: Math.max(detected.height * 1.25, 0.018),
        },
        keepAspectRatio: false,
        style: {
          color: detected.color ?? '#222222',
          backgroundColor: detected.backgroundColor ?? '#ffffff',
          fontSize: Math.max(6, Math.min(48, detected.fontSize * 0.94)),
          alignment: typeof match.value === 'number' ? 'right' : 'left',
        },
        pageIndex,
        repeatOnEveryPage: false,
        dataField: {
          sourceId: match.sourceId,
          rowIndex: match.rowIndex,
          ...(totalizer
            ? { label: totalizer.label, semanticRole: totalizer.role }
            : {}),
          prefix: match.prefix,
          suffix: match.suffix,
          originalText: detected.text,
          matchConfidence: match.confidence,
          matchReason: match.reason,
          ...numberDisplayOptions(detected.text, match.value),
        },
      })
    }
  })
  return fields.slice(0, 300)
}

export function colorsDetectedFromPdf(
  template: PdfTemplateAsset,
  elements: readonly ReportElement[],
  fallback: ReportColors,
): ReportColors {
  const texts = template.pages.flatMap((page) => page.detectedTexts)
  const shapes = template.pages.flatMap((page) => page.detectedShapes ?? [])
  const reconstructedTable = elements.find(
    (element) =>
      element.type === 'dataTable' &&
      element.dataTable?.reconstructionConfidence !== undefined,
  )?.dataTable
  const title = [...texts]
    .filter((text) => text.text.trim())
    .sort(
      (left, right) =>
        right.fontSize * right.width - left.fontSize * left.width,
    )[0]
  const textColor = dominantColor(
    texts.map((text) => text.color).filter(isDetectedColor),
  )
  const background = dominantColor(
    texts.map((text) => text.backgroundColor).filter(isDetectedColor),
  )
  const border = dominantColor(
    shapes.map((shape) => shape.borderColor).filter(isDetectedColor),
  )
  const accent =
    reconstructedTable?.headerBackgroundColor ??
    dominantColor(
      shapes
        .map((shape) => shape.fillColor)
        .filter(isDetectedColor)
        .filter((color) => !isNearlyWhite(color)),
    ) ??
    title?.color

  return {
    background:
      background && isNearlyWhite(background) ? background : '#ffffff',
    title: title?.color ?? accent ?? textColor ?? fallback.title,
    subtitle: textColor ?? fallback.subtitle,
    tableHeader: accent ?? fallback.tableHeader,
    tableHeaderText:
      reconstructedTable?.headerTextColor ??
      textColor ??
      fallback.tableHeaderText,
    cell:
      reconstructedTable?.cellBackgroundColor ?? background ?? fallback.cell,
    cellText:
      reconstructedTable?.cellTextColor ?? textColor ?? fallback.cellText,
    border: reconstructedTable?.borderColor ?? border ?? fallback.border,
  }
}

function detectedTotalizer(
  data: WorksheetData,
  match: CellCandidate,
  pageTexts: readonly DetectedPdfText[],
  valueText: DetectedPdfText,
):
  | { label: string; role: NonNullable<DataFieldDefinition['semanticRole']> }
  | undefined {
  const columnIndex = data.columns.find(
    (column) => column.id === match.sourceId,
  )?.index
  const pdfLabel = pageTexts
    .filter((candidate) => {
      const verticalDistance = Math.abs(
        candidate.y +
          candidate.height / 2 -
          (valueText.y + valueText.height / 2),
      )
      return (
        candidate.x < valueText.x &&
        verticalDistance <= Math.max(0.012, valueText.height)
      )
    })
    .sort((left, right) => right.x - left.x)
    .find((candidate) => totalizerRole(candidate.text))?.text
  const worksheetLabel = data.rows[match.rowIndex]
    ?.filter(
      (value, index) =>
        index !== columnIndex && typeof value === 'string' && value.trim(),
    )
    .map(String)
    .at(-1)
  const label = pdfLabel ?? worksheetLabel
  if (!label) return undefined
  const role = totalizerRole(label)
  return role ? { label, role } : undefined
}

function totalizerRole(
  label: string,
): NonNullable<DataFieldDefinition['semanticRole']> | undefined {
  const normalized = normalize(label)
  if (normalized.includes('subtotal')) return 'subtotal'
  if (normalized.includes('desconto')) return 'discount'
  if (normalized.includes('base tribut')) return 'taxBase'
  if (normalized.includes('icms') || normalized.includes('imposto'))
    return 'tax'
  if (normalized.includes('total')) return 'grandTotal'
  if (
    normalized.includes('media') ||
    normalized.includes('faltas') ||
    normalized.includes('saldo')
  )
    return 'totalizer'
  return undefined
}

function dominantColor(colors: readonly string[]): string | undefined {
  const counts = new Map<string, number>()
  for (const color of colors) {
    const normalized = color.toLowerCase()
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0]
}

function isDetectedColor(color: string | undefined): color is string {
  return Boolean(color && /^#[0-9a-f]{6}$/i.test(color))
}

function isNearlyWhite(color: string): boolean {
  return [1, 3, 5].every(
    (index) => Number.parseInt(color.slice(index, index + 2), 16) >= 238,
  )
}

export function createReconstructedPdfTables(
  template: PdfTemplateAsset,
  data: WorksheetData,
): readonly ReportElement[] {
  return template.pages.flatMap((page, pageIndex) => {
    const candidate = detectTableCandidate(page.detectedTexts, data)
    if (!candidate) return []
    return [
      {
        id: `reconstructed-table-${pageIndex}`,
        type: 'dataTable' as const,
        visible: true,
        position: { x: candidate.left, y: candidate.top },
        size: {
          width: candidate.right - candidate.left,
          height: candidate.bottom - candidate.top,
        },
        keepAspectRatio: false,
        style: {
          color: '#253c36',
          backgroundColor: '#ffffff',
          fontSize: candidate.fontSize,
        },
        pageIndex,
        repeatOnEveryPage: false,
        dataTable: {
          title: 'Tabela reconstruída',
          sourceIds: candidate.headers.map((header) => header.sourceId),
          columnWidths: candidate.columnWidths,
          sortSourceId: candidate.headers[0]?.sourceId ?? data.columns[0]!.id,
          sortDirection: 'original' as const,
          limit: Math.max(
            1,
            Math.min(
              100,
              candidate.bodyRowCount || Math.min(data.rows.length, 10),
            ),
          ),
          showRank: false,
          showTotals: false,
          showTitle: false,
          reconstructionConfidence: candidate.confidence,
          headerBackgroundColor: candidate.headerBackgroundColor,
          headerTextColor: candidate.headerTextColor,
          cellBackgroundColor: candidate.cellBackgroundColor,
          cellTextColor: candidate.cellTextColor,
          borderColor: '#b9b9b9',
          columnFormats: candidate.columnFormats,
        },
      },
    ]
  })
}

export function createEditablePdfElements(
  template: PdfTemplateAsset,
  data: WorksheetData,
): readonly ReportElement[] {
  const tables = createReconstructedPdfTables(template, data)
  const fields = createDetectedDataFields(template, data).filter(
    (field) => !tables.some((table) => elementCenterInside(field, table)),
  )
  const shapes: ReportElement[] = []
  const texts: ReportElement[] = []

  template.pages.forEach((page, pageIndex) => {
    for (const [index, detected] of (page.detectedShapes ?? []).entries()) {
      const x = clampUnit(detected.x)
      const y = clampUnit(detected.y)
      const shape: ReportElement = {
        id: `pdf-shape-${pageIndex}-${index}`,
        type: 'shape',
        visible: true,
        position: { x, y },
        size: {
          width: Math.min(1 - x, Math.max(0.001, detected.width)),
          height: Math.min(1 - y, Math.max(0.001, detected.height)),
        },
        keepAspectRatio: false,
        style: {
          color: detected.borderColor ?? detected.fillColor ?? '#777777',
          backgroundColor: detected.fillColor,
        },
        pageIndex,
        repeatOnEveryPage: false,
        shape: {
          kind: detected.kind,
          borderWidth: detected.borderWidth ?? 0.7,
        },
      }
      if (!tables.some((table) => elementCenterInside(shape, table)))
        shapes.push(shape)
    }

    for (const [index, detected] of page.detectedTexts.entries()) {
      if (!detected.text.trim()) continue
      const x = clampUnit(detected.x)
      const y = clampUnit(detected.y)
      const textElement: ReportElement = {
        id: `pdf-text-${pageIndex}-${index}`,
        type: 'customText',
        visible: true,
        position: { x, y },
        size: {
          width: Math.min(1 - x, Math.max(0.012, detected.width * 1.08)),
          height: Math.min(1 - y, Math.max(0.012, detected.height * 1.35)),
        },
        keepAspectRatio: false,
        style: {
          color: detected.color ?? '#222222',
          fontSize: detected.fontSize,
          alignment: 'left',
          bold: detected.bold,
        },
        pageIndex,
        repeatOnEveryPage: false,
        content: detected.text,
      }
      if (tables.some((table) => elementCenterInside(textElement, table)))
        continue
      if (fields.some((field) => elementsShareCenter(textElement, field)))
        continue
      texts.push(textElement)
    }
  })

  return attachElementsToDetectedParents([
    ...shapes,
    ...texts,
    ...tables,
    ...fields,
  ])
}

function attachElementsToDetectedParents(
  elements: readonly ReportElement[],
): ReportElement[] {
  const parents = elements.filter(
    (element) =>
      element.type === 'shape' &&
      element.shape?.kind === 'rectangle' &&
      element.size.width * element.size.height <= 0.35,
  )
  return elements.map((element) => {
    if (element.type === 'shape') return element
    const centerX = element.position.x + element.size.width / 2
    const centerY = element.position.y + element.size.height / 2
    const parent = parents
      .filter(
        (candidate) =>
          (candidate.pageIndex ?? 0) === (element.pageIndex ?? 0) &&
          centerX >= candidate.position.x &&
          centerX <= candidate.position.x + candidate.size.width &&
          centerY >= candidate.position.y &&
          centerY <= candidate.position.y + candidate.size.height,
      )
      .sort(
        (left, right) =>
          left.size.width * left.size.height -
          right.size.width * right.size.height,
      )[0]
    return parent ? { ...element, parentId: parent.id } : element
  })
}

function clampUnit(value: number): number {
  return Math.min(0.999, Math.max(0, value))
}

function elementsShareCenter(
  left: ReportElement,
  right: ReportElement,
): boolean {
  if ((left.pageIndex ?? 0) !== (right.pageIndex ?? 0)) return false
  const leftCenterX = left.position.x + left.size.width / 2
  const leftCenterY = left.position.y + left.size.height / 2
  const rightCenterX = right.position.x + right.size.width / 2
  const rightCenterY = right.position.y + right.size.height / 2
  return (
    Math.abs(leftCenterX - rightCenterX) <=
      Math.max(left.size.width, right.size.width) / 2 &&
    Math.abs(leftCenterY - rightCenterY) <=
      Math.max(left.size.height, right.size.height) / 2
  )
}

function elementCenterInside(
  element: ReportElement,
  container: ReportElement,
): boolean {
  if ((element.pageIndex ?? 0) !== (container.pageIndex ?? 0)) return false
  const centerX = element.position.x + element.size.width / 2
  const centerY = element.position.y + element.size.height / 2
  return (
    centerX >= container.position.x &&
    centerX <= container.position.x + container.size.width &&
    centerY >= container.position.y &&
    centerY <= container.position.y + container.size.height
  )
}

interface DetectedTextRow {
  top: number
  bottom: number
  items: DetectedPdfText[]
}

interface MatchedHeader {
  text: DetectedPdfText
  sourceId: string
  score: number
}

interface DetectedTableCandidate {
  left: number
  top: number
  right: number
  bottom: number
  headers: readonly MatchedHeader[]
  columnWidths: number[]
  bodyRowCount: number
  fontSize: number
  confidence: number
  headerBackgroundColor?: string
  headerTextColor?: string
  cellBackgroundColor?: string
  cellTextColor?: string
  columnFormats: DataTableDefinition['columnFormats']
}

function detectTableCandidate(
  texts: readonly DetectedPdfText[],
  data: WorksheetData,
): DetectedTableCandidate | undefined {
  if (data.columns.length < 2) return undefined
  const rows = groupTextRows(texts)
  const candidates = rows.flatMap((row, rowIndex) => {
    const headers = matchHeaderRow(row, data)
    if (headers.length < 2) return []
    const confidence =
      headers.reduce((total, header) => total + header.score, 0) /
      headers.length
    return [{ row, rowIndex, headers, confidence }]
  })
  const selected = candidates.sort(
    (left, right) =>
      right.headers.length - left.headers.length ||
      right.confidence - left.confidence,
  )[0]
  if (!selected) return undefined

  const headers = [...selected.headers].sort(
    (left, right) => left.text.x - right.text.x,
  )
  const firstHeaderX = headers[0]?.text.x ?? 0
  const headerRight = Math.max(
    ...headers.map((header) => header.text.x + header.text.width),
  )
  const lastHeaderWidth = headers.at(-1)?.text.width ?? 0.05
  const rightPadding = Math.max(0.07, Math.min(0.2, lastHeaderWidth * 1.9))
  const provisionalLeft = Math.max(0, firstHeaderX - 0.15)
  const provisionalRight = Math.min(
    1,
    headerRight + Math.max(0.15, rightPadding),
  )
  const top = Math.max(0, selected.row.top - 0.03)
  const bodyRows: DetectedTextRow[] = []
  const requiredBodyCells = Math.max(2, Math.ceil(headers.length / 2))
  let previousBottom = selected.row.bottom
  const maximumGap = Math.max(
    0.06,
    (selected.row.bottom - selected.row.top) * 4,
  )

  for (const row of rows.slice(selected.rowIndex + 1)) {
    const gap = row.top - previousBottom
    if (gap > maximumGap) break
    const alignedItems = row.items.filter((item) => {
      const center = item.x + item.width / 2
      return center >= provisionalLeft && center <= provisionalRight
    })
    const secondColumnX = headers[1]?.text.x ?? provisionalRight
    const firstColumnEnd = (firstHeaderX + secondColumnX) / 2
    const hasFirstColumnCell = alignedItems.some(
      (item) => item.x + item.width / 2 < firstColumnEnd,
    )
    if (alignedItems.length >= requiredBodyCells && hasFirstColumnCell) {
      bodyRows.push({ ...row, items: alignedItems })
      previousBottom = row.bottom
    } else if (bodyRows.length) break
    if (row.bottom - top > 0.65 || bodyRows.length >= 100) break
  }

  const tableTexts = [
    ...headers.map((header) => header.text),
    ...bodyRows.flatMap((row) => row.items),
  ]
  const contentLeft = Math.min(...tableTexts.map((text) => text.x))
  const contentRight = Math.max(
    ...tableTexts.map((text) => text.x + text.width),
  )
  const left = Math.max(0, contentLeft - 0.01)
  const right = Math.min(
    1,
    Math.max(headerRight + rightPadding, contentRight + 0.015),
  )
  const naturalBottom = bodyRows.at(-1)?.bottom ?? selected.row.bottom + 0.2
  const bottom = Math.min(1, Math.max(top + 0.12, naturalBottom + 0.012))
  const columnWidths = headers.map((header, index) => {
    const start = index === 0 ? left : header.text.x
    const end = headers[index + 1]?.text.x ?? right
    return Math.max(5, ((end - start) / Math.max(0.01, right - left)) * 100)
  })
  const cellCandidates = createCellCandidates(data)
  const columnFormats = headers.map((header, index) => {
    const previousX = headers[index - 1]?.text.x
    const nextX = headers[index + 1]?.text.x
    const start =
      previousX === undefined ? left : (previousX + header.text.x) / 2
    const end = nextX === undefined ? right : (header.text.x + nextX) / 2
    for (const item of bodyRows.flatMap((row) => row.items)) {
      const center = item.x + item.width / 2
      if (center < start || center >= end) continue
      const match = findMatchingCell(item, cellCandidates)
      if (!match || match.sourceId !== header.sourceId) continue
      return {
        prefix: match.prefix,
        suffix: match.suffix,
        ...numberDisplayOptions(item.text, match.value),
      }
    }
    return { prefix: '', suffix: '' }
  })
  const firstBodyText = bodyRows.flatMap((row) => row.items)[0]

  return {
    left,
    top,
    right,
    bottom,
    headers,
    columnWidths,
    bodyRowCount: bodyRows.length,
    fontSize: Math.max(
      6,
      Math.min(
        14,
        headers.reduce((total, header) => total + header.text.fontSize, 0) /
          headers.length,
      ),
    ),
    confidence: selected.confidence,
    headerBackgroundColor: headers[0]?.text.backgroundColor,
    headerTextColor: headers[0]?.text.color,
    cellBackgroundColor: firstBodyText?.backgroundColor,
    cellTextColor: firstBodyText?.color,
    columnFormats,
  }
}

function groupTextRows(
  texts: readonly DetectedPdfText[],
): readonly DetectedTextRow[] {
  const rows: DetectedTextRow[] = []
  for (const text of [...texts]
    .filter((item) => item.text.trim())
    .sort((left, right) => left.y - right.y || left.x - right.x)) {
    const previous = rows.at(-1)
    const tolerance = Math.max(0.008, text.height * 0.75)
    if (previous && Math.abs(previous.top - text.y) <= tolerance) {
      previous.items.push(text)
      previous.top = Math.min(previous.top, text.y)
      previous.bottom = Math.max(previous.bottom, text.y + text.height)
    } else
      rows.push({
        top: text.y,
        bottom: text.y + text.height,
        items: [text],
      })
  }
  return rows
}

function matchHeaderRow(
  row: DetectedTextRow,
  data: WorksheetData,
): readonly MatchedHeader[] {
  const usedSourceIds = new Set<string>()
  const matches: MatchedHeader[] = []
  for (const text of row.items) {
    const normalizedText = normalize(text.text)
    const best = data.columns
      .map((column) => ({
        sourceId: column.id,
        score: headerSimilarity(normalizedText, normalize(column.label)),
      }))
      .filter(
        (candidate) =>
          candidate.score >= 0.75 && !usedSourceIds.has(candidate.sourceId),
      )
      .sort((left, right) => right.score - left.score)[0]
    if (!best) continue
    usedSourceIds.add(best.sourceId)
    matches.push({ text, sourceId: best.sourceId, score: best.score })
  }
  return matches
}

function headerSimilarity(left: string, right: string): number {
  if (!left || !right) return 0
  if (left === right) return 1
  if (
    headerConcept(left) !== undefined &&
    headerConcept(left) === headerConcept(right)
  )
    return 0.9
  if (Math.min(left.length, right.length) >= 4) {
    if (left.includes(right) || right.includes(left)) return 0.85
  }
  const leftWords = new Set(left.split(' '))
  const rightWords = new Set(right.split(' '))
  const intersection = [...leftWords].filter((word) => rightWords.has(word))
  const union = new Set([...leftWords, ...rightWords])
  return intersection.length / Math.max(1, union.size)
}

function headerConcept(value: string): string | undefined {
  const words = new Set(value.split(/[^a-z0-9]+/).filter(Boolean))
  if (
    ['quantidade', 'qtd', 'qtde', 'unidade', 'unidades', 'qty'].some((alias) =>
      words.has(alias),
    )
  )
    return 'quantity'
  return undefined
}

export function dataFieldValue(
  element: ReportElement,
  data: WorksheetData,
  configuration?: ReportConfiguration,
): string {
  const definition = element.dataField
  if (!definition) return ''
  const column = data.columns.find(
    (candidate) => candidate.id === definition.sourceId,
  )
  const value = column
    ? data.rows[definition.rowIndex]?.[column.index]
    : undefined
  const reportColumn = configuration?.columns.find(
    (candidate) => candidate.sourceId === definition.sourceId,
  )
  if (typeof value === 'number' && definition.suffix.trim() === '%')
    return `${formatDetectedNumber(
      value * 100,
      definition.decimalSeparator ?? ',',
      definition.fractionDigits ?? 1,
    )}%`
  if (typeof value === 'number' && definition.decimalSeparator)
    return `${definition.prefix}${formatDetectedNumber(
      value,
      definition.decimalSeparator,
      definition.fractionDigits ?? 0,
      definition.thousandsSeparator,
    )}${definition.suffix}`
  if (typeof value === 'number' && definition.thousandsSeparator)
    return `${definition.prefix}${formatDetectedNumber(
      value,
      undefined,
      0,
      definition.thousandsSeparator,
    )}${definition.suffix}`
  const formatted = reportColumn
    ? formatReportValue(value, reportColumn)
    : formatCell(value)
  const prefix =
    definition.prefix.trim() === 'R$' && formatted.trim().startsWith('R$')
      ? ''
      : definition.prefix
  return `${prefix}${formatted}${definition.suffix}`
}

export function dataFieldMatchesOriginal(
  element: ReportElement,
  data: WorksheetData,
  configuration?: ReportConfiguration,
): boolean {
  const original = element.dataField?.originalText
  if (!original) return false
  const current = dataFieldValue(element, data, configuration)
  const originalNumber = parseLocalizedNumber(original)
  const currentNumber = parseLocalizedNumber(current)
  if (originalNumber !== null && currentNumber !== null)
    return Math.abs(originalNumber - currentNumber) < 0.000_001
  return normalize(original) === normalize(current)
}

function numberDisplayOptions(
  detectedText: string,
  value: CellValue,
): Partial<
  Pick<
    DataFieldDefinition,
    'decimalSeparator' | 'thousandsSeparator' | 'fractionDigits'
  >
> {
  if (typeof value !== 'number') return {}
  const numericText = detectedText
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
  const commaIndex = numericText.lastIndexOf(',')
  const dotIndex = numericText.lastIndexOf('.')
  const separatorIndex = Math.max(commaIndex, dotIndex)
  if (separatorIndex < 0) return { fractionDigits: 0 }
  const separator = commaIndex > dotIndex ? ',' : '.'
  const otherSeparator = separator === ',' ? '.' : ','
  const fractionDigits = numericText.length - separatorIndex - 1
  const hasOtherSeparator = numericText.includes(otherSeparator)

  if (
    !hasOtherSeparator &&
    fractionDigits === 3 &&
    Number.isInteger(value) &&
    parseLocalizedNumber(detectedText) === value
  )
    return { thousandsSeparator: separator, fractionDigits: 0 }

  return {
    decimalSeparator: separator,
    thousandsSeparator: hasOtherSeparator ? otherSeparator : undefined,
    fractionDigits,
  }
}

function formatDetectedNumber(
  value: number,
  separator: ',' | '.' | undefined,
  fractionDigits: number,
  thousandsSeparator?: ',' | '.',
): string {
  const [integer = '0', fraction] = value.toFixed(fractionDigits).split('.')
  const groupedInteger = thousandsSeparator
    ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)
    : integer
  if (!fraction) return groupedInteger
  return `${groupedInteger}${separator ?? '.'}${fraction}`
}

interface CellCandidate {
  sourceId: string
  rowIndex: number
  value: CellValue
  text: string
  normalized: string
  numeric: number | null
  prefix: string
  suffix: string
}

interface MatchedCell extends CellCandidate {
  confidence: number
  reason: 'exact-text' | 'numeric-value'
}

function createCellCandidates(data: WorksheetData): readonly CellCandidate[] {
  return data.rows.slice(0, 500).flatMap((row, rowIndex) =>
    data.columns.flatMap((column) => {
      const value = row[column.index]
      if (value == null || typeof value === 'object') return []
      const text = formatCell(value)
      return [
        {
          sourceId: column.id,
          rowIndex,
          value,
          text,
          normalized: normalize(text),
          numeric: typeof value === 'number' ? value : null,
          prefix: '',
          suffix: '',
        },
      ]
    }),
  )
}

function findMatchingCell(
  detected: DetectedPdfText,
  candidates: readonly CellCandidate[],
): MatchedCell | undefined {
  const normalized = normalize(detected.text)
  if (normalized.length < 2) return undefined
  const exact = candidates.filter(
    (candidate) => candidate.normalized === normalized,
  )
  const uniqueExact = uniqueCell(exact)
  if (uniqueExact)
    return { ...uniqueExact, confidence: 1, reason: 'exact-text' }

  const detectedNumber = parseLocalizedNumber(detected.text)
  if (detectedNumber === null) return undefined
  const tolerance = displayedNumberTolerance(detected.text)
  const numeric = candidates.filter(
    (candidate) =>
      candidate.numeric !== null &&
      Math.abs(candidate.numeric - detectedNumber) <= tolerance,
  )
  const match = uniqueCell(numeric)
  if (!match) return undefined
  return {
    ...match,
    prefix: detected.text.trim().startsWith('R$') ? 'R$ ' : '',
    suffix: detected.text.trim().endsWith('%') ? '%' : '',
    confidence: 0.9,
    reason: 'numeric-value',
  }
}

function displayedNumberTolerance(value: string): number {
  const numericText = value
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
  const separatorIndex = Math.max(
    numericText.lastIndexOf(','),
    numericText.lastIndexOf('.'),
  )
  if (separatorIndex < 0) return 0.000_001
  const fractionDigits = numericText.length - separatorIndex - 1
  const roundingTolerance = 0.5 * 10 ** -fractionDigits + 0.000_000_1
  return value.includes('%') ? roundingTolerance / 100 : roundingTolerance
}

function uniqueCell(
  candidates: readonly CellCandidate[],
): CellCandidate | undefined {
  if (!candidates.length) return undefined
  const keys = new Set(
    candidates.map(
      (candidate) => `${candidate.sourceId}:${candidate.rowIndex}`,
    ),
  )
  return keys.size === 1 ? candidates[0] : undefined
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

function parseLocalizedNumber(value: string): number | null {
  const cleaned = value
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return value.includes('%') ? parsed / 100 : parsed
}
