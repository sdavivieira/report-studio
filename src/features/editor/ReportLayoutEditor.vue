<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Toolbar from 'primevue/toolbar'
import ToggleSwitch from 'primevue/toggleswitch'
import Slider from 'primevue/slider'
import Message from 'primevue/message'
import InputNumber from 'primevue/inputnumber'
import { useWorkbookStore } from '../../stores/workbookStore'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'
import {
  calculateReportLayout,
  type Rectangle,
} from '../../domain/report/ReportLayout'
import {
  findElementBoundaryMessages,
  moveReportElement,
  resizeReportElement,
} from '../../domain/report/ReportElementLayout'
import {
  cloneReportElements,
  findReportElementById,
  reportElementLabel,
  type ReportElement,
} from '../../domain/report/ReportTemplate'
import { calculateSummary } from '../../domain/report/ReportSummary'
import { dataFieldValue } from '../../domain/report/PdfTemplateDetection'
import {
  calculateChartSeries,
  calculateDataTable,
  calculateFormula,
} from '../../domain/report/ReportDataElements'
import ImageAssetPanel from './ImageAssetPanel.vue'
import ElementPropertiesDrawer from './ElementPropertiesDrawer.vue'

const emit = defineEmits<{ back: []; next: [] }>()
const workbookStore = useWorkbookStore()
const reportStore = useReportConfigurationStore()
const selectedId = ref('')
const drawerVisible = ref(false)
const zoomPercent = ref(75)
const currentPage = ref(1)
const showMargins = ref(true)
const pageHost = ref<HTMLElement>()
const draggingId = ref<string | null>(null)
const previewRow = ref(1)

const data = computed(() => workbookStore.working)
const configuration = computed(() => reportStore.configuration)
const zoom = computed(() => zoomPercent.value / 100)
const layout = computed(() =>
  data.value && configuration.value
    ? calculateReportLayout(
        data.value,
        configuration.value,
        undefined,
        reportStore.elements,
      )
    : null,
)
const page = computed(() => layout.value?.pages[currentPage.value - 1])
const overflowMessages = computed(() =>
  findElementBoundaryMessages(reportStore.elements),
)
const previewRows = computed(() => data.value?.rows.slice(0, 5) ?? [])
const columnIndexes = computed(
  () => new Map(data.value?.columns.map((column) => [column.id, column.index])),
)
const visibleColumns = computed(() =>
  [...(configuration.value?.columns ?? [])]
    .filter((column) => column.visible)
    .sort((left, right) => left.order - right.order),
)
const customElementTypes = [
  'customText',
  'summary',
  'formula',
  'chart',
  'dataTable',
  'dataField',
  'shape',
]
const chartColors = ['#234e45', '#b93f3c', '#d29b36', '#527aa3', '#76578c']
const sidebarElements = computed(() =>
  reportStore.elements.filter(
    (element) =>
      (element.type !== 'dataField' || element.dataField?.semanticRole) &&
      elementAppearsOnCurrentPage(element),
  ),
)
const detectedFieldCount = computed(
  () =>
    reportStore.elements.filter(
      (element) =>
        element.type === 'dataField' &&
        element.visible &&
        elementAppearsOnCurrentPage(element),
    ).length,
)
const detectedTotalizerCount = computed(
  () =>
    reportStore.elements.filter(
      (element) =>
        element.type === 'dataField' &&
        element.dataField?.semanticRole &&
        element.visible &&
        elementAppearsOnCurrentPage(element),
    ).length,
)
const reconstructedTableCount = computed(
  () =>
    reportStore.elements.filter(
      (element) =>
        element.type === 'dataTable' &&
        element.dataTable?.reconstructionConfidence !== undefined &&
        element.visible &&
        elementAppearsOnCurrentPage(element),
    ).length,
)
const reconstructedTextCount = computed(
  () =>
    reportStore.elements.filter(
      (element) =>
        element.id.startsWith('pdf-text-') &&
        element.visible &&
        elementAppearsOnCurrentPage(element),
    ).length,
)
const reconstructedShapeCount = computed(
  () =>
    reportStore.elements.filter(
      (element) =>
        element.id.startsWith('pdf-shape-') &&
        element.visible &&
        elementAppearsOnCurrentPage(element),
    ).length,
)
const selectedElement = computed(() =>
  findReportElementById(reportStore.elements, selectedId.value),
)

