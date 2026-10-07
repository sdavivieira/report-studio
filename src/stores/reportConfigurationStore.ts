import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { WorksheetData } from '../domain/workbook/Workbook'
import {
  cloneReportConfiguration,
  createDefaultReportConfiguration,
  moveReportColumn,
  validateReportConfiguration,
} from '../domain/report/ReportConfiguration'
import type {
  ReportColumnConfiguration,
  ReportConfiguration,
} from '../domain/report/ReportConfiguration'
import { createDefaultReportElements } from '../domain/report/ReportLayout'
import {
  colorsDetectedFromPdf,
  createEditablePdfElements,
} from '../domain/report/PdfTemplateDetection'
import {
  cloneReportElements,
  findReportElementById,
  type ReportElement,
  type ReportImage,
  type PdfTemplateAsset,
  type ReportTemplate,
} from '../domain/report/ReportTemplate'

const HISTORY_LIMIT = 30

interface LayoutSnapshot {
  elements: ReportElement[]
  pageCount: number
}

export const useReportConfigurationStore = defineStore(
  'report-configuration',
  () => {
    const configuration = ref<ReportConfiguration | null>(null)
    const elements = ref<ReportElement[]>([])
    const image = ref<ReportImage | null>(null)
    const pdfTemplate = ref<PdfTemplateAsset | null>(null)
    const pdfReferenceVisible = ref(false)
    const worksheetIdentity = ref('')
    const savedFingerprint = ref('')
    const undoStack = ref<LayoutSnapshot[]>([])
    const redoStack = ref<LayoutSnapshot[]>([])

    const validationErrors = computed(() =>
      configuration.value
        ? validateReportConfiguration(configuration.value)
        : ['Configure o relatório antes de continuar.'],
    )
    const isValid = computed(() => validationErrors.value.length === 0)
    const canUndo = computed(() => undoStack.value.length > 0)
    const canRedo = computed(() => redoStack.value.length > 0)
    const isDirty = computed(
      () => currentFingerprint() !== savedFingerprint.value,
    )

    function initialize(data: WorksheetData) {
      const identity = worksheetKey(data)
      if (configuration.value && identity === worksheetIdentity.value) return
      const nextConfiguration = createDefaultReportConfiguration(data.columns)
      configuration.value = nextConfiguration
      elements.value = cloneReportElements(
        createDefaultReportElements(data, nextConfiguration),
      )
      if (pdfTemplate.value) applyPdfTemplate(data)
      image.value = null
      worksheetIdentity.value = identity
      clearHistory()
      markSaved()
    }

    function updateColumn(
      sourceId: string,
      patch: Partial<Omit<ReportColumnConfiguration, 'sourceId' | 'order'>>,
    ) {
      if (!configuration.value) return
      const column = configuration.value.columns.find(
        (candidate) => candidate.sourceId === sourceId,
      )
      if (column) Object.assign(column, patch)
    }

    function moveColumn(sourceId: string, direction: -1 | 1) {
      if (!configuration.value) return
      configuration.value.columns = moveReportColumn(
        configuration.value.columns,
        sourceId,
        direction,
      )
    }

    function updateElement(
      id: string,
      patch: Partial<ReportElement>,
      recordHistory = true,
    ) {
      const index = elements.value.findIndex(
        (element) => element.id === id || element.type === id,
      )
      const current = elements.value[index]
      if (index < 0 || !current) return
      if (recordHistory) pushUndo(elements.value)
      const updated = {
        ...current,
        ...patch,
        position: { ...current.position, ...patch.position },
        size: { ...current.size, ...patch.size },
        style: { ...current.style, ...patch.style },
      }
      elements.value[index] = updated
      if (patch.position || patch.size) transformChildElements(current, updated)
      if (recordHistory) redoStack.value = []
    }

    function transformChildElements(
      previousParent: ReportElement,
      nextParent: ReportElement,
    ) {
      const descendants = descendantIds(previousParent.id)
      if (!descendants.size) return
      const scaleX =
        nextParent.size.width / Math.max(previousParent.size.width, 0.001)
      const scaleY =
        nextParent.size.height / Math.max(previousParent.size.height, 0.001)
      elements.value = elements.value.map((element) => {
        if (!descendants.has(element.id)) return element
        return {
          ...element,
          position: {
            x:
              nextParent.position.x +
              (element.position.x - previousParent.position.x) * scaleX,
            y:
              nextParent.position.y +
              (element.position.y - previousParent.position.y) * scaleY,
          },
          size: {
            width: element.size.width * scaleX,
            height: element.size.height * scaleY,
          },
        }
      })
    }

    function descendantIds(parentId: string): Set<string> {
      const result = new Set<string>()
      let frontier = [parentId]
      while (frontier.length) {
        const parents = new Set(frontier)
        frontier = elements.value
          .filter(
            (element) =>
              element.parentId &&
              parents.has(element.parentId) &&
              !result.has(element.id),
          )
          .map((element) => {
            result.add(element.id)
            return element.id
          })
      }
      return result
    }

    function addCustomText(pageIndex = 0) {
      const id = `custom-text-${crypto.randomUUID()}`
      pushUndo(elements.value)
      elements.value.push({
        id,
        type: 'customText',
        visible: true,
        position: nextCustomPosition(pageIndex, 0.07),
        size: { width: 0.4, height: 0.07 },
        keepAspectRatio: false,
        style: { color: '#253c36', fontSize: 12, alignment: 'left' },
        pageIndex,
        repeatOnEveryPage: false,
        content: 'Novo texto',
      })
      redoStack.value = []
      return id
    }

    function addSummary(data: WorksheetData, pageIndex = 0) {
      const column = configuration.value?.columns.find((item) => item.visible)
      if (!column) return null
      const id = `summary-${crypto.randomUUID()}`
      pushUndo(elements.value)
      elements.value.push({
        id,
        type: 'summary',
        visible: true,
        position: nextCustomPosition(pageIndex, 0.07),
        size: { width: 0.3, height: 0.07 },
        keepAspectRatio: false,
        style: { color: '#253c36', fontSize: 12, alignment: 'left' },
        pageIndex,
        repeatOnEveryPage: false,
        summary: {
          label: `Total de ${column.label}`,
          sourceId: column.sourceId,
          operation: data.rows.some(
            (row) =>
              typeof row[
                data.columns.find((item) => item.id === column.sourceId)
                  ?.index ?? -1
              ] === 'number',
          )
            ? 'sum'
            : 'count',
        },
      })
      redoStack.value = []
      return id
    }

    function addFormula(data: WorksheetData, pageIndex = 0) {
      const numericColumns = data.columns.filter((column) =>
        data.rows.some((row) => typeof row[column.index] === 'number'),
      )
      const left = numericColumns[0]
      const right = numericColumns[1] ?? left
      if (!left || !right) return null
      const id = `formula-${crypto.randomUUID()}`
      pushUndo(elements.value)
      elements.value.push({
        id,
        type: 'formula',
        visible: true,
        position: nextCustomPosition(pageIndex, 0.07),
        size: { width: 0.3, height: 0.07 },
        keepAspectRatio: false,
        style: { color: '#253c36', fontSize: 12, alignment: 'left' },
        pageIndex,
        repeatOnEveryPage: false,
        formula: {
          label: `${left.label} menos ${right.label}`,
          leftSourceId: left.id,
          rightSourceId: right.id,
          operator: 'subtract',
          aggregation: 'sum',
        },
      })
      redoStack.value = []
      return id
    }

    function addChart(data: WorksheetData, pageIndex = 0) {
      const category = data.columns[0]
      const value =
        data.columns.find((column) =>
          data.rows.some((row) => typeof row[column.index] === 'number'),
        ) ?? data.columns[1]
      if (!category || !value) return null
      const id = `chart-${crypto.randomUUID()}`
      pushUndo(elements.value)
      elements.value.push({
        id,
        type: 'chart',
        visible: true,
        position: nextCustomPosition(pageIndex, 0.25),
        size: { width: 0.55, height: 0.25 },
        keepAspectRatio: false,
        style: { color: '#253c36', backgroundColor: '#ffffff', fontSize: 10 },
        pageIndex,
        repeatOnEveryPage: false,
        chart: {
          title: `Análise por ${category.label}`,
          chartType: 'bar',
          categorySourceId: category.id,
          valueSourceId: value.id,
          aggregation: 'sum',
          maxItems: 8,
        },
      })
      redoStack.value = []
      return id
    }

    function addDataTable(data: WorksheetData, pageIndex = 0) {
      const sourceIds = data.columns.slice(0, 4).map((column) => column.id)
      const sortSourceId =
        data.columns.find((column) =>
          data.rows.some((row) => typeof row[column.index] === 'number'),
        )?.id ?? sourceIds[0]
      if (!sourceIds.length || !sortSourceId) return null
      const id = `data-table-${crypto.randomUUID()}`
      pushUndo(elements.value)
      elements.value.push({
        id,
        type: 'dataTable',
        visible: true,
        position: nextCustomPosition(pageIndex, 0.27),
        size: { width: 0.75, height: 0.27 },
        keepAspectRatio: false,
        style: { color: '#253c36', backgroundColor: '#ffffff', fontSize: 8 },
        pageIndex,
        repeatOnEveryPage: false,
        dataTable: {
          title: 'Ranking',
          sourceIds,
          sortSourceId,
          sortDirection: 'descending',
          limit: 10,
          showRank: true,
          showTotals: true,
        },
      })
      redoStack.value = []
      return id
    }

    function addDataField(data: WorksheetData, pageIndex = 0) {
      const column = data.columns[0]
      if (!column) return null
      const id = `data-field-${crypto.randomUUID()}`
      pushUndo(elements.value)
      elements.value.push({
        id,
        type: 'dataField',
        visible: true,
        position: nextCustomPosition(pageIndex, 0.06),
        size: { width: 0.3, height: 0.06 },
        keepAspectRatio: false,
        style: {
          color: '#253c36',
          backgroundColor: '#ffffff',
          fontSize: 11,
          alignment: 'left',
        },
        pageIndex,
        repeatOnEveryPage: false,
        dataField: {
          sourceId: column.id,
          rowIndex: 0,
          prefix: '',
          suffix: '',
          matchConfidence: 1,
          matchReason: 'manual',
        },
      })
      redoStack.value = []
      return id
    }

    function duplicateElement(id: string) {
      const source = findReportElementById(elements.value, id)
      if (!source || !isDuplicableElement(source)) return null
      pushUndo(elements.value)
      const copy = cloneReportElements([source])[0]
      if (!copy) return null
      copy.id = `${source.type}-${crypto.randomUUID()}`
      copy.position = {
        x: Math.min(1 - copy.size.width, Math.max(0, copy.position.x + 0.025)),
        y: Math.min(1 - copy.size.height, Math.max(0, copy.position.y + 0.025)),
      }
      elements.value.push(copy)
      redoStack.value = []
      return copy.id
    }

    function moveElementLayer(id: string, direction: -1 | 1) {
      const index = elements.value.findIndex((element) => element.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= elements.value.length) return
      pushUndo(elements.value)
      const reordered = [...elements.value]
      const [element] = reordered.splice(index, 1)
      if (!element) return
      reordered.splice(target, 0, element)
      elements.value = reordered
      redoStack.value = []
    }

    function alignElement(
      id: string,
      alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
    ) {
      const element = findReportElementById(elements.value, id)
      if (!element) return
      const position = { ...element.position }
      if (alignment === 'left') position.x = 0
      if (alignment === 'center') position.x = (1 - element.size.width) / 2
      if (alignment === 'right') position.x = 1 - element.size.width
      if (alignment === 'top') position.y = 0
      if (alignment === 'middle') position.y = (1 - element.size.height) / 2
      if (alignment === 'bottom') position.y = 1 - element.size.height
      updateElement(id, { position })
    }

    function duplicatePage(pageIndex: number) {
      if (!configuration.value || configuration.value.pageCount >= 20)
        return null
      const newPageIndex = pageIndex + 1
      pushUndo(elements.value)
      elements.value = [
        ...elements.value.map((element) =>
          !element.repeatOnEveryPage && (element.pageIndex ?? 0) > pageIndex
            ? { ...element, pageIndex: (element.pageIndex ?? 0) + 1 }
            : element,
        ),
        ...cloneReportElements(
          elements.value.filter(
            (element) =>
              isDuplicableElement(element) &&
              !element.repeatOnEveryPage &&
              (element.pageIndex ?? 0) === pageIndex,
          ),
        ).map((element) => ({
          ...element,
          id: `${element.type}-${crypto.randomUUID()}`,
          pageIndex: newPageIndex,
        })),
      ]
      configuration.value.pageCount += 1
      redoStack.value = []
      return newPageIndex
    }

    function addPage() {
      if (!configuration.value || configuration.value.pageCount >= 20)
        return null
      pushUndo(elements.value)
      configuration.value.pageCount += 1
      redoStack.value = []
      return configuration.value.pageCount - 1
    }

    function removePage(pageIndex: number) {
      if (!configuration.value || configuration.value.pageCount <= 1)
        return false
      pushUndo(elements.value)
      elements.value = elements.value
        .filter(
          (element) =>
            element.repeatOnEveryPage ||
            !isDuplicableElement(element) ||
            (element.pageIndex ?? 0) !== pageIndex,
        )
        .map((element) =>
          !element.repeatOnEveryPage && (element.pageIndex ?? 0) > pageIndex
            ? { ...element, pageIndex: (element.pageIndex ?? 0) - 1 }
            : element,
        )
      configuration.value.pageCount -= 1
      redoStack.value = []
      return true
    }

    function removeElement(id: string) {
      const element = findReportElementById(elements.value, id)
      if (
        !element ||
        ![
          'customText',
          'summary',
          'formula',
          'chart',
          'dataTable',
          'dataField',
          'shape',
        ].includes(element.type)
      )
        return
      pushUndo(elements.value)
      elements.value = elements.value.filter((candidate) => candidate.id !== id)
      redoStack.value = []
    }

    function nextCustomPosition(pageIndex: number, height: number) {
      const gap = 0.02
      const pageElements = elements.value
        .filter(
          (element) =>
            [
              'customText',
              'summary',
              'formula',
              'chart',
              'dataTable',
              'dataField',
              'shape',
            ].includes(element.type) &&
            !element.repeatOnEveryPage &&
            (element.pageIndex ?? 0) === pageIndex,
        )
        .sort((left, right) => left.position.y - right.position.y)
      let y = 0.14
      for (const element of pageElements) {
        if (y + height + gap <= element.position.y) break
        y = Math.max(y, element.position.y + element.size.height + gap)
      }
      return { x: 0.08, y: Math.min(0.95 - height, y) }
    }

    function commitElementInteraction(before: readonly ReportElement[]) {
      if (JSON.stringify(before) === JSON.stringify(elements.value)) return
      pushUndo(before)
      redoStack.value = []
    }

    function undoLayout() {
      const previous = undoStack.value.pop()
      if (!previous) return
      redoStack.value.push(createLayoutSnapshot())
      restoreLayoutSnapshot(previous)
    }

    function redoLayout() {
      const next = redoStack.value.pop()
      if (!next) return
      pushUndo(elements.value)
      restoreLayoutSnapshot(next)
    }

    function resetLayout(data: WorksheetData) {
      if (!configuration.value) return
      pushUndo(elements.value)
      const defaults = cloneReportElements(
        createDefaultReportElements(data, configuration.value),
      )
      elements.value = pdfTemplate.value
        ? importedPdfElements(
            pdfTemplate.value,
            data,
            defaults.map((element) => ({ ...element, visible: false })),
          )
        : defaults
      redoStack.value = []
    }

    function setImage(nextImage: ReportImage | null) {
      image.value = nextImage
      updateElement('image', { visible: Boolean(nextImage) })
    }

    function setPdfTemplate(
      template: PdfTemplateAsset | null,
      data?: WorksheetData,
    ) {
      pdfTemplate.value = template
      pdfReferenceVisible.value = false
      if (template && data && configuration.value) applyPdfTemplate(data)
    }

    function setPdfReferenceVisible(visible: boolean) {
      pdfReferenceVisible.value = visible
    }

    function applyPdfTemplate(data: WorksheetData): number {
      const template = pdfTemplate.value
      const currentConfiguration = configuration.value
      if (!template || !currentConfiguration) return 0
      currentConfiguration.pageCount = template.pages.length
      const firstPage = template.pages[0]
      if (firstPage)
        currentConfiguration.orientation =
          firstPage.width > firstPage.height ? 'landscape' : 'portrait'
      const structural = cloneReportElements(
        createDefaultReportElements(data, currentConfiguration),
      ).map((element) => ({ ...element, visible: false }))
      const imported = importedPdfElements(template, data, structural)
      elements.value = imported
      currentConfiguration.colors = colorsDetectedFromPdf(
        template,
        imported,
        currentConfiguration.colors,
      )
      clearHistory()
      return imported.length - structural.length
    }

    function applyTemplate(template: ReportTemplate, data: WorksheetData) {
      configuration.value = cloneReportConfiguration(template.configuration)
      elements.value = cloneReportElements(template.elements)
      worksheetIdentity.value = worksheetKey(data)
      clearHistory()
    }

    function setRestoredImage(restoredImage: ReportImage | null) {
      image.value = restoredImage
      if (!restoredImage) updateElement('image', { visible: false }, false)
    }

    function markSaved() {
      savedFingerprint.value = currentFingerprint()
    }

    function reset(options: { preservePdfTemplate?: boolean } = {}) {
      configuration.value = null
      elements.value = []
      image.value = null
      if (!options.preservePdfTemplate) pdfTemplate.value = null
      if (!options.preservePdfTemplate) pdfReferenceVisible.value = false
      worksheetIdentity.value = ''
      savedFingerprint.value = ''
      clearHistory()
    }

    function clearHistory() {
      undoStack.value = []
      redoStack.value = []
    }

    function pushUndo(snapshot: readonly ReportElement[]) {
      undoStack.value.push({
        elements: cloneReportElements(snapshot),
        pageCount: configuration.value?.pageCount ?? 1,
      })
      if (undoStack.value.length > HISTORY_LIMIT) undoStack.value.shift()
    }

    function createLayoutSnapshot(): LayoutSnapshot {
      return {
        elements: cloneReportElements(elements.value),
        pageCount: configuration.value?.pageCount ?? 1,
      }
    }

    function restoreLayoutSnapshot(snapshot: LayoutSnapshot) {
      elements.value = cloneReportElements(snapshot.elements)
      if (configuration.value)
        configuration.value.pageCount = snapshot.pageCount
    }

    function currentFingerprint(): string {
      return JSON.stringify({
        configuration: configuration.value,
        elements: elements.value,
        image: image.value
          ? {
              name: image.value.name,
              width: image.value.width,
              height: image.value.height,
            }
          : null,
      })
    }

    return {
      configuration,
      elements,
      image,
      pdfTemplate,
      pdfReferenceVisible,
      validationErrors,
      isValid,
      isDirty,
      canUndo,
      canRedo,
      initialize,
      updateColumn,
      moveColumn,
      updateElement,
      addCustomText,
      addSummary,
      addFormula,
      addChart,
      addDataTable,
      addDataField,
      duplicateElement,
      moveElementLayer,
      alignElement,
      addPage,
      duplicatePage,
      removePage,
      removeElement,
      commitElementInteraction,
      undoLayout,
      redoLayout,
      resetLayout,
      setImage,
      setPdfTemplate,
      setPdfReferenceVisible,
      applyPdfTemplate,
      applyTemplate,
      setRestoredImage,
      markSaved,
      reset,
    }
  },
)

function worksheetKey(data: WorksheetData): string {
  return `${data.name}:${data.headerRow}:${data.columns
    .map((column) => column.id)
    .join('|')}`
}

function isDuplicableElement(element: ReportElement): boolean {
  return [
    'customText',
    'summary',
    'formula',
    'chart',
    'dataTable',
    'dataField',
    'shape',
  ].includes(element.type)
}

function importedPdfElements(
  template: PdfTemplateAsset,
  data: WorksheetData,
  structural: readonly ReportElement[],
): ReportElement[] {
  return [...structural, ...createEditablePdfElements(template, data)]
}
