import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ReportConfiguration from './ReportConfiguration.vue'
import { useWorkbookStore } from '../../stores/workbookStore'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'

describe('report configuration interface', () => {
  it('initializes from real columns and keeps the preview reactive', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const workbookStore = useWorkbookStore()
    workbookStore.original = {
      fileName: 'dados.xlsx',
      fileSize: 20,
      sheets: [
        {
          name: 'Dados',
          rows: [
            ['Nome', 'Valor'],
            ['Café', 12.5],
          ],
        },
      ],
    }
    workbookStore.selectSheet(0)
    const wrapper = mount(ReportConfiguration, {
      global: { plugins: [pinia, PrimeVue] },
    })
    await flushPromises()
    const reportStore = useReportConfigurationStore()
    expect(reportStore.configuration?.columns).toHaveLength(2)
    expect(wrapper.text()).toContain('Café')
    expect(wrapper.text()).toContain('Configuração válida')

    await wrapper.get('#report-title').setValue('Resumo de vendas')
    reportStore.updateColumn('column-1', { label: 'Total' })
    await flushPromises()
    expect(wrapper.text()).toContain('Resumo de vendas')
    expect(wrapper.text()).toContain('Total')
    wrapper.unmount()
  })
})
