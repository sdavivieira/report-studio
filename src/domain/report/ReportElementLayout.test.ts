import { describe, expect, it } from 'vitest'
import type { ReportElement } from './ReportTemplate'
import {
  elementMeasurementMillimeters,
  findElementBoundaryMessages,
  moveReportElement,
  resizeReportElement,
  setElementMeasurementMillimeters,
} from './ReportElementLayout'

const element: ReportElement = {
  id: 'image',
  type: 'image',
  visible: true,
  position: { x: 0.1, y: 0.1 },
  size: { width: 0.2, height: 0.1 },
  keepAspectRatio: true,
  style: {},
}
const page = { width: 600, height: 800 }

describe('report element layout', () => {
  it('moves by PDF points and converts editable measurements', () => {
    const moved = moveReportElement(element, page, 60, 80)
    expect(moved.position).toEqual({ x: 0.2, y: 0.2 })
    const measured = elementMeasurementMillimeters(moved, page, 'x')
    const updated = setElementMeasurementMillimeters(moved, page, 'x', measured)
    expect(updated.position.x).toBeCloseTo(moved.position.x, 3)
  })

  it('keeps dragged elements inside the page', () => {
    const movedPastBottomRight = moveReportElement(element, page, 2_000, 2_000)
    expect(movedPastBottomRight.position).toEqual({ x: 0.8, y: 0.9 })

    const movedPastTopLeft = moveReportElement(element, page, -2_000, -2_000)
    expect(movedPastTopLeft.position).toEqual({ x: 0, y: 0 })
  })

  it('preserves the image ratio and reports page overflow', () => {
    const resized = resizeReportElement(element, 0.2, 0)
    expect(resized.size.width / resized.size.height).toBeCloseTo(2)
    expect(
      findElementBoundaryMessages([
        { ...element, position: { x: 0.9, y: 0.9 } },
      ]),
    ).toEqual(['Imagem ou logotipo ultrapassa os limites da página.'])
  })
})