function columnWidthStyle(widthMm: number): string {
  const total = visibleColumns.value.reduce(
    (sum, column) => sum + column.widthMm,
    0,
  )
  return `${(widthMm / Math.max(total, 1)) * 100}%`
}

function rectangleStyle(rectangle: Rectangle | undefined) {
  const size = layout.value?.pageSize
  if (!rectangle || !size) return {}
  return {
    left: `${(rectangle.x / size.width) * 100}%`,
    top: `${(rectangle.y / size.height) * 100}%`,
    width: `${(rectangle.width / size.width) * 100}%`,
    height: `${(rectangle.height / size.height) * 100}%`,
  }
}

function openElementProperties(id: string) {
  selectedId.value = id
  drawerVisible.value = true
}

function clearSelectionFromBackground(event: PointerEvent) {
  const target = event.target
  if (target instanceof HTMLElement && target.closest('.editable-element'))
    return

  selectedId.value = ''
  drawerVisible.value = false
}

function startPointer(
  event: PointerEvent,
  id: string,
  mode: 'move' | 'resize',
) {
  if (event.button !== 0 || !pageHost.value) return
  event.preventDefault()
  selectedId.value = id
  const before = cloneReportElements(reportStore.elements)
  const initial = findReportElementById(before, id)
  if (!initial) return
  draggingId.value = id
  const bounds = pageHost.value.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY

  const move = (nextEvent: PointerEvent) => {
    const deltaX = (nextEvent.clientX - startX) / bounds.width
    const deltaY = (nextEvent.clientY - startY) / bounds.height
    if (mode === 'move') {
      const moved = moveReportElement(
        initial,
        { width: bounds.width, height: bounds.height },
        nextEvent.clientX - startX,
        nextEvent.clientY - startY,
      )
      reportStore.updateElement(id, { position: moved.position }, false)
    } else {
      const resized = resizeReportElement(initial, deltaX, deltaY)
      reportStore.updateElement(id, { size: resized.size }, false)
    }
  }
  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    draggingId.value = null
    reportStore.commitElementInteraction(before)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish, { once: true })
  window.addEventListener('pointercancel', finish, { once: true })
}

function moveWithKeyboard(event: KeyboardEvent, id: string) {
  const directions: Readonly<Record<string, readonly [number, number]>> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const direction = directions[event.key]
  const element = findReportElementById(reportStore.elements, id)
  const size = layout.value?.pageSize
  if (!direction || !element || !size) return
  event.preventDefault()
  const distance = event.shiftKey ? 10 : 1
  const moved = moveReportElement(
    element,
    size,
    direction[0] * distance,
    direction[1] * distance,
  )
  reportStore.updateElement(id, { position: moved.position })
}

function elementRectangle(element: ReportElement): Rectangle | undefined {
  const size = layout.value?.pageSize
  if (!size) return undefined
  if (customElementTypes.includes(element.type))
    return {
      x: element.position.x * size.width,
      y: element.position.y * size.height,
      width: element.size.width * size.width,
      height: element.size.height * size.height,
    }
  const currentPageLayout = page.value
  if (!currentPageLayout) return undefined
  if (element.type === 'title') return currentPageLayout.title
  if (element.type === 'subtitle') return currentPageLayout.subtitle
  if (element.type === 'date') return currentPageLayout.date
  if (element.type === 'table') return currentPageLayout.table
  if (element.type === 'image') return currentPageLayout.image
  if (element.type === 'footer') return currentPageLayout.footer
  if (element.type === 'pageNumber') return currentPageLayout.pageNumber
  return undefined
}

function elementHierarchyDepth(element: ReportElement): number {
  let depth = 0
  let parentId = element.parentId
  const visited = new Set<string>([element.id])

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    depth += 1
    parentId = findReportElementById(reportStore.elements, parentId)?.parentId
  }

  return depth
}

