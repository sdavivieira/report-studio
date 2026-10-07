<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import type { WorksheetData } from '../../domain/workbook/Workbook'
import { formatReportValue } from '../../domain/report/ReportConfiguration'
import type { ReportConfiguration } from '../../domain/report/ReportConfiguration'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'
import { findReportElement } from '../../domain/report/ReportTemplate'
import { calculateSummary } from '../../domain/report/ReportSummary'
import { dataFieldValue } from '../../domain/report/PdfTemplateDetection'
import {
  calculateChartSeries,
  calculateDataTable,
  calculateFormula,
} from '../../domain/report/ReportDataElements'

const chartColors = ['#234e45', '#b93f3c', '#d29b36', '#527aa3', '#76578c']
import {
  calculateReportLayout,
  effectiveCellPadding,
  mmToPoints,
  type Rectangle,
  type TextMeasurer,
} from '../../domain/report/ReportLayout'

const props = defineProps<{
  data: WorksheetData
  configuration: ReportConfiguration
}>()
const reportStore = useReportConfigurationStore()

const currentPage = ref(1)
const textMeasurer = shallowRef<TextMeasurer>()

const visibleColumns = computed(() =>
  [...props.configuration.columns]
    .filter((column) => column.visible)
    .sort((left, right) => left.order - right.order),
)
const columnById = computed(
  () => new Map(props.data.columns.map((column) => [column.id, column])),
)
const layoutResult = computed(() => {
  try {
    return {
      layout: calculateReportLayout(
        props.data,
        props.configuration,
        textMeasurer.value,
        reportStore.elements,
      ),
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível calcular a prévia.',
    }
  }
})
const layout = computed(() => layoutResult.value.layout)
const pageCount = computed(() => layout.value?.pages.length ?? 0)
const pageLayout = computed(
  () => layout.value?.pages[currentPage.value - 1] ?? null,
)
const previewRows = computed(() => {
  const page = pageLayout.value
  return page ? props.data.rows.slice(page.rowStart, page.rowEnd) : []
})
const previewDate = computed(() => {
  const options: Intl.DateTimeFormatOptions = props.configuration.showTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' }
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date())
})

watch(pageCount, (count) => {
  currentPage.value = Math.min(
    Math.max(currentPage.value, 1),
    Math.max(count, 1),
  )
})

watch(
  () => props.configuration.orientation,
  () => {
    currentPage.value = 1
  },
)

onMounted(async () => {
  if (!document.fonts) return
  await Promise.all([
    document.fonts.load('400 12px "Noto Sans Report"'),
    document.fonts.load('700 12px "Noto Sans Report"'),
  ])
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return
  textMeasurer.value = (text, fontSize, weight) => {
    context.font = `${weight === 'bold' ? 700 : 400} ${fontSize}px "Noto Sans Report"`
    return context.measureText(text).width
  }
})

function sourceIndex(sourceId: string): number | undefined {
  return columnById.value.get(sourceId)?.index
}

function rectangleStyle(rectangle: Rectangle) {
  const size = layout.value?.pageSize
  if (!size) return {}
  return {
    left: `${(rectangle.x / size.width) * 100}%`,
    top: `${(rectangle.y / size.height) * 100}%`,
    width: `${(rectangle.width / size.width) * 100}%`,
    height: `${(rectangle.height / size.height) * 100}%`,
  }
}

function fontSizeStyle(points: number): string {
  const pageWidth = layout.value?.pageSize.width ?? 1
  return `${(points / pageWidth) * 100}cqw`
}

function cellPaddingStyle(columnWidthMm: number): string {
  const pageWidth = layout.value?.pageSize.width ?? 1
  const tableWidth = pageLayout.value?.table.width ?? 0
  const totalWidthMm = visibleColumns.value.reduce(
    (sum, column) => sum + column.widthMm,
    0,
  )
  const renderedColumnWidth =
    tableWidth * (columnWidthMm / Math.max(totalWidthMm, 1))
  const padding = effectiveCellPadding(
    renderedColumnWidth,
    mmToPoints(props.configuration.cellPaddingMm),
  )
  return `${(padding / pageWidth) * 100}cqw`
}

