import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkbookStore } from './workbookStore'
import type { WorkbookReader } from '../application/import-workbook/importWorkbook'
import { prepareCleaning } from '../application/clean-workbook/prepareCleaning'
import { defaultCleaningOptions } from '../domain/workbook/CleaningOptions'

describe('workbook state', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('previews without mutation, applies and undoes exactly the last cleaning', async () => {
    const store = useWorkbookStore()
    store.original = {
      fileName: 'A.xlsx',
      fileSize: 10,
      sheets: [
        { name: 'A', rows: [[' Nome '], [' a  b ']] },
        { name: 'B', rows: [['X'], [1]] },
      ],
    }
    store.selectSheet(0)
    const first = store.working
    const processor = {
      prepare: async (
        data: Parameters<typeof prepareCleaning>[0],
        options: Parameters<typeof prepareCleaning>[1],
      ) => prepareCleaning(data, options),
    }
    expect(
      await store.previewCleaning(
        { ...defaultCleaningOptions(), trimSpaces: true },
        processor,
      ),
    ).toBe(true)
    expect(store.working).toBe(first)
    expect(store.appliedCleanings).toHaveLength(0)
    expect(store.applyCleaning()).toBe(true)
    expect(store.working?.rows).toEqual([['a  b']])
    expect(store.original.sheets[0]?.rows).toEqual([[' Nome '], [' a  b ']])
    await store.previewCleaning(
      { ...defaultCleaningOptions(), collapseSpaces: true },
      processor,
    )
    store.applyCleaning()
    expect(store.working?.rows).toEqual([['a b']])
    store.undoCleaning()
    expect(store.working?.rows).toEqual([['a  b']])
    expect(store.appliedCleanings).toHaveLength(1)
    expect(store.canUndoCleaning).toBe(false)
    store.selectSheet(1)
    expect(store.appliedCleanings).toEqual([])
    expect(store.pendingPlan).toBeNull()
  })
  it('discards a canceled preview and handles failure without losing working data', async () => {
    const store = useWorkbookStore()
    store.original = {
      fileName: 'A.xlsx',
      fileSize: 10,
      sheets: [{ name: 'A', rows: [['A'], [' a ']] }],
    }
    store.selectSheet(0)
    const first = store.working
    await store.previewCleaning(defaultCleaningOptions(), {
      prepare: async (data, options) => prepareCleaning(data, options),
    })
    expect(store.applyCleaning()).toBe(false)
    store.clearCleaningPreview()
    expect(store.applyCleaning()).toBe(false)
    expect(
      await store.previewCleaning(defaultCleaningOptions(), {
        prepare: async () => {
          throw new Error('worker')
        },
      }),
    ).toBe(false)
    expect(store.working).toBe(first)
    expect(store.isPreparing).toBe(false)
    expect(store.cleaningError).not.toBe('')
  })
  it('preserves existing workbook if replacement fails and supports explicit discard', async () => {
    const store = useWorkbookStore()
    const reader: WorkbookReader = {
      read: async () => ({
        ok: true,
        workbook: {
          fileName: 'teste.xlsx',
          fileSize: 3,
          sheets: [{ name: 'A', rows: [['A'], [1]] }],
        },
      }),
    }
    const file = {
      name: 'teste.xlsx',
      type: '',
      size: 3,
      arrayBuffer: async () => new ArrayBuffer(3),
    }
    expect(await store.importFile(file, reader)).toBe(true)
    expect(await store.importFile({ ...file, name: 'bad.txt' }, reader)).toBe(
      false,
    )
    expect(store.working?.rows).toEqual([[1]])
    expect(store.isImporting).toBe(false)
    expect(store.error).toContain('.xlsx')
    store.reset()
    expect(store.original).toBe(null)
    expect(store.working).toBe(null)
    expect(store.error).toBe('')
  })
})
