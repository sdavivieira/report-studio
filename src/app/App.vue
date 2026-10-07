<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import Step from 'primevue/step'
import StepPanels from 'primevue/steppanels'
import StepPanel from 'primevue/steppanel'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import ImportWorkbook from '../features/import/ImportWorkbook.vue'
import ReviewWorkbook from '../features/review/ReviewWorkbook.vue'
import ReportConfiguration from '../features/configuration/ReportConfiguration.vue'
import ReportLayoutEditor from '../features/editor/ReportLayoutEditor.vue'
import ReportExport from '../features/export/ReportExport.vue'
import { useWorkbookStore } from '../stores/workbookStore'
import { useReportConfigurationStore } from '../stores/reportConfigurationStore'
import { createReportTemplate } from '../adapters/templates/ReportTemplateFiles'
import { saveDraftTemplate } from '../adapters/templates/BrowserTemplateLibrary'

const store = useWorkbookStore()
const reportStore = useReportConfigurationStore()
const step = ref('1')
const confirm = useConfirm()
let draftTimer: number | undefined

watch(step, (currentStep) => {
  if (currentStep === '3' && store.working)
    reportStore.initialize(store.working)
})

watch(
  () => ({
    configuration: reportStore.configuration,
    elements: reportStore.elements,
    image: reportStore.image,
  }),
  () => {
    if (!reportStore.configuration) return
    window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(() => {
      if (!reportStore.configuration) return
      saveDraftTemplate(
        createReportTemplate(
          reportStore.configuration,
          reportStore.elements,
          reportStore.image,
          false,
        ),
      )
    }, 700)
  },
  { deep: true },
)

onBeforeUnmount(() => window.clearTimeout(draftTimer))
function clearWorkbook() {
  confirm.require({
    header: 'Descartar a planilha desta sessão?',
    message:
      'Os dados em memória serão removidos. O arquivo no computador não será alterado.',
    acceptLabel: 'Descartar',
    rejectLabel: 'Manter planilha',
    accept: () => {
      store.reset()
      reportStore.reset()
      step.value = '1'
    },
  })
}

function openConfiguration() {
  if (!store.working) return
  reportStore.initialize(store.working)
  step.value = '3'
}

function finishImport() {
  reportStore.reset({ preservePdfTemplate: true })
  step.value = '2'
}

function openEditor() {
  if (!reportStore.isValid) return
  step.value = '4'
}

function openExport() {
  if (!reportStore.isValid) return
  step.value = '5'
}
</script>

<template>
  <Toast />
  <ConfirmDialog />
  <a class="skip-link" href="#main-content">Pular para o conteúdo</a>
  <header class="app-header">
    <a
      class="brand"
      href="#main-content"
      aria-label="Report Studio, conteúdo principal"
    >
      <span class="brand-mark" aria-hidden="true">
        <i class="pi pi-align-left" />
      </span>
      <span>
        report
        <span class="brand-light">studio</span>
        <small>DA PLANILHA À PÁGINA</small>
      </span>
    </a>
    <div class="header-meta">
      <span class="local-badge">
        <i class="pi pi-shield" aria-hidden="true" />
        100% local
      </span>
      <Tag value="MVP · Local" severity="secondary" />
    </div>
  </header>
  <Stepper v-model:value="step" role="group" aria-label="Etapas do relatório">
    <div class="workflow">
      <StepList role="tablist" aria-label="Etapas">
        <Step value="1" :disabled="store.isBusy">Importar</Step>
        <Step value="2" :disabled="!store.original || store.isBusy">
          Revisar
        </Step>
        <Step value="3" :disabled="!store.working || store.isBusy">
          Configurar
        </Step>
        <Step value="4" :disabled="!reportStore.isValid || store.isBusy">
          Ajustar layout
        </Step>
        <Step value="5" :disabled="!reportStore.isValid || store.isBusy">
          Exportar
        </Step>
      </StepList>
    </div>
    <div v-if="store.original" class="file-strip">
      <span>
        <i class="pi pi-file-excel" aria-hidden="true" />
        <strong>{{ store.original.fileName }}</strong>
        <span class="muted">
          {{ store.original.sheets.length }} aba(s) ·
          {{ (store.original.fileSize / 1024).toFixed(1) }} KB
        </span>
      </span>
      <Button
        label="Descartar"
        icon="pi pi-times"
        text
        severity="secondary"
        size="small"
        :disabled="store.isBusy"
        @click="clearWorkbook"
      />
    </div>
    <main id="main-content" tabindex="-1">
      <StepPanels>
        <StepPanel value="1" aria-label="1 Importar">
          <ImportWorkbook v-if="step === '1'" @imported="finishImport" />
        </StepPanel>
        <StepPanel value="2" aria-label="2 Revisar">
          <ReviewWorkbook
            v-if="step === '2'"
            @back="step = '1'"
            @next="openConfiguration"
          />
        </StepPanel>
        <StepPanel value="3" aria-label="3 Configurar">
          <ReportConfiguration
            v-if="step === '3'"
            @back="step = '2'"
            @next="openEditor"
          />
        </StepPanel>
        <StepPanel value="4" aria-label="4 Ajustar layout">
          <ReportLayoutEditor
            v-if="step === '4'"
            @back="step = '3'"
            @next="openExport"
          />
        </StepPanel>
        <StepPanel value="5" aria-label="5 Exportar">
          <ReportExport v-if="step === '5'" @back="step = '4'" />
        </StepPanel>
      </StepPanels>
    </main>
  </Stepper>
  <footer class="app-footer">
    <span>
      Report Studio
      <span class="footer-dot">/</span>
      Feito para dar forma aos seus dados.
    </span>
    <span>Sem conta. Sem nuvem. Sob seu controle.</span>
  </footer>
</template>