function rowHeightStyle(rowIndex: number): string {
  const page = pageLayout.value
  if (!page) return 'auto'
  const height = page.rowHeights[rowIndex] ?? 0
  return fontSizeStyle(height)
}

function columnWidthStyle(widthMm: number): string {
  const total = visibleColumns.value.reduce(
    (sum, column) => sum + column.widthMm,
    0,
  )
  return `${(widthMm / Math.max(total, 1)) * 100}%`
}

function footerRuleStyle() {
  const page = pageLayout.value
  if (!page) return {}
  return rectangleStyle({
    x: page.footer.x,
    y: page.footer.y - 4,
    width: page.footer.width + page.pageNumber.width,
    height: 1,
  })
}

function isVisible(type: Parameters<typeof findReportElement>[1]): boolean {
  const element = findReportElement(reportStore.elements, type)
  if (!element) return true
  return (
    element.visible &&
    (element.repeatOnEveryPage ||
      (element.pageIndex ?? 0) === currentPage.value - 1)
  )
}

function customElementStyle(element: (typeof reportStore.elements)[number]) {
  const size = layout.value?.pageSize
  if (!size) return {}
  const isShape = element.type === 'shape'
  return {
    ...rectangleStyle({
      x: element.position.x * size.width,
      y: element.position.y * size.height,
      width: element.size.width * size.width,
      height: element.size.height * size.height,
    }),
    color: element.style.color,
    backgroundColor:
      isShape && element.shape?.kind === 'line'
        ? element.style.color
        : element.style.backgroundColor,
    border:
      isShape && element.shape?.kind === 'rectangle' && element.style.color
        ? `${element.shape.borderWidth}px solid ${element.style.color}`
        : undefined,
    fontSize: fontSizeStyle(element.style.fontSize ?? 12),
    fontWeight: element.style.bold ? 700 : 400,
    textAlign: element.style.alignment,
  }
}

function chartSeries(element: (typeof reportStore.elements)[number]) {
  return element.chart ? calculateChartSeries(element.chart, props.data) : []
}

function chartMaximum(element: (typeof reportStore.elements)[number]) {
  return Math.max(
    1,
    ...chartSeries(element).map((item) => Math.abs(item.value)),
  )
}

