<script setup lang="ts">
import { computed, ref } from 'vue'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Button from 'primevue/button'
import { useConfirm } from 'primevue/useconfirm'
import CleaningPanel from './CleaningPanel.vue'
import { useWorkbookStore } from '../../stores/workbookStore'
import { formatCell } from '../../domain/workbook/Workbook'
import type { IssueSeverity } from '../../domain/workbook/Workbook'

const emit = defineEmits<{ back: []; next: [] }>()
const store = useWorkbookStore()
const confirm = useConfirm()
const selectionKey = ref(0)
const sheets = computed(
  () =>
    store.original?.sheets.map((sheet, index) => ({
      label: sheet.name,
      value: index,
    })) ?? [],
)
const maxHeaderRow = computed(() =>
  Math.max(store.original?.sheets[store.selectedSheet]?.rows.length ?? 1, 1),
)
const previewLimit = 200
const previewRows = computed(
  () =>
    store.working?.rows.slice(0, previewLimit).map((cells, index) => ({
      line:
        store.working?.sourceRowNumbers?.[index] ??
        (store.working?.headerRow ?? 1) + index + 1,
      cells: cells.map(formatCell),
    })) ?? [],
)
const counts = computed(() => ({
  error: store.issues.filter((issue) => issue.severity === 'error').length,
  warning: store.issues.filter((issue) => issue.severity === 'warning').length,
  suggestion: store.issues.filter((issue) => issue.severity === 'suggestion')
    .length,
}))
const severityMap: Record<IssueSeverity, 'danger' | 'warn' | 'info'> = {
  error: 'danger',
  warning: 'warn',
  suggestion: 'info',
}
const severityLabels: Record<IssueSeverity, string> = {
  error: 'Erro',
  warning: 'Aviso',
  suggestion: 'Sugestão',
}

function changeHeader(value: number | null) {
  if (value !== null) changeSelection(store.selectedSheet, value)
}

function changeSelection(index: number, headerRow = 1) {
  if (index === store.selectedSheet && headerRow === store.working?.headerRow)
    return
  const apply = () => {
    store.selectSheet(index, headerRow)
    selectionKey.value++
  }
  if (!store.appliedCleanings.length) {
    apply()
    return
  }
  confirm.require({
    header: 'Descartar as limpezas desta aba?',
    message:
      'Trocar a aba ou o cabeçalho recria a cópia de trabalho a partir do original. As limpezas aplicadas serão descartadas.',
    acceptLabel: 'Descartar e trocar',
    rejectLabel: 'Manter dados',
    accept: apply,
    reject: () => {
      selectionKey.value++
    },
  })
}
</script>