function editorElementStyle(element: ReportElement) {
  const rectangle = rectangleStyle(elementRectangle(element))
  const hierarchyLayer = 2 + elementHierarchyDepth(element)
  if (!customElementTypes.includes(element.type))
    return { ...rectangle, zIndex: hierarchyLayer }
  const pageWidth = layout.value?.pageSize.width ?? 1
  const isDetectedDataField = element.type === 'dataField'
  const isShape = element.type === 'shape'
  return {
    ...rectangle,
    zIndex: hierarchyLayer,
    color: isDetectedDataField ? undefined : element.style.color,
    backgroundColor: isDetectedDataField
      ? undefined
      : isShape && element.shape?.kind === 'line'
        ? element.style.color
        : element.style.backgroundColor,
    border:
      isShape && element.shape?.kind === 'rectangle' && element.style.color
        ? `${element.shape.borderWidth}px solid ${element.style.color}`
        : undefined,
    '--data-field-color': element.style.color ?? '#222222',
    '--data-field-background': element.style.backgroundColor ?? '#ffffff',
    fontSize: `${((element.style.fontSize ?? 12) / pageWidth) * 100}cqw`,
    fontWeight: element.style.bold ? 700 : 400,
    textAlign: element.style.alignment,
    whiteSpace: 'pre-wrap',
  }
}

function addTextBlock() {
  selectedId.value = reportStore.addCustomText(currentPage.value - 1)
  drawerVisible.value = true
}

function addSummaryBlock() {
  if (!data.value) return
  const id = reportStore.addSummary(data.value, currentPage.value - 1)
  if (!id) return
  selectedId.value = id
  drawerVisible.value = true
}

function addFormulaBlock() {
  if (!data.value) return
  const id = reportStore.addFormula(data.value, currentPage.value - 1)
  if (id) openElementProperties(id)
}

function addChartBlock() {
  if (!data.value) return
  const id = reportStore.addChart(data.value, currentPage.value - 1)
  if (id) openElementProperties(id)
}

function addDataTableBlock() {
  if (!data.value) return
  const id = reportStore.addDataTable(data.value, currentPage.value - 1)
  if (id) openElementProperties(id)
}

function addDataFieldBlock() {
  if (!data.value) return
  const id = reportStore.addDataField(data.value, currentPage.value - 1)
  if (id) openElementProperties(id)
}

function duplicateSelected() {
  const id = reportStore.duplicateElement(selectedId.value)
  if (id) selectedId.value = id
}

function previewDataFieldValue(element: ReportElement): string {
  if (!data.value || !configuration.value || !element.dataField) return ''
  const rowIndex = element.dataField.originalText
    ? element.dataField.rowIndex
    : previewRow.value - 1
  return dataFieldValue(
    {
      ...element,
      dataField: { ...element.dataField, rowIndex },
    },
    data.value,
    configuration.value,
  )
}

function chartSeries(element: ReportElement) {
  return element.chart && data.value
    ? calculateChartSeries(element.chart, data.value)
    : []
}

function chartMaximum(element: ReportElement): number {
  return Math.max(
    1,
    ...chartSeries(element).map((item) => Math.abs(item.value)),
  )
}

function pieChartStyle(element: ReportElement) {
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

function dataTable(element: ReportElement) {
  return element.dataTable && data.value && configuration.value
    ? calculateDataTable(element.dataTable, data.value, configuration.value)
    : null
}

function addPage() {
  const pageIndex = reportStore.addPage()
  if (pageIndex !== null) currentPage.value = pageIndex + 1
}

function duplicateCurrentPage() {
  if (reportStore.pdfTemplate) return
  const pageIndex = reportStore.duplicatePage(currentPage.value - 1)
  if (pageIndex !== null) currentPage.value = pageIndex + 1
}

function removeCurrentPage() {
  if (reportStore.pdfTemplate) return
  if (reportStore.removePage(currentPage.value - 1))
    currentPage.value = Math.min(
      currentPage.value,
      configuration.value?.pageCount ?? 1,
    )
}

function elementAppearsOnCurrentPage(element: ReportElement): boolean {
  if (element.repeatOnEveryPage) return true
  if (element.pageIndex !== undefined)
    return element.pageIndex === currentPage.value - 1
  return !customElementTypes.includes(element.type)
}

function centerPage() {
  pageHost.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center',
  })
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  )
}

function handleHistoryShortcut(event: KeyboardEvent) {
  if (
    (!event.ctrlKey && !event.metaKey) ||
    event.altKey ||
    isTextEditingTarget(event.target)
  )
    return

  const key = event.key.toLowerCase()
  const undo = key === 'z' && !event.shiftKey
  const redo = key === 'y' || (key === 'z' && event.shiftKey)
  const duplicate = key === 'd'
  if (!undo && !redo && !duplicate) return

  event.preventDefault()
  if (undo) reportStore.undoLayout()
  else if (redo) reportStore.redoLayout()
  else duplicateSelected()
}

