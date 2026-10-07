import { z } from 'zod'
import type { WorksheetData } from '../../domain/workbook/Workbook'
import type { ReportConfiguration } from '../../domain/report/ReportConfiguration'
import {
  cloneReportElements,
  REPORT_TEMPLATE_VERSION,
  type ReportElement,
  type ReportImage,
  type ReportTemplate,
} from '../../domain/report/ReportTemplate'

const color = z.string().regex(/^#[\da-f]{6}$/i)
const alignment = z.enum(['left', 'center', 'right'])
const columnSchema = z
  .object({
    sourceId: z.string().min(1),
    visible: z.boolean(),
    order: z.number().int().nonnegative(),
    label: z.string().max(200),
    widthMm: z.number().min(8).max(120),
    alignment,
    numberFormat: z.enum([
      'automatic',
      'integer',
      'decimal',
      'currency',
      'percentage',
    ]),
    dateFormat: z.enum(['automatic', 'short', 'long']),
  })
  .strict()
const configurationSchema = z
  .object({
    pageCount: z.number().int().min(1).max(20).default(1),
    title: z.string().max(120),
    subtitle: z.string().max(240),
    showDate: z.boolean(),
    showTime: z.boolean(),
    footerText: z.string().max(160),
    showPageNumbers: z.boolean(),
    orientation: z.enum(['portrait', 'landscape']),
    marginMm: z.number().min(8).max(40),
    colors: z
      .object({
        background: color,
        title: color,
        subtitle: color,
        tableHeader: color,
        tableHeaderText: color,
        cell: color,
        cellText: color,
        border: color,
      })
      .strict(),
    titleFontSize: z.number().min(12).max(48),
    subtitleFontSize: z.number().min(8).max(24),
    bodyFontSize: z.number().min(6).max(18),
    titleAlignment: alignment,
    rowHeightMm: z.number().min(4).max(20),
    cellPaddingMm: z.number().min(1).max(10),
    columns: z.array(columnSchema).min(1).max(256),
  })
  .strict()
  .superRefine((configuration, context) => {
    const sourceIds = configuration.columns.map((column) => column.sourceId)
    const orders = configuration.columns.map((column) => column.order)
    if (new Set(sourceIds).size !== sourceIds.length)
      context.addIssue({
        code: 'custom',
        message: 'As colunas do modelo devem ser únicas.',
      })
    if (new Set(orders).size !== orders.length)
      context.addIssue({
        code: 'custom',
        message: 'A ordem das colunas deve ser única.',
      })
  })
const elementSchema = z
  .object({
    id: z.string().min(1).max(100),
    parentId: z.string().min(1).max(100).optional(),
    type: z.enum([
      'title',
      'subtitle',
      'date',
      'table',
      'image',
      'footer',
      'pageNumber',
      'customText',
      'summary',
      'formula',
      'chart',
      'dataTable',
      'dataField',
      'shape',
    ]),
    visible: z.boolean(),
    position: z
      .object({
        x: z.number().finite().min(-1).max(2),
        y: z.number().finite().min(-1).max(2),
      })
      .strict(),
    size: z
      .object({
        width: z.number().finite().nonnegative().max(2),
        height: z.number().finite().nonnegative().max(2),
      })
      .strict(),
    keepAspectRatio: z.boolean(),
    style: z
      .object({
        color: color.optional(),
        backgroundColor: color.optional(),
        fontSize: z.number().finite().min(6).max(48).optional(),
        alignment: alignment.optional(),
        bold: z.boolean().optional(),
      })
      .strict(),
    pageIndex: z.number().int().min(0).max(19).optional(),
    repeatOnEveryPage: z.boolean().optional(),
    content: z.string().max(1000).optional(),
    summary: z
      .object({
        label: z.string().min(1).max(120),
        sourceId: z.string().min(1),
        operation: z.enum([
          'sum',
          'average',
          'minimum',
          'maximum',
          'count',
          'distinctCount',
        ]),
      })
      .strict()
      .optional(),
    formula: z
      .object({
        label: z.string().min(1).max(120),
        leftSourceId: z.string().min(1),
        rightSourceId: z.string().min(1),
        operator: z.enum([
          'add',
          'subtract',
          'multiply',
          'divide',
          'percentage',
        ]),
        aggregation: z.enum(['sum', 'average', 'minimum', 'maximum']),
      })
      .strict()
      .optional(),
    chart: z
      .object({
        title: z.string().min(1).max(120),
        chartType: z.enum(['bar', 'pie']),
        categorySourceId: z.string().min(1),
        valueSourceId: z.string().min(1),
        aggregation: z.enum(['sum', 'average', 'count']),
        maxItems: z.number().int().min(2).max(20),
      })
      .strict()
      .optional(),
    dataTable: z
      .object({
        title: z.string().min(1).max(120),
        sourceIds: z.array(z.string().min(1)).min(1).max(12),
        columnWidths: z
          .array(z.number().finite().min(1).max(100))
          .min(1)
          .max(12)
          .optional(),
        sortSourceId: z.string().min(1),
        sortDirection: z.enum(['original', 'ascending', 'descending']),
        limit: z.number().int().min(1).max(100),
        showRank: z.boolean(),
        showTotals: z.boolean(),
        showTitle: z.boolean().optional(),
        reconstructionConfidence: z.number().min(0).max(1).optional(),
        headerBackgroundColor: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
        headerTextColor: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
        cellBackgroundColor: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
        cellTextColor: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
        borderColor: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
        columnFormats: z
          .array(
            z
              .object({
                prefix: z.string().max(40),
                suffix: z.string().max(40),
                decimalSeparator: z.enum([',', '.']).optional(),
                thousandsSeparator: z.enum([',', '.']).optional(),
                fractionDigits: z.number().int().min(0).max(20).optional(),
              })
              .strict(),
          )
          .max(12)
          .optional(),
      })
      .strict()
      .optional(),
    dataField: z
      .object({
        sourceId: z.string().min(1),
        rowIndex: z.number().int().nonnegative().max(49_999),
        label: z.string().max(120).optional(),
        semanticRole: z
          .enum([
            'subtotal',
            'discount',
            'taxBase',
            'tax',
            'grandTotal',
            'totalizer',
          ])
          .optional(),
        prefix: z.string().max(40),
        suffix: z.string().max(40),
        originalText: z.string().max(500).optional(),
        decimalSeparator: z.enum([',', '.']).optional(),
        thousandsSeparator: z.enum([',', '.']).optional(),
        fractionDigits: z.number().int().min(0).max(20).optional(),
        matchConfidence: z.number().min(0).max(1).optional(),
        matchReason: z
          .enum(['exact-text', 'numeric-value', 'manual'])
          .optional(),
      })
      .strict()
      .optional(),
    shape: z
      .object({
        kind: z.enum(['rectangle', 'line']),
        borderWidth: z.number().finite().min(0).max(20),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((element, context) => {
    if (element.visible && (!element.size.width || !element.size.height))
      context.addIssue({
        code: 'custom',
        message: 'Elementos visíveis precisam ter largura e altura.',
      })
  })
const imageSchema = z
  .object({
    name: z.string().min(1).max(255),
    mimeType: z.enum(['image/png', 'image/jpeg']),
    width: z.number().int().positive().max(8_000),
    height: z.number().int().positive().max(8_000),
    alternativeText: z.string().max(300),
    embeddedDataUrl: z
      .string()
      .regex(/^data:image\/(png|jpeg);base64,/)
      .max(7_500_000)
      .optional(),
  })
  .strict()
const templateSchema = z
  .object({
    version: z.literal(REPORT_TEMPLATE_VERSION),
    configuration: configurationSchema,
    elements: z.array(elementSchema).min(7).max(1000),
    image: imageSchema.optional(),
  })
  .strict()
  .superRefine((template, context) => {
    const ids = template.elements.map((element) => element.id)
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        message: 'Os identificadores dos elementos do modelo devem ser únicos.',
      })
    const builtInTypes = template.elements
      .filter(
        (element) =>
          ![
            'customText',
            'summary',
            'formula',
            'chart',
            'dataTable',
            'dataField',
            'shape',
          ].includes(element.type),
      )
      .map((element) => element.type)
    if (new Set(builtInTypes).size !== builtInTypes.length)
      context.addIssue({
        code: 'custom',
        message: 'Os elementos estruturais do modelo devem ser únicos.',
      })
  })

export type TemplateLoadResult =
  | {
      ok: true
      template: ReportTemplate
      missingColumns: readonly string[]
      automaticMapping: Readonly<Record<string, string>>
    }
  | { ok: false; message: string }

export function createReportTemplate(
  configuration: ReportConfiguration,
  elements: readonly ReportElement[],
  image: ReportImage | null,
  embedImage: boolean,
): ReportTemplate {
  return {
    version: REPORT_TEMPLATE_VERSION,
    configuration: {
      ...configuration,
      colors: { ...configuration.colors },
      columns: configuration.columns.map((column) => ({ ...column })),
    },
    elements: cloneReportElements(elements),
    ...(image
      ? {
          image: {
            name: image.name,
            mimeType: image.mimeType,
            width: image.width,
            height: image.height,
            alternativeText: image.alternativeText,
            ...(embedImage ? { embeddedDataUrl: image.dataUrl } : {}),
          },
        }
      : {}),
  }
}

export function serializeReportTemplate(template: ReportTemplate): string {
  return `${JSON.stringify(template, null, 2)}\n`
}

export function parseReportTemplate(
  text: string,
  data: WorksheetData,
): TemplateLoadResult {
  let candidate: unknown
  try {
    candidate = JSON.parse(text)
  } catch {
    return { ok: false, message: 'O arquivo não contém JSON válido.' }
  }
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'version' in candidate &&
    candidate.version !== REPORT_TEMPLATE_VERSION
  )
    return {
      ok: false,
      message: `Versão de modelo incompatível. Esta aplicação aceita a versão ${REPORT_TEMPLATE_VERSION}.`,
    }
  const parsed = templateSchema.safeParse(candidate)
  if (!parsed.success)
    return {
      ok: false,
      message: 'O modelo possui campos ausentes, inválidos ou desconhecidos.',
    }

  const automaticMapping: Record<string, string> = {}
  const missingColumns: string[] = []
  for (const expected of parsed.data.configuration.columns) {
    const byLabel = data.columns.find(
      (column) =>
        normalizedLabel(column.label) === normalizedLabel(expected.label),
    )
    const match = byLabel
    if (match) automaticMapping[expected.sourceId] = match.id
    else missingColumns.push(expected.sourceId)
  }
  return {
    ok: true,
    template: parsed.data,
    missingColumns,
    automaticMapping,
  }
}

export function applyTemplateColumnMapping(
  template: ReportTemplate,
  mapping: Readonly<Record<string, string>>,
): ReportTemplate {
  return {
    ...template,
    configuration: {
      ...template.configuration,
      columns: template.configuration.columns.map((column) => ({
        ...column,
        sourceId: mapping[column.sourceId] ?? column.sourceId,
      })),
    },
    elements: template.elements.map((element) => ({
      ...element,
      ...(element.summary
        ? {
            summary: {
              ...element.summary,
              sourceId:
                mapping[element.summary.sourceId] ?? element.summary.sourceId,
            },
          }
        : {}),
      ...(element.formula
        ? {
            formula: {
              ...element.formula,
              leftSourceId:
                mapping[element.formula.leftSourceId] ??
                element.formula.leftSourceId,
              rightSourceId:
                mapping[element.formula.rightSourceId] ??
                element.formula.rightSourceId,
            },
          }
        : {}),
      ...(element.chart
        ? {
            chart: {
              ...element.chart,
              categorySourceId:
                mapping[element.chart.categorySourceId] ??
                element.chart.categorySourceId,
              valueSourceId:
                mapping[element.chart.valueSourceId] ??
                element.chart.valueSourceId,
            },
          }
        : {}),
      ...(element.dataTable
        ? {
            dataTable: {
              ...element.dataTable,
              sourceIds: element.dataTable.sourceIds.map(
                (sourceId) => mapping[sourceId] ?? sourceId,
              ),
              sortSourceId:
                mapping[element.dataTable.sortSourceId] ??
                element.dataTable.sortSourceId,
            },
          }
        : {}),
      ...(element.dataField
        ? {
            dataField: {
              ...element.dataField,
              sourceId:
                mapping[element.dataField.sourceId] ??
                element.dataField.sourceId,
            },
          }
        : {}),
    })),
  }
}

export function restoreEmbeddedImage(
  template: ReportTemplate,
): ReportImage | null {
  const image = template.image
  if (!image?.embeddedDataUrl) return null
  return {
    name: image.name,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    alternativeText: image.alternativeText,
    dataUrl: image.embeddedDataUrl,
  }
}

function normalizedLabel(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR')
}
