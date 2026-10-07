import { describe, expect, it } from 'vitest'
import { createDefaultReportConfiguration } from './ReportConfiguration'
import {
  calculateReportLayout,
  effectiveCellPadding,
  findLayoutOverflows,
  mmToPoints,
  normalizedToPoint,
  pageSizeFor,
  pixelsToPoints,
  pointsToPixels,
  pointToNormalized,
  rectangleOverflows,
  wrapReportText,
  createDefaultReportElements,
} from './ReportLayout'

const columns = [
  { id: 'name', index: 0, label: 'Nome', headerValue: 'Nome' },
  { id: 'value', index: 1, label: 'Valor', headerValue: 'Valor' },
]
const data = {
  name: 'Dados',
  headerRow: 1,
  columns,
  rows: Array.from({ length: 120 }, (_, index) => [
    `Produto com descrição ${index}`,
    index,
  ]),
}

describe('shared report layout', () => {
  it('converts screen, PDF and normalized coordinates reversibly', () => {
    expect(pointsToPixels(72)).toBe(96)
    expect(pixelsToPoints(96)).toBe(72)
    const page = { width: 600, height: 800 }
    const point = normalizedToPoint({ x: 0.25, y: 0.5 }, page)
    expect(point).toEqual({ x: 150, y: 400 })
    expect(pointToNormalized(point, page)).toEqual({ x: 0.25, y: 0.5 })
  })

  it('paginates complete rows and repeats stable page geometry', () => {
    const configuration = createDefaultReportConfiguration(columns)
    const layout = calculateReportLayout(data, configuration)
    expect(layout.pages.length).toBeGreaterThan(1)
    expect(layout.pages[0]?.rowStart).toBe(0)
    expect(layout.pages.at(-1)?.rowEnd).toBe(120)
    expect(
      layout.pages.reduce((count, page) => count + page.rowHeights.length, 0),
    ).toBe(120)
    expect(findLayoutOverflows(layout)).toEqual([])
  })

  it('fits oversized column proportions within a landscape page', () => {
    const configuration = createDefaultReportConfiguration(columns)
    configuration.orientation = 'landscape'
    configuration.columns = configuration.columns.map((column) => ({
      ...column,
      widthMm: 200,
    }))
    const size = pageSizeFor(configuration)
    expect(size.width).toBeGreaterThan(size.height)
    const layout = calculateReportLayout(data, configuration)
    expect(layout.tableWidth).toBeCloseTo(layout.marginBounds.width)
    expect(findLayoutOverflows(layout)).toEqual([])
  })

  it('reduces padding before it can consume a narrow column', () => {
    expect(effectiveCellPadding(8, 6)).toBe(2)
    expect(effectiveCellPadding(40, 6)).toBe(6)
  })

  it('wraps long words and checks rectangle boundaries', () => {
    expect(
      wrapReportText('palavra muito longa', 45, 10).length,
    ).toBeGreaterThan(1)
    expect(
      rectangleOverflows(
        { x: 90, y: 10, width: 20, height: 20 },
        { x: 0, y: 0, width: 100, height: 100 },
      ),
    ).toBe(true)
    expect(mmToPoints(25.4)).toBeCloseTo(72)
  })

  it('preserves explicit line breaks while wrapping text', () => {
    expect(wrapReportText('Primeira linha\nSegunda linha', 200, 10)).toEqual([
      'Primeira linha',
      'Segunda linha',
    ])
  })

  it('uses supplied font metrics and reserves space for a wrapped footer', () => {
    const exactMeasure = (text: string, size: number) => text.length * size
    expect(wrapReportText('WW', 15, 10, exactMeasure)).toEqual(['W', 'W'])
    const configuration = createDefaultReportConfiguration(columns)
    configuration.footerText = 'W'.repeat(120)
    const layout = calculateReportLayout(data, configuration, exactMeasure)
    expect(layout.pages[0]?.footer.height).toBeGreaterThan(14)
  })

  it('uses normalized editor positions in the shared PDF layout', () => {
    const configuration = createDefaultReportConfiguration(columns)
    const elements = createDefaultReportElements(data, configuration).map(
      (element) =>
        element.type === 'title'
          ? { ...element, position: { x: 0.2, y: 0.1 } }
          : element,
    )
    const layout = calculateReportLayout(
      data,
      configuration,
      undefined,
      elements,
    )
    expect(layout.pages[0]?.title.x).toBeCloseTo(layout.pageSize.width * 0.2)
    expect(layout.pages[0]?.title.y).toBeCloseTo(layout.pageSize.height * 0.1)
  })

  it('does not add data pages while the report table is hidden', () => {
    const configuration = createDefaultReportConfiguration(columns)
    configuration.pageCount = 1
    const elements = createDefaultReportElements(data, configuration).map(
      (element) =>
        element.type === 'table' ? { ...element, visible: false } : element,
    )

    const layout = calculateReportLayout(
      data,
      configuration,
      undefined,
      elements,
    )

    expect(layout.dataPageCount).toBe(0)
    expect(layout.pages).toHaveLength(1)
  })
})