onMounted(() => window.addEventListener('keydown', handleHistoryShortcut))
onBeforeUnmount(() =>
  window.removeEventListener('keydown', handleHistoryShortcut),
)
</script>

<template>
  <section v-if="data && configuration" aria-labelledby="layout-editor-heading">
    <div class="section-heading">
      <div>
        <div class="eyebrow">COMPOSIÇÃO DA PÁGINA</div>
        <h1 id="layout-editor-heading">Ajuste com precisão e contexto.</h1>
        <p class="lead">
          Reposicione os blocos diretamente na página. Dê dois cliques em um
          bloco quando precisar de estilos ou ajustes numéricos mais finos.
        </p>
      </div>
      <span class="unsaved-indicator" role="status">
        <i class="pi pi-circle-fill" aria-hidden="true" />
        {{
          reportStore.isDirty
            ? 'Modelo com alterações não salvas'
            : 'Modelo salvo'
        }}
      </span>
    </div>

    <Toolbar class="editor-toolbar" aria-label="Ferramentas do editor">
      <template #start>
        <Button
          label="Desfazer"
          icon="pi pi-undo"
          title="Desfazer (Ctrl+Z)"
          aria-keyshortcuts="Control+Z Meta+Z"
          text
          :disabled="!reportStore.canUndo"
          @click="reportStore.undoLayout"
        />
        <Button
          label="Refazer"
          icon="pi pi-refresh"
          title="Refazer (Ctrl+Y)"
          aria-keyshortcuts="Control+Y Meta+Y"
          text
          :disabled="!reportStore.canRedo"
          @click="reportStore.redoLayout"
        />
        <Button
          label="Restaurar layout"
          icon="pi pi-replay"
          text
          @click="reportStore.resetLayout(data)"
        />
        <Button
          label="Duplicar bloco"
          icon="pi pi-clone"
          title="Duplicar bloco selecionado (Ctrl+D)"
          text
          :disabled="
            !selectedElement ||
            !customElementTypes.includes(selectedElement.type)
          "
          @click="duplicateSelected"
        />
      </template>
      <template #end>
        <Button
          label="Página anterior"
          icon="pi pi-chevron-left"
          text
          :disabled="currentPage === 1"
          @click="currentPage--"
        />
        <span>Página {{ currentPage }} de {{ layout?.pages.length ?? 1 }}</span>
        <Button
          label="Próxima página"
          icon="pi pi-chevron-right"
          icon-pos="right"
          text
          :disabled="currentPage >= (layout?.pages.length ?? 1)"
          @click="currentPage++"
        />
        <Button
          label="Adicionar página"
          icon="pi pi-plus"
          text
          :disabled="configuration.pageCount >= 20"
          @click="addPage"
        />
        <Button
          label="Duplicar página"
          icon="pi pi-copy"
          text
          :disabled="
            Boolean(reportStore.pdfTemplate) || configuration.pageCount >= 20
          "
          @click="duplicateCurrentPage"
        />
        <Button
          label="Remover página"
          icon="pi pi-trash"
          text
          severity="secondary"
          :disabled="
            Boolean(reportStore.pdfTemplate) || configuration.pageCount <= 1
          "
          @click="removeCurrentPage"
        />
        <label class="toolbar-toggle" for="show-margins">Margens</label>
        <ToggleSwitch v-model="showMargins" input-id="show-margins" />
        <template v-if="reportStore.pdfTemplate">
          <label class="toolbar-toggle" for="show-pdf-reference">
            Referência PDF
          </label>
          <ToggleSwitch
            :model-value="reportStore.pdfReferenceVisible"
            input-id="show-pdf-reference"
            @update:model-value="reportStore.setPdfReferenceVisible"
          />
        </template>
        <Button
          label="Centralizar"
          icon="pi pi-align-center"
          text
          @click="centerPage"
        />
        <span class="zoom-control">
          <label for="editor-zoom">Zoom {{ zoomPercent }}%</label>
          <Slider
            id="editor-zoom"
            v-model="zoomPercent"
            :min="45"
            :max="120"
            :step="5"
          />
        </span>
      </template>
    </Toolbar>

    <div class="editor-main">
      <aside class="editor-assets">
        <ImageAssetPanel @selected="openElementProperties('image')" />

        <h2>Adicionar conteúdo</h2>
        <div class="element-create-actions">
          <Button
            label="Texto livre"
            icon="pi pi-align-left"
            outlined
            @click="addTextBlock"
          />
          <Button
            label="Totalizador"
            icon="pi pi-calculator"
            outlined
            @click="addSummaryBlock"
          />
          <Button
            label="Fórmula"
            icon="pi pi-percentage"
            outlined
            @click="addFormulaBlock"
          />
          <Button
            label="Gráfico"
            icon="pi pi-chart-bar"
            outlined
            @click="addChartBlock"
          />
          <Button
            label="Tabela ou ranking"
            icon="pi pi-table"
            outlined
            @click="addDataTableBlock"
          />
          <Button
            label="Campo da planilha"
            icon="pi pi-database"
            outlined
            @click="addDataFieldBlock"
          />
        </div>

        <div class="field editor-record-preview">
          <label for="preview-record">Registro usado na prévia</label>
          <InputNumber
            v-model="previewRow"
            input-id="preview-record"
            :min="1"
            :max="data.rows.length"
            :use-grouping="false"
            show-buttons
          />
          <small>Navegue pelos registros sem alterar o mapeamento salvo.</small>
        </div>

        <h2>Elementos</h2>
        <p
          v-if="
            detectedFieldCount ||
            reconstructedTableCount ||
            reconstructedTextCount ||
            reconstructedShapeCount
          "
          class="detected-field-summary"
        >
          <i class="pi pi-database" aria-hidden="true" />
          {{ reconstructedTableCount }} tabela(s) ·
          {{ detectedFieldCount }} campo(s) ·
          {{ detectedTotalizerCount }} totalizador(es) ·
          {{ reconstructedTextCount }} texto(s) ·
          {{ reconstructedShapeCount }} forma(s)
        </p>
        <div class="element-list">
          <Button
            v-for="element in sidebarElements"
            :key="element.id"
            :label="reportElementLabel(element)"
            :icon="element.visible ? 'pi pi-eye' : 'pi pi-eye-slash'"
            :severity="selectedId === element.id ? undefined : 'secondary'"
            :outlined="selectedId !== element.id"
            :aria-pressed="selectedId === element.id"
            @click="openElementProperties(element.id)"
          />
        </div>
        <div class="element-layer-actions" aria-label="Posição e camadas">
          <Button
            label="Frente"
            icon="pi pi-angle-up"
            size="small"
            text
            @click="reportStore.moveElementLayer(selectedId, 1)"
          />
          <Button
            label="Fundo"
            icon="pi pi-angle-down"
            size="small"
            text
            @click="reportStore.moveElementLayer(selectedId, -1)"
          />
          <Button
            label="Centro horizontal"
            icon="pi pi-align-center"
            size="small"
            text
            @click="reportStore.alignElement(selectedId, 'center')"
          />
          <Button
            label="Centro vertical"
            icon="pi pi-arrows-v"
            size="small"
            text
            @click="reportStore.alignElement(selectedId, 'middle')"
          />
        </div>
      </aside>

      <div
        class="editor-canvas"
        aria-label="Página editável"
        @pointerdown="clearSelectionFromBackground"
      >
        <div
          v-if="page"
          ref="pageHost"
          class="editor-page"
          :class="{ 'editor-page--show-margins': showMargins }"
          :style="{
            aspectRatio: reportStore.pdfTemplate?.pages[currentPage - 1]
              ? `${reportStore.pdfTemplate.pages[currentPage - 1]?.width} / ${reportStore.pdfTemplate.pages[currentPage - 1]?.height}`
              : `${layout?.pageSize.width} / ${layout?.pageSize.height}`,
            width: `${Math.round((layout?.pageSize.width ?? 595) * zoom)}px`,
            backgroundColor: configuration.colors.background,
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
          <div
            v-if="showMargins && layout"
            class="margin-guide"
            :style="rectangleStyle(layout.marginBounds)"
            aria-hidden="true"
          />
          <template v-for="element in reportStore.elements" :key="element.id">
            <div
              v-if="element.visible && elementAppearsOnCurrentPage(element)"
              class="editable-element"
              :class="{
                'editable-element--selected': selectedId === element.id,
                'editable-element--dragging': draggingId === element.id,
                'editable-element--data-field': element.type === 'dataField',
              }"
              :style="editorElementStyle(element)"
              :data-element-id="element.id"
              :data-parent-id="element.parentId"
              role="button"
              tabindex="0"
              :aria-label="`${reportElementLabel(element)}. Mova com o ponteiro ou use as setas.`"
              @focus="selectedId = element.id"
              @dblclick="openElementProperties(element.id)"
              @keydown="moveWithKeyboard($event, element.id)"
              @keydown.enter="openElementProperties(element.id)"
              @keydown.space.prevent="openElementProperties(element.id)"
              @pointerdown="startPointer($event, element.id, 'move')"
            >
              <h3
                v-if="element.type === 'title'"
                :style="{
                  color: configuration.colors.title,
                  textAlign: configuration.titleAlignment,
                }"
              >
                {{ configuration.title }}
              </h3>
              <p
                v-else-if="element.type === 'subtitle'"
                :style="{
                  color: configuration.colors.subtitle,
                  textAlign: configuration.titleAlignment,
                }"
              >
                {{ configuration.subtitle || 'Subtítulo' }}
              </p>
              <p v-else-if="element.type === 'date'" class="editor-date">
                {{ new Intl.DateTimeFormat('pt-BR').format(new Date()) }}
              </p>
              <img
                v-else-if="element.type === 'image' && reportStore.image"
                :src="reportStore.image.dataUrl"
                :alt="reportStore.image.alternativeText"
                draggable="false"
              />
              <div v-else-if="element.type === 'table'" class="editor-table">
                <table>
                  <colgroup>
                    <col
                      v-for="column in visibleColumns"
                      :key="column.sourceId"
                      :style="{ width: columnWidthStyle(column.widthMm) }"
                    />
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        v-for="column in visibleColumns"
                        :key="column.sourceId"
                      >
                        {{ column.label }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in previewRows" :key="rowIndex">
                      <td
                        v-for="column in visibleColumns"
                        :key="column.sourceId"
                      >
                        {{
                          String(
                            row[columnIndexes.get(column.sourceId) ?? -1] ?? '',
                          )
                        }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <span v-else-if="element.type === 'footer'">
                {{ configuration.footerText || 'Rodapé' }}
              </span>
              <span
                v-else-if="element.type === 'pageNumber'"
                class="editor-page-number"
              >
                Página {{ currentPage }}
              </span>
              <span v-else-if="element.type === 'customText'">
                {{ element.content }}
              </span>
              <span v-else-if="element.type === 'shape'" aria-hidden="true" />
              <span v-else-if="element.type === 'dataField'">
                {{ previewDataFieldValue(element) }}
              </span>
              <span v-else-if="element.type === 'summary'">
                {{ element.summary?.label }}:
                {{
                  element.summary
                    ? calculateSummary(element.summary, data, configuration)
                    : '—'
                }}
              </span>
              <span v-else-if="element.type === 'formula'">
                {{ element.formula?.label }}:
                {{
                  element.formula
                    ? calculateFormula(element.formula, data)
                    : '—'
                }}
              </span>
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
                      v-for="(weight, index) in dataTable(element)
                        ?.columnWeights"
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
                          backgroundColor:
                            element.dataTable.headerBackgroundColor,
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
                      v-for="(row, index) in dataTable(element)?.rows.slice(
                        0,
                        6,
                      )"
                      :key="index"
                    >
                      <td
                        v-for="(cell, cellIndex) in row"
                        :key="cellIndex"
                        :style="{
                          backgroundColor:
                            element.dataTable.cellBackgroundColor,
                          color: element.dataTable.cellTextColor,
                          borderColor: element.dataTable.borderColor,
                        }"
                      >
                        {{ cell }}
                      </td>
                    </tr>
                    <tr v-if="dataTable(element)?.totals" class="total-row">
                      <td
                        v-for="(cell, index) in dataTable(element)?.totals"
                        :key="index"
                      >
                        {{ cell }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                class="resize-handle"
                type="button"
                :aria-label="`Redimensionar ${reportElementLabel(element)}`"
                @pointerdown.stop="startPointer($event, element.id, 'resize')"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <Message
      v-for="message in overflowMessages"
      :key="message"
      severity="warn"
      :closable="false"
    >
      {{ message }}
    </Message>
    <div class="step-actions">
      <Button
        label="Voltar à configuração"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        @click="emit('back')"
      />
      <Button
        label="Revisar e exportar"
        icon="pi pi-arrow-right"
        icon-pos="right"
        :disabled="overflowMessages.length > 0 || !reportStore.isValid"
        @click="emit('next')"
      />
    </div>

    <ElementPropertiesDrawer
      v-model:visible="drawerVisible"
      :selected-id="selectedId"
      :data="data"
    />
  </section>
</template>
