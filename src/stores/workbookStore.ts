import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { importWorkbook } from '../application/import-workbook/importWorkbook'
import type {
  WorkbookFile,
  WorkbookReader,
} from '../application/import-workbook/importWorkbook'
import { sheetJsWorkbookReader } from '../adapters/excel/SheetJsWorkbookReader'
import { selectWorksheet } from '../domain/workbook/selectWorksheet'
import { analyzeWorksheet } from '../domain/workbook/analyzeWorksheet'
import type { Workbook, WorksheetData } from '../domain/workbook/Workbook'
import { browserCleaningProcessor } from '../adapters/cleaning/BrowserCleaningProcessor'
import { createCleaningPreview } from '../application/clean-workbook/createCleaningPreview'
import type { CleaningProcessor } from '../application/clean-workbook/prepareCleaning'
import { hasCleaningChanges } from '../domain/workbook/CleaningOptions'
import type {
  CleaningOptions,
  CleaningPlan,
  CleaningSummary,
} from '../domain/workbook/CleaningOptions'

export const useWorkbookStore = defineStore('workbook', () => {
  const original = shallowRef<Workbook | null>(null)
  const working = shallowRef<WorksheetData | null>(null)
  const selectedSheet = ref(0)
  const isImporting = ref(false)
  const error = ref('')
  const isPreparing = ref(false)
  const cleaningError = ref('')
  const pendingPlan = shallowRef<CleaningPlan | null>(null)
  const previousData = shallowRef<WorksheetData | null>(null)
  const appliedCleanings = shallowRef<readonly CleaningSummary[]>([])
  const selectionRevision = ref(0)
  const canUndoCleaning = computed(() => previousData.value !== null)
  const isBusy = computed(() => isImporting.value || isPreparing.value)
  const issues = computed(() =>
    working.value ? analyzeWorksheet(working.value) : [],
  )

  function selectSheet(index: number, headerRow = 1) {
    if (isPreparing.value) return
    const sheet = original.value?.sheets[index]
    if (!sheet) return
    selectedSheet.value = index
    working.value = selectWorksheet(sheet, headerRow)
    clearCleaningState()
    selectionRevision.value++
  }

  function clearCleaningPreview() {
    pendingPlan.value = null
    cleaningError.value = ''
  }

  function clearCleaningState() {
    clearCleaningPreview()
    previousData.value = null
    appliedCleanings.value = []
  }

  async function previewCleaning(
    options: CleaningOptions,
    processor: CleaningProcessor = browserCleaningProcessor,
  ) {
    if (!working.value || isBusy.value) return false
    clearCleaningPreview()
    isPreparing.value = true
    try {
      const result = await createCleaningPreview(
        working.value,
        options,
        processor,
      )
      if (!result.ok) {
        cleaningError.value = result.message
        return false
      }
      pendingPlan.value = result.plan
      return true
    } finally {
      isPreparing.value = false
    }
  }

  function applyCleaning() {
    if (
      !pendingPlan.value ||
      !working.value ||
      isBusy.value ||
      !hasCleaningChanges(pendingPlan.value.summary)
    )
      return false
    previousData.value = working.value
    working.value = pendingPlan.value.data
    appliedCleanings.value = [
      ...appliedCleanings.value,
      pendingPlan.value.summary,
    ]
    clearCleaningPreview()
    return true
  }

  function undoCleaning() {
    if (!previousData.value || isBusy.value) return
    working.value = previousData.value
    previousData.value = null
    appliedCleanings.value = appliedCleanings.value.slice(0, -1)
    clearCleaningPreview()
  }

  async function importFile(
    file: WorkbookFile,
    reader: WorkbookReader = sheetJsWorkbookReader,
  ) {
    if (isBusy.value) return false
    isImporting.value = true
    error.value = ''
    try {
      const result = await importWorkbook(file, reader)
      if (!result.ok) {
        error.value = result.message
        return false
      }
      original.value = result.workbook
      selectSheet(0)
      return true
    } finally {
      isImporting.value = false
    }
  }

  function reset() {
    if (isBusy.value) return
    original.value = null
    working.value = null
    selectedSheet.value = 0
    error.value = ''
    clearCleaningState()
    selectionRevision.value++
  }

  return {
    original,
    working,
    selectedSheet,
    isImporting,
    error,
    issues,
    selectSheet,
    importFile,
    reset,
    isBusy,
    isPreparing,
    cleaningError,
    pendingPlan,
    appliedCleanings,
    selectionRevision,
    canUndoCleaning,
    previewCleaning,
    applyCleaning,
    undoCleaning,
    clearCleaningPreview,
  }
})