<template>
  <section v-if="store.working" aria-labelledby="review-heading">
    <div class="section-heading">
      <div>
        <div class="eyebrow">CONHEÇA SUA PLANILHA</div>
        <h1 id="review-heading">Um olhar antes de continuar.</h1>
        <p class="lead">
          Confira a aba, escolha o cabeçalho e revise os avisos. O arquivo
          original permanece intacto.
        </p>
      </div>
      <Button
        label="Trocar planilha"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        :disabled="store.isBusy"
        @click="emit('back')"
      />
    </div>
    <div :key="selectionKey" class="review-controls">
      <div class="field">
        <label id="worksheet-label" for="worksheet">Aba da planilha</label>
        <Select
          input-id="worksheet"
          aria-labelledby="worksheet-label"
          :disabled="store.isBusy"
          :model-value="store.selectedSheet"
          :options="sheets"
          option-label="label"
          option-value="value"
          @update:model-value="changeSelection($event)"
        />
      </div>
      <div class="field">
        <label for="header-row">Linha do cabeçalho</label>
        <InputNumber
          input-id="header-row"
          :disabled="store.isBusy"
          :model-value="store.working.headerRow"
          :min="1"
          :max="maxHeaderRow"
          :use-grouping="false"
          show-buttons
          @update:model-value="changeHeader"
        />
      </div>
      <div class="data-count" aria-live="polite">
        <strong>{{ store.working.rows.length.toLocaleString('pt-BR') }}</strong>
        <span>linhas de dados</span>
      </div>
      <div class="data-count">
        <strong>{{ store.working.columns.length }}</strong>
        <span>colunas</span>
      </div>
    </div>
    <CleaningPanel :key="store.selectionRevision" />
    <div class="review-grid">
      <div class="table-panel">
        <div class="panel-heading">
          <h2>Prévia dos dados</h2>
          <Tag
            value="Original preservado"
            severity="success"
            icon="pi pi-check"
          />
        </div>
        <p id="preview-description" class="muted">
          Até {{ previewLimit }} linhas nesta prévia. Todas as
          {{ store.working.rows.length }} linhas permanecem em memória.
        </p>
        <DataTable
          :key="`${store.selectedSheet}-${store.working.headerRow}`"
          :value="previewRows"
          paginator
          :rows="10"
          :rows-per-page-options="[10, 25, 50]"
          scrollable
          scroll-height="430px"
          striped-rows
          size="small"
          data-key="line"
          table-style="min-width: 36rem"
          aria-describedby="preview-description"
          paginator-template="PrevPageLink CurrentPageReport NextPageLink RowsPerPageDropdown"
          current-page-report-template="{first}–{last} de {totalRecords}"
        >
          <Column field="line" header="Linha" frozen style="width: 5rem" />
          <Column
            v-for="column in store.working.columns"
            :key="column.id"
            :header="column.label"
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <span class="cell-text">{{ data.cells[column.index] }}</span>
            </template>
          </Column>
          <template #empty>
            Nenhuma linha de dados nesta aba. Revise a seleção do cabeçalho.
          </template>
        </DataTable>
      </div>
      <aside class="diagnostics" aria-labelledby="diagnostics-heading">
        <div class="panel-heading">
          <h2 id="diagnostics-heading">Diagnóstico</h2>
          <i class="pi pi-search" aria-hidden="true" />
        </div>
        <div class="diagnostic-counts" aria-live="polite">
          <Tag :value="`${counts.error} erros`" severity="danger" />
          <Tag :value="`${counts.warning} avisos`" severity="warn" />
          <Tag :value="`${counts.suggestion} sugestões`" severity="info" />
        </div>
        <Message
          v-if="!store.issues.length"
          severity="success"
          :closable="false"
        >
          Nenhum problema identificado nas verificações desta etapa.
        </Message>
        <p class="muted">
          Os avisos não exigem correção. As sugestões serão aplicadas somente
          por escolha sua.
        </p>
        <ul class="issue-list">
          <li
            v-for="issue in store.issues"
            :key="`${issue.code}-${issue.column}`"
          >
            <Tag
              :value="severityLabels[issue.severity]"
              :severity="severityMap[issue.severity]"
            />
            <strong>{{ issue.message }}</strong>
            <span v-if="issue.row || issue.column" class="issue-location">
              {{ issue.row ? `Linha ${issue.row}` : ''
              }}{{ issue.row && issue.column ? ' · ' : ''
              }}{{ issue.column ? `Coluna ${issue.column}` : ''
              }}{{ issue.count > 1 ? ` · ${issue.count} ocorrências` : '' }}
            </span>
            <p>{{ issue.suggestion }}</p>
          </li>
        </ul>
      </aside>
    </div>
    <div class="step-actions">
      <Message severity="info" :closable="false">
        A configuração usa a cópia de trabalho exibida acima. Você poderá voltar
        e revisar os dados durante esta sessão.
      </Message>
      <Button
        label="Configurar relatório"
        icon="pi pi-arrow-right"
        icon-pos="right"
        :disabled="store.isBusy"
        @click="emit('next')"
      />
    </div>
  </section>
</template>
