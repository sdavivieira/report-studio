import { reactive } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReportConfigurationStore } from './reportConfigurationStore'

const worksheet = {
  name: 'Dados',
  headerRow: 1,
  columns: [
    { id: 'a', index: 0, label: 'Nome', headerValue: 'Nome' },
    { id: 'b', index: 1, label: 'Valor', headerValue: 'Valor' },
  ],
  rows: [['Café', 12.5]],
} as const

describe('report configuration state', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initializes once for a worksheet and keeps deliberate edits', () => {
    const store = useReportConfigurationStore()
    store.initialize(worksheet)
    store.configuration!.title = 'Vendas'
    store.initialize(worksheet)
    expect(store.configuration?.title).toBe('Vendas')
    expect(store.isValid).toBe(true)
  })

  it('updates, reorders and resets columns explicitly', () => {
    const store = useReportConfigurationStore()
    store.initialize(worksheet)
    store.updateColumn('b', { label: 'Total', visible: false })
    store.moveColumn('b', -1)
    expect(store.configuration?.columns[0]).toMatchObject({
      sourceId: 'b',
      label: 'Total',
      visible: false,
    })
    store.reset()
    expect(store.configuration).toBeNull()
  })

  it('keeps a limited layout history and reports unsaved changes', () => {
    const store = useReportConfigurationStore()
    store.initialize(worksheet)
    expect(store.isDirty).toBe(false)
    const originalX = store.elements.find((element) => element.type === 'title')
      ?.position.x
    store.updateElement('title', { position: { x: 0.25, y: 0.12 } })
    expect(store.isDirty).toBe(true)
    expect(store.canUndo).toBe(true)
    store.undoLayout()
    expect(
      store.elements.find((element) => element.type === 'title')?.position.x,
    ).toBe(originalX)
    expect(store.canRedo).toBe(true)
    store.redoLayout()
    expect(
      store.elements.find((element) => element.type === 'title')?.position.x,
    ).toBe(0.25)
  })

  it('applies a reactive template without relying on structured cloning', () => {
    const store = useReportConfigurationStore()
    store.initialize(worksheet)
    const template = reactive({
      version: 1 as const,
      configuration: store.configuration!,
      elements: store.elements,
    })

    template.configuration.title = 'Modelo reutilizado'
    expect(() => store.applyTemplate(template, worksheet)).not.toThrow()
    expect(store.configuration?.title).toBe('Modelo reutilizado')
  })

  it('uses the colors detected in an imported PDF instead of the default green palette', () => {
    const store = useReportConfigurationStore()
    store.initialize(worksheet)
    store.setPdfTemplate(
      {
        name: 'orcamento.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        reconstructionMode: 'editable',
        pages: [
          {
            width: 595,
            height: 842,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: [
              {
                text: 'ORÇAMENTO',
                x: 0.1,
                y: 0.08,
                width: 0.45,
                height: 0.04,
                fontSize: 24,
                color: '#d60000',
                backgroundColor: '#ffffff',
              },
              {
                text: 'Nome',
                x: 0.1,
                y: 0.2,
                width: 0.1,
                height: 0.02,
                fontSize: 9,
                color: '#111111',
                backgroundColor: '#f4dede',
              },
            ],
            detectedShapes: [
              {
                kind: 'rectangle',
                x: 0.05,
                y: 0.05,
                width: 0.9,
                height: 0.08,
                fillColor: '#d60000',
                borderColor: '#b9b9b9',
              },
            ],
          },
        ],
      },
      worksheet,
    )

    expect(store.configuration?.colors.title).toBe('#d60000')
    expect(store.configuration?.colors.tableHeader).toBe('#d60000')
    expect(Object.values(store.configuration!.colors)).not.toContain('#234e45')
    expect(Object.values(store.configuration!.colors)).not.toContain('#253c36')

    const parent = store.elements.find((element) => element.type === 'shape')!
    const child = store.elements.find(
      (element) => element.parentId === parent.id,
    )!
    const childBefore = {
      position: { ...child.position },
      size: { ...child.size },
    }
    store.updateElement(parent.id, {
      position: { x: parent.position.x + 0.05, y: parent.position.y + 0.04 },
      size: {
        width: parent.size.width * 0.8,
        height: parent.size.height * 1.2,
      },
    })
    const childAfter = store.elements.find(
      (element) => element.id === child.id,
    )!
    expect(childAfter.position.x).toBeGreaterThan(childBefore.position.x)
    expect(childAfter.position.y).toBeGreaterThan(childBefore.position.y)
    expect(childAfter.size.width).toBeCloseTo(childBefore.size.width * 0.8)
    expect(childAfter.size.height).toBeCloseTo(childBefore.size.height * 1.2)
    store.undoLayout()
    expect(
      store.elements.find((element) => element.id === child.id)?.position,
    ).toEqual(childBefore.position)
  })

  it('places new data blocks below the previous block on the same page', () => {
    const store = useReportConfigurationStore()
    store.initialize(worksheet)
    const textId = store.addCustomText(0)
    const formulaId = store.addFormula(worksheet, 0)
    const chartId = store.addChart(worksheet, 0)
    const tableId = store.addDataTable(worksheet, 0)
    const ids = [textId, formulaId, chartId, tableId]
    const blocks = ids.map((id) =>
      store.elements.find((element) => element.id === id),
    )

    for (let index = 1; index < blocks.length; index++) {
      const previous = blocks[index - 1]
      const current = blocks[index]
      expect(previous).toBeDefined()
      expect(current).toBeDefined()
      expect(current!.position.y).toBeGreaterThanOrEqual(
        previous!.position.y + previous!.size.height,
      )
    }
  })

  it('creates manual fields, duplicates blocks and manages custom pages', () => {
    const store = useReportConfigurationStore()
    store.initialize(worksheet)
    const fieldId = store.addDataField(worksheet, 0)
    expect(fieldId).toBeTruthy()
    expect(
      store.elements.find((element) => element.id === fieldId)?.dataField,
    ).toMatchObject({
      sourceId: 'a',
      rowIndex: 0,
      matchReason: 'manual',
    })

    const copyId = store.duplicateElement(fieldId!)
    expect(copyId).toBeTruthy()
    store.alignElement(copyId!, 'center')
    expect(
      store.elements.find((element) => element.id === copyId)?.position.x,
    ).toBeGreaterThan(0)

    const duplicatedPage = store.duplicatePage(0)
    expect(duplicatedPage).toBe(1)
    expect(store.configuration?.pageCount).toBe(2)
    store.undoLayout()
    expect(store.configuration?.pageCount).toBe(1)
    store.redoLayout()
    expect(store.configuration?.pageCount).toBe(2)
    expect(store.removePage(1)).toBe(true)
    expect(store.configuration?.pageCount).toBe(1)
  })
})
