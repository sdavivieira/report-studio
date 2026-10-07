import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import CleaningPanel from './CleaningPanel.vue'
import { useWorkbookStore } from '../../stores/workbookStore'
import { prepareCleaning } from '../../application/clean-workbook/prepareCleaning'

describe('cleaning interface', () => {
  it('keeps all operations opt-in, previews first, then applies and undoes', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useWorkbookStore()
    store.original = {
      fileName: 'A.xlsx',
      fileSize: 10,
      sheets: [{ name: 'A', rows: [['Nome'], [' a ']] }],
    }
    store.selectSheet(0)
    const actualPreview = store.previewCleaning.bind(store)
    vi.spyOn(store, 'previewCleaning').mockImplementation((options) =>
      actualPreview(options, {
        prepare: async (data, settings) => prepareCleaning(data, settings),
      }),
    )
    const wrapper = mount(CleaningPanel, {
      global: {
        plugins: [pinia, PrimeVue, ToastService],
        stubs: { teleport: true },
      },
    })
    expect(
      wrapper
        .findAllComponents(Checkbox)
        .every((checkbox) => !checkbox.props('modelValue')),
    ).toBe(true)
    const button = (label: string) =>
      wrapper.findAllComponents(Button).find((b) => b.props('label') === label)!
    await button('Escolher limpezas').trigger('click')
    wrapper
      .findAllComponents(Checkbox)
      .find((checkbox) => checkbox.props('inputId') === 'trimSpaces')!
      .vm.$emit('update:modelValue', true)
    await button('Revisar alterações').trigger('click')
    await flushPromises()
    expect(store.working?.rows).toEqual([[' a ']])
    expect(wrapper.text()).toContain('Nenhuma alteração foi aplicada ainda')
    await button('Aplicar limpeza').trigger('click')
    await flushPromises()
    expect(store.working?.rows).toEqual([['a']])
    await button('Desfazer última limpeza').trigger('click')
    await flushPromises()
    expect(store.working?.rows).toEqual([[' a ']])
    wrapper.unmount()
  })
})
