import type { WorksheetData } from '../workbook/Workbook'
import { findElementBoundaryMessages } from './ReportElementLayout'
import { reportElementLabel, type ReportElement } from './ReportTemplate'

export type ReportValidationSeverity = 'error' | 'warning' | 'info'

export interface ReportValidationIssue {
  severity: ReportValidationSeverity
  message: string
}

const freeElementTypes = new Set([
  'customText',
  'summary',
  'formula',
  'chart',
  'dataTable',
  'dataField',
])

export function validateReportContent(
  data: WorksheetData,
  elements: readonly ReportElement[],
): readonly ReportValidationIssue[] {
  const issues: ReportValidationIssue[] = findElementBoundaryMessages(
    elements,
  ).map((message) => ({ severity: 'error', message }))
  const columnIds = new Set(data.columns.map((column) => column.id))
  const visible = elements.filter((element) => element.visible)

  for (const element of visible) {
    const label = reportElementLabel(element)
    const sourceIds = elementSourceIds(element)
    for (const sourceId of sourceIds)
      if (!columnIds.has(sourceId))
        issues.push({
          severity: 'error',
          message: `${label} usa uma coluna que não existe na planilha atual.`,
        })
    if (element.type === 'customText' && !element.content?.trim())
      issues.push({
        severity: 'warning',
        message: 'Existe um bloco de texto vazio.',
      })
    if (
      element.dataField &&
      (element.dataField.rowIndex < 0 ||
        element.dataField.rowIndex >= data.rows.length)
    )
      issues.push({
        severity: 'error',
        message: `${label} aponta para uma linha que não existe.`,
      })
  }

  const freeElements = visible.filter(
    (element) =>
      freeElementTypes.has(element.type) && !element.id.startsWith('pdf-text-'),
  )
  for (let leftIndex = 0; leftIndex < freeElements.length; leftIndex += 1) {
    const left = freeElements[leftIndex]
    if (!left) continue
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < freeElements.length;
      rightIndex += 1
    ) {
      const right = freeElements[rightIndex]
      if (!right || !samePage(left, right) || overlapRatio(left, right) < 0.45)
        continue
      issues.push({
        severity: 'warning',
        message: `${reportElementLabel(left)} e ${reportElementLabel(right)} estão muito sobrepostos.`,
      })
    }
  }
  if (!issues.length)
    issues.push({
      severity: 'info',
      message: 'Nenhum problema encontrado antes da exportação.',
    })
  return deduplicateIssues(issues)
}

function elementSourceIds(element: ReportElement): readonly string[] {
  if (element.summary) return [element.summary.sourceId]
  if (element.formula)
    return [element.formula.leftSourceId, element.formula.rightSourceId]
  if (element.chart)
    return [element.chart.categorySourceId, element.chart.valueSourceId]
  if (element.dataTable)
    return [...element.dataTable.sourceIds, element.dataTable.sortSourceId]
  if (element.dataField) return [element.dataField.sourceId]
  return []
}

function samePage(left: ReportElement, right: ReportElement): boolean {
  return (
    left.repeatOnEveryPage ||
    right.repeatOnEveryPage ||
    (left.pageIndex ?? 0) === (right.pageIndex ?? 0)
  )
}

function overlapRatio(left: ReportElement, right: ReportElement): number {
  const width = Math.max(
    0,
    Math.min(
      left.position.x + left.size.width,
      right.position.x + right.size.width,
    ) - Math.max(left.position.x, right.position.x),
  )
  const height = Math.max(
    0,
    Math.min(
      left.position.y + left.size.height,
      right.position.y + right.size.height,
    ) - Math.max(left.position.y, right.position.y),
  )
  const overlap = width * height
  const smaller = Math.min(
    left.size.width * left.size.height,
    right.size.width * right.size.height,
  )
  return smaller ? overlap / smaller : 0
}

function deduplicateIssues(
  issues: readonly ReportValidationIssue[],
): readonly ReportValidationIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
