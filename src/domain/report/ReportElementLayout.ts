import { mmToPoints, pointsToMillimeters, type PageSize } from './ReportLayout'
import { REPORT_ELEMENT_LABELS, type ReportElement } from './ReportTemplate'

export type ElementMeasurement = 'x' | 'y' | 'width' | 'height'

export function moveReportElement(
  element: ReportElement,
  pageSize: PageSize,
  deltaXPoints: number,
  deltaYPoints: number,
): ReportElement {
  const nextX = element.position.x + deltaXPoints / pageSize.width
  const nextY = element.position.y + deltaYPoints / pageSize.height
  return {
    ...element,
    position: {
      x: clamp(nextX, 0, Math.max(0, 1 - element.size.width)),
      y: clamp(nextY, 0, Math.max(0, 1 - element.size.height)),
    },
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function resizeReportElement(
  element: ReportElement,
  deltaWidth: number,
  deltaHeight: number,
): ReportElement {
  let width = Math.max(0.03, element.size.width + deltaWidth)
  let height = Math.max(0.02, element.size.height + deltaHeight)
  if (element.keepAspectRatio) {
    const ratio = element.size.width / element.size.height
    if (Math.abs(deltaWidth) >= Math.abs(deltaHeight)) height = width / ratio
    else width = height * ratio
  }
  return { ...element, size: { width, height } }
}

export function elementMeasurementMillimeters(
  element: ReportElement,
  pageSize: PageSize,
  property: ElementMeasurement,
): number {
  const points =
    property === 'x'
      ? element.position.x * pageSize.width
      : property === 'y'
        ? element.position.y * pageSize.height
        : property === 'width'
          ? element.size.width * pageSize.width
          : element.size.height * pageSize.height
  return Number(pointsToMillimeters(points).toFixed(1))
}

export function setElementMeasurementMillimeters(
  element: ReportElement,
  pageSize: PageSize,
  property: ElementMeasurement,
  millimeters: number,
): ReportElement {
  const axisSize =
    property === 'x' || property === 'width' ? pageSize.width : pageSize.height
  const normalized = mmToPoints(millimeters) / axisSize
  if (property === 'x' || property === 'y')
    return {
      ...element,
      position: { ...element.position, [property]: normalized },
    }

  let size = { ...element.size, [property]: Math.max(0.01, normalized) }
  if (element.keepAspectRatio) {
    const ratio = element.size.width / element.size.height
    size =
      property === 'width'
        ? { width: size.width, height: size.width / ratio }
        : { width: size.height * ratio, height: size.height }
  }
  return { ...element, size }
}

export function findElementBoundaryMessages(
  elements: readonly ReportElement[],
): readonly string[] {
  return elements
    .filter((element) => element.visible)
    .filter(
      (element) =>
        element.position.x < 0 ||
        element.position.y < 0 ||
        element.position.x + element.size.width > 1 ||
        element.position.y + element.size.height > 1,
    )
    .map(
      (element) =>
        `${REPORT_ELEMENT_LABELS[element.type]} ultrapassa os limites da página.`,
    )
}
