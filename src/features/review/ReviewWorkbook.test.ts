import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import ReviewWorkbook from './ReviewWorkbook.vue'
import { useWorkbookStore } from '../../stores/workbookStore'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'

describe('review interface', () => {
  it('renders real diagnostics, switches sheets and changes header', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useWorkbookStore()
    store.original = {
      fileName: 'exemplo.xlsx',
      fileSize: 50,
      sheets: [
        {
          name: 'Primeira',
          rows: [
            ['Título'],
            ['Nome', 'Nome'],
            ['<script>alert(1)</script>', 2],
          ],
        },
        { name: 'Resumo', rows: [['Cidade'], ['Belém']] },
      ],
    }
    store.selectSheet(0)
    const wrapper = mount(ReviewWorkbook, {
      global: { plugins: [pinia, PrimeVue, ToastService, ConfirmationService] },
    })
    wrapper.findComponent(InputNumber).vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(wrapper.text()).toContain('Cabeçalho duplicado')
    expect(wrapper.text()).toContain('<script>alert(1)</script>')
    expect(wrapper.find('script').exists()).toBe(false)
    wrapper.findComponent(Select).vm.$emit('update:modelValue', 1)
    await flushPromises()
    expect(wrapper.text()).toContain('Belém')
    expect(store.working?.headerRow).toBe(1)
    wrapper.unmount()
  })
  it('limits the preview without discarding working data', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useWorkbookStore()
    store.original = {
      fileName: 'grande.xlsx',
      fileSize: 50,
      sheets: [
        {
          name: 'Dados',
          rows: [
            ['Nome'],
            ...Array.from({ length: 250 }, (_, i) => [`Linha ${i}`]),
          ],
        },
      ],
    }
    store.selectSheet(0)
    const wrapper = mount(ReviewWorkbook, {
      global: { plugins: [pinia, PrimeVue, ToastService, ConfirmationService] },
    })
    expect(wrapper.text()).toContain(
      'Todas as 250 linhas permanecem em memória',
    )
    expect(store.working?.rows).toHaveLength(250)
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    wrapper.unmount()
  })
})
