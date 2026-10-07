import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ReportLayoutEditor from './ReportLayoutEditor.vue'
import { useWorkbookStore } from '../../stores/workbookStore'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'

function mountEditor() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const workbookStore = useWorkbookStore()
  workbookStore.original = {
    fileName: 'dados.xlsx',
    fileSize: 20,
    sheets: [{ name: 'Dados', rows: [['Nome'], ['Café']] }],
  }
  workbookStore.selectSheet(0)
  const reportStore = useReportConfigurationStore()
  reportStore.initialize(workbookStore.working!)
  const wrapper = mount(ReportLayoutEditor, {
    attachTo: document.body,
    global: { plugins: [pinia, PrimeVue] },
  })
  return { reportStore, wrapper }
}

describe('report layout editor', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps numeric positioning as an optional fine adjustment', async () => {
    const { reportStore, wrapper } = mountEditor()

    await wrapper.get('.element-list button').trigger('click')
    await flushPromises()
    const finePositioning =
      document.querySelector<HTMLDetailsElement>('.fine-positioning')
    expect(finePositioning?.open).toBe(false)
    const teleportedInput =
      document.querySelector<HTMLInputElement>('#element-x')
    expect(teleportedInput).not.toBeNull()
    const xInput = new DOMWrapper(teleportedInput!)
    await xInput.setValue('30')
    await xInput.trigger('blur')
    await flushPromises()
    expect(reportStore.canUndo).toBe(true)
    expect(wrapper.text()).toContain('Modelo com alterações não salvas')
    wrapper.unmount()
  })

  it('moves a block by dragging it directly on the page', async () => {
    const { reportStore, wrapper } = mountEditor()
    const page = wrapper.get('.editor-page').element as HTMLElement
    page.getBoundingClientRect = () => ({ width: 600, height: 800 }) as DOMRect
    const title = wrapper.get('.editable-element')
    const initial = reportStore.elements.find(
      (element) => element.type === 'title',
    )!

    title.element.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }),
    )
    await flushPromises()
    expect(document.querySelector('.property-drawer')).toBeNull()
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 30, clientY: 80 }),
    )
    window.dispatchEvent(new MouseEvent('pointerup'))
    await flushPromises()

    const moved = reportStore.elements.find(
      (element) => element.type === 'title',
    )!
    expect(moved.position.x).toBeCloseTo(initial.position.x + 0.05)
    expect(moved.position.y).toBeCloseTo(initial.position.y + 0.1)
    expect(reportStore.canUndo).toBe(true)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }),
    )
    await flushPromises()
    expect(
      reportStore.elements.find((element) => element.type === 'title')
        ?.position,
    ).toEqual(initial.position)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }),
    )
    await flushPromises()
    expect(
      reportStore.elements.find((element) => element.type === 'title')?.position
        .y,
    ).toBeCloseTo(moved.position.y)
    wrapper.unmount()
  })
})
