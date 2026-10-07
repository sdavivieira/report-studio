<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useWorkbookStore } from '../../stores/workbookStore'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'
import TemplateFilesPanel from './TemplateFilesPanel.vue'
import ExportPdfPanel from '../configuration/ExportPdfPanel.vue'
import { validateReportContent } from '../../domain/report/ReportValidation'

const emit = defineEmits<{ back: [] }>()
const workbookStore = useWorkbookStore()
const reportStore = useReportConfigurationStore()
const validationIssues = computed(() =>
  workbookStore.working
    ? validateReportContent(workbookStore.working, reportStore.elements)
    : [],
)
const contentIsValid = computed(
  () =>
    reportStore.isValid &&
    !validationIssues.value.some((issue) => issue.severity === 'error'),
)
</script>

<template>
  <section
    v-if="workbookStore.working && reportStore.configuration"
    aria-labelledby="final-export-heading"
  >
    <div class="section-heading">
      <div>
        <div class="eyebrow">ARQUIVOS SOB SEU CONTROLE</div>
        <h1 id="final-export-heading">Revise, salve e exporte.</h1>
        <p class="lead">
          A planilha, a imagem, o modelo e o PDF continuam no seu navegador até
          você escolher um download.
        </p>
      </div>
      <Tag
        :value="reportStore.isDirty ? 'Alterações não salvas' : 'Modelo salvo'"
        :severity="reportStore.isDirty ? 'warn' : 'success'"
      />
    </div>
    <div class="export-summary" aria-label="Resumo da exportação">
      <div>
        <strong>{{ reportStore.configuration.title }}</strong>
        <span>Título</span>
      </div>
      <div>
        <strong>
          {{ workbookStore.working.rows.length.toLocaleString('pt-BR') }}
        </strong>
        <span>Linhas</span>
      </div>
      <div>
        <strong>
          {{
            reportStore.configuration.columns.filter((column) => column.visible)
              .length
          }}
        </strong>
        <span>Colunas</span>
      </div>
      <div>
        <strong>
          {{
            reportStore.configuration.orientation === 'portrait'
              ? 'Retrato'
              : 'Paisagem'
          }}
        </strong>
        <span>Orientação</span>
      </div>
    </div>
    <Message
      v-if="workbookStore.working.rows.length > 10_000"
      severity="info"
      :closable="false"
    >
      Relatório extenso: o PDF será processado em uma tarefa separada para
      manter a interface responsiva.
    </Message>
    <section class="preflight-panel" aria-labelledby="preflight-heading">
      <h2 id="preflight-heading">Verificação antes de exportar</h2>
      <Message
        v-for="issue in validationIssues"
        :key="`${issue.severity}-${issue.message}`"
        :severity="issue.severity === 'warning' ? 'warn' : issue.severity"
        :closable="false"
      >
        {{ issue.message }}
      </Message>
    </section>
    <div class="export-grid">
      <TemplateFilesPanel />
      <ExportPdfPanel
        :data="workbookStore.working"
        :configuration="reportStore.configuration"
        :elements="reportStore.elements"
        :image="reportStore.image"
        :pdf-template="reportStore.pdfTemplate"
        :valid="contentIsValid"
      />
    </div>
    <div class="step-actions">
      <Button
        label="Voltar ao editor"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        @click="emit('back')"
      />
    </div>
  </section>
</template>
