<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import type { WorksheetData } from '../../domain/workbook/Workbook'
import type { ReportConfiguration } from '../../domain/report/ReportConfiguration'
import type {
  ReportElement,
  ReportImage,
  PdfTemplateAsset,
} from '../../domain/report/ReportTemplate'
import {
  createBatchReportPdf,
  createReportPdf,
} from '../../application/export-pdf/createReportPdf'
import { downloadBrowserFile } from '../../adapters/files/BrowserFileDownloader'

const props = defineProps<{
  data: WorksheetData
  configuration: ReportConfiguration
  elements: readonly ReportElement[]
  image: ReportImage | null
  pdfTemplate: PdfTemplateAsset | null
  valid: boolean
}>()

const isGenerating = ref(false)
const error = ref('')
const success = ref('')
const exportMode = ref<'consolidated' | 'records'>('consolidated')
const startRow = ref(1)
const rowCount = ref(25)
const completedRows = ref(0)
const exportModeOptions = [
  { label: 'Um relatório consolidado', value: 'consolidated' },
  { label: 'Um relatório por registro, no mesmo PDF', value: 'records' },
]
const effectiveRowCount = computed(() => {
  const availableRows = props.data.rows.length - startRow.value + 1
  return Math.max(0, Math.min(rowCount.value, availableRows, 100))
})

async function generatePdf() {
  if (isGenerating.value) return
  isGenerating.value = true
  completedRows.value = 0
  error.value = ''
  success.value = ''
  try {
    const { browserPdfWorkerRenderer } =
      await import('../../adapters/pdf/BrowserPdfWorkerRenderer')
    const result =
      exportMode.value === 'records'
        ? await createBatchReportPdf(
            props.data,
            props.configuration,
            browserPdfWorkerRenderer,
            (await import('../../adapters/pdf/PdfLibDocumentMerger'))
              .pdfLibDocumentMerger,
            props.elements,
            props.image,
            props.pdfTemplate,
            startRow.value - 1,
            effectiveRowCount.value,
            (completed) => {
              completedRows.value = completed
            },
          )
        : await createReportPdf(
            props.data,
            props.configuration,
            browserPdfWorkerRenderer,
            props.elements,
            props.image,
            props.pdfTemplate,
          )
    if (!result.ok) {
      error.value = result.message
      return
    }
    downloadBrowserFile(result.blob, result.fileName)
    success.value = `${result.fileName} gerado com ${result.pageCount} página(s).`
  } catch {
    error.value = 'Não foi possível carregar o gerador de PDF local.'
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <section class="export-panel" aria-labelledby="export-heading">
    <div>
      <h2 id="export-heading">Gerar PDF</h2>
      <p class="muted">
        O arquivo é montado no navegador. O download só começa quando você
        aciona o botão.
      </p>
      <p class="font-license">
        Fonte incorporada: Noto Sans, licenciada sob SIL Open Font License 1.1.
      </p>
    </div>
    <div class="field">
      <label id="export-mode-label" for="export-mode">
        Formato da exportação
      </label>
      <Select
        v-model="exportMode"
        input-id="export-mode"
        aria-labelledby="export-mode-label"
        :options="exportModeOptions"
        option-label="label"
        option-value="value"
      />
    </div>
    <div v-if="exportMode === 'records'" class="property-grid">
      <div class="field">
        <label for="batch-start-row">Primeiro registro</label>
        <InputNumber
          v-model="startRow"
          input-id="batch-start-row"
          :min="1"
          :max="data.rows.length"
          :use-grouping="false"
        />
      </div>
      <div class="field">
        <label for="batch-row-count">Quantidade</label>
        <InputNumber
          v-model="rowCount"
          input-id="batch-row-count"
          :min="1"
          :max="100"
          :use-grouping="false"
        />
      </div>
    </div>
    <Message v-if="exportMode === 'records'" severity="info" :closable="false">
      Cada registro usará o mesmo layout. Os campos da planilha serão
      preenchidos com a linha correspondente e reunidos em um único PDF. Máximo
      de 100 por lote.
    </Message>
    <Button
      :label="
        exportMode === 'records'
          ? `Gerar lote com ${effectiveRowCount} registro(s)`
          : 'Gerar e baixar PDF'
      "
      icon="pi pi-file-pdf"
      :loading="isGenerating"
      :disabled="
        !valid ||
        isGenerating ||
        (exportMode === 'records' && effectiveRowCount === 0)
      "
      @click="generatePdf"
    />
    <div
      v-if="isGenerating"
      class="pdf-progress"
      role="status"
      aria-live="polite"
    >
      <ProgressBar mode="indeterminate" style="height: 4px" />
      <span>
        {{
          exportMode === 'records'
            ? completedRows < effectiveRowCount
              ? `Gerando registro ${completedRows + 1} de ${effectiveRowCount}…`
              : `Reunindo ${effectiveRowCount} relatório(s) no PDF…`
            : 'Compondo páginas e incorporando fontes no navegador…'
        }}
      </span>
    </div>
    <Message v-if="error" severity="error" :closable="false" role="alert">
      {{ error }}
    </Message>
    <Message v-if="success" severity="success" :closable="false" role="status">
      {{ success }}
    </Message>
  </section>
</template>
