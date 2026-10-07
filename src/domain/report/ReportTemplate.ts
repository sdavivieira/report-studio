import type { ReportConfiguration, TextAlignment } from './ReportConfiguration'

export const REPORT_TEMPLATE_VERSION = 1 as const

export type ReportElementType =
  | 'title'
  | 'subtitle'
  | 'date'
  | 'table'
  | 'image'
  | 'footer'
  | 'pageNumber'
  | 'customText'
  | 'summary'
  | 'formula'
  | 'chart'
  | 'dataTable'
  | 'dataField'
  | 'shape'

export type SummaryOperation =
  'sum' | 'average' | 'minimum' | 'maximum' | 'count' | 'distinctCount'

export interface SummaryDefinition {
  label: string
  sourceId: string
  operation: SummaryOperation
}

export type FormulaOperator =
  'add' | 'subtract' | 'multiply' | 'divide' | 'percentage'

export interface FormulaDefinition {
  label: string
  leftSourceId: string
  rightSourceId: string
  operator: FormulaOperator
  aggregation: 'sum' | 'average' | 'minimum' | 'maximum'
}

export type ChartType = 'bar' | 'pie'

export interface ChartDefinition {
  title: string
  chartType: ChartType
  categorySourceId: string
  valueSourceId: string
  aggregation: 'sum' | 'average' | 'count'
  maxItems: number
}

export interface DataTableDefinition {
  title: string
  sourceIds: string[]
  columnWidths?: number[]
  sortSourceId: string
  sortDirection: 'original' | 'ascending' | 'descending'
  limit: number
  showRank: boolean
  showTotals: boolean
  showTitle?: boolean
  reconstructionConfidence?: number
  headerBackgroundColor?: string
  headerTextColor?: string
  cellBackgroundColor?: string
  cellTextColor?: string
  borderColor?: string
  columnFormats?: readonly DataTableColumnFormat[]
}

export interface DataTableColumnFormat {
  prefix: string
  suffix: string
  decimalSeparator?: ',' | '.'
  thousandsSeparator?: ',' | '.'
  fractionDigits?: number
}

export interface DataFieldDefinition {
  sourceId: string
  rowIndex: number
  label?: string
  semanticRole?:
    'subtotal' | 'discount' | 'taxBase' | 'tax' | 'grandTotal' | 'totalizer'
  prefix: string
  suffix: string
  originalText?: string
  decimalSeparator?: ',' | '.'
  thousandsSeparator?: ',' | '.'
  fractionDigits?: number
  matchConfidence?: number
  matchReason?: 'exact-text' | 'numeric-value' | 'manual'
}

export interface DetectedPdfText {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  color?: string
  bold?: boolean
  backgroundColor?: string
}

export interface DetectedPdfShape {
  kind: 'rectangle' | 'line'
  x: number
  y: number
  width: number
  height: number
  fillColor?: string
  borderColor?: string
  borderWidth?: number
}

export interface PdfTemplatePage {
  width: number
  height: number
  imageDataUrl: string
  detectedTexts: readonly DetectedPdfText[]
  detectedShapes?: readonly DetectedPdfShape[]
}

export interface PdfTemplateAsset {
  name: string
  sourceDataUrl: string
  pages: readonly PdfTemplatePage[]
  reconstructionMode?: 'reference' | 'editable'
}

export interface ShapeDefinition {
  kind: 'rectangle' | 'line'
  borderWidth: number
}

export interface ElementPosition {
  x: number
  y: number
}

export interface ElementSize {
  width: number
  height: number
}

export interface ElementStyle {
  color?: string
  backgroundColor?: string
  fontSize?: number
  alignment?: TextAlignment
  bold?: boolean
}

export interface ReportElement {
  id: string
  parentId?: string
  type: ReportElementType
  visible: boolean
  position: ElementPosition
  size: ElementSize
  keepAspectRatio: boolean
  style: ElementStyle
  pageIndex?: number
  repeatOnEveryPage?: boolean
  content?: string
  summary?: SummaryDefinition
  formula?: FormulaDefinition
  chart?: ChartDefinition
  dataTable?: DataTableDefinition
  dataField?: DataFieldDefinition
  shape?: ShapeDefinition
}

export interface ReportImage {
  name: string
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
  dataUrl: string
  alternativeText: string
}

export interface TemplateImageReference {
  name: string
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
  alternativeText: string
  embeddedDataUrl?: string
}

export interface ReportTemplate {
  version: typeof REPORT_TEMPLATE_VERSION
  configuration: ReportConfiguration
  elements: readonly ReportElement[]
  image?: TemplateImageReference
}

export const REPORT_ELEMENT_LABELS: Readonly<
  Record<ReportElementType, string>
> = {
  title: 'Título',
  subtitle: 'Subtítulo',
  date: 'Data',
  table: 'Tabela',
  image: 'Imagem ou logotipo',
  footer: 'Rodapé',
  pageNumber: 'Número da página',
  customText: 'Texto livre',
  summary: 'Totalizador',
  formula: 'Fórmula',
  chart: 'Gráfico',
  dataTable: 'Tabela adicional',
  dataField: 'Campo da planilha',
  shape: 'Forma',
}

export function findReportElementById(
  elements: readonly ReportElement[],
  id: string,
): ReportElement | undefined {
  return elements.find((element) => element.id === id)
}

export function reportElementLabel(element: ReportElement): string {
  if (element.type === 'customText')
    return element.content?.trim() || 'Texto livre'
  if (element.type === 'summary')
    return element.summary?.label.trim() || 'Totalizador'
  if (element.type === 'formula')
    return element.formula?.label.trim() || 'Fórmula'
  if (element.type === 'chart') return element.chart?.title.trim() || 'Gráfico'
  if (element.type === 'dataTable')
    return element.dataTable?.title.trim() || 'Tabela adicional'
  if (element.type === 'dataField')
    return element.dataField?.label
      ? `Totalizador: ${element.dataField.label}`
      : 'Campo da planilha'
  if (element.type === 'shape') return 'Forma reconstruída'
  return REPORT_ELEMENT_LABELS[element.type]
}

export function findReportElement(
  elements: readonly ReportElement[],
  type: ReportElementType,
): ReportElement | undefined {
  return elements.find((element) => element.type === type)
}

export function cloneReportElements(
  elements: readonly ReportElement[],
): ReportElement[] {
  return elements.map((element) => ({
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
  }))
}
