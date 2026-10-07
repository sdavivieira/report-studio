import type { CellValue, WorkbookColumn } from '../workbook/Workbook'

export type PageOrientation = 'portrait' | 'landscape'
export type TextAlignment = 'left' | 'center' | 'right'
export type NumberFormat =
  'automatic' | 'integer' | 'decimal' | 'currency' | 'percentage'
export type DateFormat = 'automatic' | 'short' | 'long'

export interface ReportColors {
  background: string
  title: string
  subtitle: string
  tableHeader: string
  tableHeaderText: string
  cell: string
  cellText: string
  border: string
}

export interface ReportColumnConfiguration {
  sourceId: string
  visible: boolean
  order: number
  label: string
  widthMm: number
  alignment: TextAlignment
  numberFormat: NumberFormat
  dateFormat: DateFormat
}

export interface ReportConfiguration {
  pageCount: number
  title: string
  subtitle: string
  showDate: boolean
  showTime: boolean
  footerText: string
  showPageNumbers: boolean
  orientation: PageOrientation
  marginMm: number
  colors: ReportColors
  titleFontSize: number
  subtitleFontSize: number
  bodyFontSize: number
  titleAlignment: TextAlignment
  rowHeightMm: number
  cellPaddingMm: number
  columns: readonly ReportColumnConfiguration[]
}

const PAGE_WIDTH_MM: Record<PageOrientation, number> = {
  portrait: 210,
  landscape: 297,
}

export function availablePageWidth(configuration: ReportConfiguration): number {
  return PAGE_WIDTH_MM[configuration.orientation] - configuration.marginMm * 2
}

export function createDefaultReportConfiguration(
  columns: readonly WorkbookColumn[],
): ReportConfiguration {
  const orientation: PageOrientation =
    columns.length > 5 ? 'landscape' : 'portrait'
  const marginMm = 15
  const availableWidth = PAGE_WIDTH_MM[orientation] - marginMm * 2
  const suggestedWidth = Math.max(
    8,
    Math.min(45, Math.floor(availableWidth / Math.max(columns.length, 1))),
  )

  return {
    pageCount: 1,
    title: 'Relatório',
    subtitle: '',
    showDate: true,
    showTime: false,
    footerText: '',
    showPageNumbers: true,
    orientation,
    marginMm,
    colors: {
      background: '#ffffff',
      title: '#253c36',
      subtitle: '#60706a',
      tableHeader: '#234e45',
      tableHeaderText: '#ffffff',
      cell: '#ffffff',
      cellText: '#253c36',
      border: '#dedfd7',
    },
    titleFontSize: 24,
    subtitleFontSize: 11,
    bodyFontSize: 9,
    titleAlignment: 'left',
    rowHeightMm: 8,
    cellPaddingMm: 2,
    columns: columns.map((column, order) => ({
      sourceId: column.id,
      visible: true,
      order,
      label: column.label,
      widthMm: suggestedWidth,
      alignment: 'left',
      numberFormat: 'automatic',
      dateFormat: 'automatic',
    })),
  }
}

export function cloneReportConfiguration(
  configuration: ReportConfiguration,
): ReportConfiguration {
  return {
    ...configuration,
    colors: { ...configuration.colors },
    columns: configuration.columns.map((column) => ({ ...column })),
  }
}

export function validateReportConfiguration(
  configuration: ReportConfiguration,
): readonly string[] {
  const errors: string[] = []
  const visibleColumns = configuration.columns.filter(
    (column) => column.visible,
  )
  if (!configuration.title.trim()) errors.push('Informe o título do relatório.')
  if (
    !Number.isInteger(configuration.pageCount) ||
    configuration.pageCount < 1 ||
    configuration.pageCount > 20
  )
    errors.push('Use entre 1 e 20 páginas no relatório.')
  if (configuration.title.length > 120)
    errors.push('O título deve ter no máximo 120 caracteres.')
  if (configuration.subtitle.length > 240)
    errors.push('O subtítulo deve ter no máximo 240 caracteres.')
  if (configuration.footerText.length > 160)
    errors.push('O rodapé deve ter no máximo 160 caracteres.')
  if (configuration.marginMm < 8 || configuration.marginMm > 40)
    errors.push('Use margens entre 8 e 40 mm.')
  if (!visibleColumns.length) errors.push('Selecione ao menos uma coluna.')
  if (visibleColumns.some((column) => !column.label.trim()))
    errors.push('Toda coluna visível precisa de um nome.')
  if (
    visibleColumns.some((column) => column.widthMm < 8 || column.widthMm > 120)
  )
    errors.push('Use larguras entre 8 e 120 mm nas colunas visíveis.')
  if (configuration.rowHeightMm < 4 || configuration.rowHeightMm > 20)
    errors.push('Use altura de linha entre 4 e 20 mm.')
  if (configuration.cellPaddingMm < 1 || configuration.cellPaddingMm > 10)
    errors.push('Use espaçamento interno entre 1 e 10 mm.')
  if (configuration.titleFontSize < 12 || configuration.titleFontSize > 48)
    errors.push('Use tamanho de título entre 12 e 48 pt.')
  if (configuration.subtitleFontSize < 8 || configuration.subtitleFontSize > 24)
    errors.push('Use tamanho de subtítulo entre 8 e 24 pt.')
  if (configuration.bodyFontSize < 6 || configuration.bodyFontSize > 18)
    errors.push('Use tamanho de tabela entre 6 e 18 pt.')
  return errors
}

export function moveReportColumn(
  columns: readonly ReportColumnConfiguration[],
  sourceId: string,
  direction: -1 | 1,
): readonly ReportColumnConfiguration[] {
  const ordered = [...columns].sort((left, right) => left.order - right.order)
  const currentIndex = ordered.findIndex(
    (column) => column.sourceId === sourceId,
  )
  const targetIndex = currentIndex + direction
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length)
    return columns
  const current = ordered[currentIndex]
  const target = ordered[targetIndex]
  if (!current || !target) return columns
  ordered[currentIndex] = target
  ordered[targetIndex] = current
  return ordered.map((column, order) => ({ ...column, order }))
}

export function formatReportValue(
  value: CellValue | undefined,
  column: ReportColumnConfiguration,
): string {
  if (value == null) return ''
  if (value instanceof Date) {
    if (column.dateFormat === 'long')
      return value.toLocaleDateString('pt-BR', {
        dateStyle: 'long',
        timeZone: 'UTC',
      })
    return value.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }
  if (typeof value === 'number') {
    if (column.numberFormat === 'integer')
      return new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: 0,
      }).format(value)
    if (column.numberFormat === 'decimal')
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    if (column.numberFormat === 'currency')
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value)
    if (column.numberFormat === 'percentage')
      return new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)
  }
  if (typeof value === 'object') return value.error
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}