function pieChartStyle(element: (typeof reportStore.elements)[number]) {
  const series = chartSeries(element)
  const total = Math.max(
    1,
    series.reduce((sum, item) => sum + Math.abs(item.value), 0),
  )
  let cursor = 0
  const segments = series.map((item, index) => {
    const start = cursor
    cursor += (Math.abs(item.value) / total) * 100
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`
  })
  return segments.length
    ? { background: `conic-gradient(${segments.join(', ')})` }
    : { background: '#eef2ef' }
}

function dataTable(element: (typeof reportStore.elements)[number]) {
  return element.dataTable
    ? calculateDataTable(element.dataTable, props.data, props.configuration)
    : null
}
</script>

<template>
  <aside class="configuration-preview" aria-labelledby="report-preview-heading">
    <div class="panel-heading">
      <h2 id="report-preview-heading">Prévia da página</h2>
      <span v-if="pageCount" class="muted">
        Página {{ currentPage }} de {{ pageCount }}
      </span>
    </div>
    <Message v-if="layoutResult.error" severity="error" :closable="false">
      {{ layoutResult.error }}
    </Message>
    <div
      v-if="pageLayout"
      class="report-page"
      :class="`report-page--${configuration.orientation}`"
      :style="{
        backgroundColor: configuration.colors.background,
        color: configuration.colors.cellText,
        ...(reportStore.pdfTemplate?.pages[currentPage - 1]
          ? {
              aspectRatio: `${reportStore.pdfTemplate.pages[currentPage - 1]?.width} / ${reportStore.pdfTemplate.pages[currentPage - 1]?.height}`,
            }
          : {}),
      }"
    >
      <img
        v-if="
          reportStore.pdfReferenceVisible &&
          reportStore.pdfTemplate?.pages[currentPage - 1]
        "
        class="pdf-template-background"
        :src="reportStore.pdfTemplate.pages[currentPage - 1]?.imageDataUrl"
        alt=""
        draggable="false"
      />
      <p
        v-if="configuration.showDate && isVisible('date')"
        class="report-element report-date"
        :style="{
          ...rectangleStyle(pageLayout.date),
          color: configuration.colors.subtitle,
          fontSize: fontSizeStyle(configuration.bodyFontSize),
        }"
      >
        {{ previewDate }}
      </p>
      <h3
        v-if="isVisible('title')"
        class="report-element report-title"
        :style="{
          ...rectangleStyle(pageLayout.title),
          color: configuration.colors.title,
          fontSize: fontSizeStyle(configuration.titleFontSize),
          textAlign: configuration.titleAlignment,
        }"
      >
        {{ configuration.title || 'Sem título' }}
      </h3>
      <p
        v-if="configuration.subtitle && isVisible('subtitle')"
        class="report-element report-subtitle"
        :style="{
          ...rectangleStyle(pageLayout.subtitle),
          color: configuration.colors.subtitle,
          fontSize: fontSizeStyle(configuration.subtitleFontSize),
          textAlign: configuration.titleAlignment,
        }"
      >
        {{ configuration.subtitle }}
      </p>
      <img
        v-if="reportStore.image && isVisible('image')"
        class="report-element report-image"
        :src="reportStore.image.dataUrl"
        :alt="reportStore.image.alternativeText"
        :style="rectangleStyle(pageLayout.image)"
      />
      <div
        v-if="isVisible('table') && currentPage <= (layout?.dataPageCount ?? 0)"
        class="report-table-wrap"
        :style="rectangleStyle(pageLayout.table)"
      >
        <table
          :style="{
            fontSize: fontSizeStyle(configuration.bodyFontSize),
            borderColor: configuration.colors.border,
          }"
        >
          <colgroup>
            <col
              v-for="column in visibleColumns"
              :key="column.sourceId"
              :style="{ width: columnWidthStyle(column.widthMm) }"
            />
          </colgroup>
          <thead>
            <tr
              :style="{
                height: fontSizeStyle(layout?.tableHeaderHeight ?? 0),
              }"
            >
              <th
                v-for="column in visibleColumns"
                :key="column.sourceId"
                :style="{
                  textAlign: column.alignment,
                  backgroundColor: configuration.colors.tableHeader,
                  color: configuration.colors.tableHeaderText,
                  borderColor: configuration.colors.border,
                  padding: cellPaddingStyle(column.widthMm),
                }"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in previewRows"
              :key="pageLayout.rowStart + rowIndex"
              :style="{ height: rowHeightStyle(rowIndex) }"
            >
              <td
                v-for="column in visibleColumns"
                :key="column.sourceId"
                :style="{
                  textAlign: column.alignment,
                  backgroundColor: configuration.colors.cell,
                  color: configuration.colors.cellText,
                  borderColor: configuration.colors.border,
                  padding: cellPaddingStyle(column.widthMm),
                }"
              >
                {{
                  formatReportValue(
                    row[sourceIndex(column.sourceId) ?? -1],
                    column,
                  )
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <span
        v-if="isVisible('footer') || isVisible('pageNumber')"
        class="report-footer-rule"
        :style="{
          ...footerRuleStyle(),
          borderColor: configuration.colors.border,
        }"
      />
      <span
        v-if="isVisible('footer')"
        class="report-element report-footer-text"
        :style="{
          ...rectangleStyle(pageLayout.footer),
          color: configuration.colors.subtitle,
          fontSize: fontSizeStyle(configuration.bodyFontSize),
        }"
      >
        {{ configuration.footerText }}
      </span>
      <span
        v-if="configuration.showPageNumbers && isVisible('pageNumber')"
        class="report-element report-page-number"
        :style="{
          ...rectangleStyle(pageLayout.pageNumber),
          color: configuration.colors.subtitle,
          fontSize: fontSizeStyle(configuration.bodyFontSize),
        }"
      >
        Página {{ currentPage }} de {{ pageCount }}
      </span>
      <div
        v-for="element in reportStore.elements.filter(
          (item) =>
            item.visible &&
            [
              'customText',
              'summary',
              'formula',
              'chart',
              'dataTable',
              'dataField',
              'shape',
            ].includes(item.type) &&
            (item.repeatOnEveryPage ||
              (item.pageIndex ?? 0) === currentPage - 1),
        )"
        :key="element.id"
        class="report-element report-custom-element"
        :style="customElementStyle(element)"
      >
        <template v-if="element.type === 'summary' && element.summary">
          {{ element.summary.label }}:
          {{ calculateSummary(element.summary, data, configuration) }}
        </template>
        <template v-else-if="element.type === 'formula' && element.formula">
          {{ element.formula.label }}:
          {{ calculateFormula(element.formula, data) }}
        </template>
        <template v-else-if="element.type === 'dataField'">
          {{ dataFieldValue(element, data, configuration) }}
        </template>
        <div
          v-else-if="element.type === 'chart' && element.chart"
          class="editor-data-chart"
        >
          <strong>{{ element.chart.title }}</strong>
          <div
            v-if="element.chart.chartType === 'pie'"
            class="editor-data-chart__pie-layout"
          >
            <div
              class="editor-data-chart__pie"
              :style="pieChartStyle(element)"
            />
            <div class="editor-data-chart__legend">
              <span
                v-for="(item, index) in chartSeries(element)"
                :key="item.label"
              >
                <i
                  :style="{
                    background: chartColors[index % chartColors.length],
                  }"
                />
                {{ item.label }}
              </span>
            </div>
          </div>
          <div v-else class="editor-data-chart__plot">
            <div
              v-for="item in chartSeries(element)"
              :key="item.label"
              class="editor-data-chart__item"
            >
              <span>{{ item.label }}</span>
              <i
                :style="{
                  width: `${(Math.abs(item.value) / chartMaximum(element)) * 100}%`,
                }"
              />
              <b>{{ item.value.toLocaleString('pt-BR') }}</b>
            </div>
          </div>
        </div>
        <div
          v-else-if="element.type === 'dataTable' && element.dataTable"
          class="editor-data-table"
          :class="{
            'editor-data-table--without-title':
              element.dataTable.showTitle === false,
          }"
        >
          <strong v-if="element.dataTable.showTitle !== false">
            {{ element.dataTable.title }}
          </strong>
          <table v-if="dataTable(element)">
            <colgroup>
              <col
                v-for="(weight, index) in dataTable(element)?.columnWeights"
                :key="index"
                :style="{ width: `${weight * 100}%` }"
              />
            </colgroup>
            <thead>
              <tr>
                <th
                  v-for="header in dataTable(element)?.headers"
                  :key="header"
                  :style="{
                    backgroundColor: element.dataTable.headerBackgroundColor,
                    color: element.dataTable.headerTextColor,
                    borderColor: element.dataTable.borderColor,
                  }"
                >
                  {{ header }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rowIndex) in dataTable(element)?.rows"
                :key="rowIndex"
              >
                <td
                  v-for="(cell, cellIndex) in row"
                  :key="cellIndex"
                  :style="{
                    backgroundColor: element.dataTable.cellBackgroundColor,
                    color: element.dataTable.cellTextColor,
                    borderColor: element.dataTable.borderColor,
                  }"
                >
                  {{ cell }}
                </td>
              </tr>
              <tr v-if="dataTable(element)?.totals" class="total-row">
                <td
                  v-for="(cell, cellIndex) in dataTable(element)?.totals"
                  :key="cellIndex"
                >
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <template v-else>{{ element.content }}</template>
      </div>
    </div>
    <p
      v-if="
        pageLayout &&
        currentPage > 1 &&
        currentPage <= (layout?.dataPageCount ?? 0)
      "
      class="continuation-note"
    >
      Continuação da tabela · linhas {{ pageLayout.rowStart + 1 }}–{{
        pageLayout.rowEnd
      }}
    </p>
    <div v-if="pageCount > 1" class="preview-pagination">
      <Button
        label="Página anterior"
        icon="pi pi-chevron-left"
        severity="secondary"
        outlined
        size="small"
        :disabled="currentPage === 1"
        @click="currentPage--"
      />
      <Button
        label="Próxima página"
        icon="pi pi-chevron-right"
        icon-pos="right"
        severity="secondary"
        outlined
        size="small"
        :disabled="currentPage === pageCount"
        @click="currentPage++"
      />
    </div>
  </aside>
</template>
