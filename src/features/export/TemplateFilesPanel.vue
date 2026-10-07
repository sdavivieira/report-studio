<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { useWorkbookStore } from '../../stores/workbookStore'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'
import {
  applyTemplateColumnMapping,
  createReportTemplate,
  parseReportTemplate,
  restoreEmbeddedImage,
  serializeReportTemplate,
} from '../../adapters/templates/ReportTemplateFiles'
import type { ReportTemplate } from '../../domain/report/ReportTemplate'
import { downloadBrowserFile } from '../../adapters/files/BrowserFileDownloader'
import {
  clearDraftTemplate,
  deleteBrowserTemplate,
  listBrowserTemplates,
  readDraftTemplate,
  saveBrowserTemplate,
} from '../../adapters/templates/BrowserTemplateLibrary'

const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024
const workbookStore = useWorkbookStore()
const reportStore = useReportConfigurationStore()
const embedImage = ref(false)
const error = ref('')
const success = ref('')
const remappingVisible = ref(false)
const pendingTemplate = ref<ReportTemplate | null>(null)
const pendingMapping = ref<Record<string, string>>({})
const missingColumnIds = ref<string[]>([])
const templateInput = ref<HTMLInputElement | null>(null)
const libraryEntries = ref([...listBrowserTemplates()])
const selectedLibraryId = ref('')
const draftAvailable = ref(Boolean(readDraftTemplate()))

const columnOptions = computed(() =>
  (workbookStore.working?.columns ?? []).map((column) => ({
    label: column.label,
    value: column.id,
  })),
)
const expectedColumns = computed(() =>
  missingColumnIds.value.map((sourceId) => {
    const column = pendingTemplate.value?.configuration.columns.find(
      (candidate) => candidate.sourceId === sourceId,
    )
    return { sourceId, label: column?.label ?? sourceId }
  }),
)
const mappingComplete = computed(() => {
  const sourceIds =
    pendingTemplate.value?.configuration.columns.map(
      (column) => column.sourceId,
    ) ?? []
  const selected = sourceIds.map((sourceId) => pendingMapping.value[sourceId])
  return selected.every(Boolean) && new Set(selected).size === selected.length
})

function saveTemplate() {
  const configuration = reportStore.configuration
  if (!configuration) return
  const template = createReportTemplate(
    configuration,
    reportStore.elements,
    reportStore.image,
    embedImage.value,
  )
  downloadText(
    serializeReportTemplate(template),
    `${safeName(configuration.title)}.report-template.json`,
  )
  reportStore.markSaved()
  error.value = ''
  success.value = 'Modelo salvo no computador.'
}

async function onTemplateSelected(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  const data = workbookStore.working
  error.value = ''
  success.value = ''
  if (!file || !data) {
    input.value = ''
    return
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    error.value = 'O modelo deve ter no máximo 2 MB.'
    input.value = ''
    return
  }
  if (!file.name.toLowerCase().endsWith('.json')) {
    error.value = 'Selecione um arquivo de modelo JSON.'
    input.value = ''
    return
  }
  if (file.type && !['application/json', 'text/json'].includes(file.type)) {
    error.value = 'O tipo do arquivo não corresponde a um modelo JSON.'
    input.value = ''
    return
  }
  let text: string
  try {
    text = await readTextFile(file)
  } catch {
    error.value = 'Não foi possível ler o arquivo de modelo.'
    input.value = ''
    return
  }
  input.value = ''
  prepareTemplate(text)
}

function prepareTemplate(text: string) {
  const data = workbookStore.working
  if (!data) return
  const result = parseReportTemplate(text, data)
  if (!result.ok) {
    error.value = result.message
    return
  }
  pendingTemplate.value = result.template
  pendingMapping.value = { ...result.automaticMapping }
  missingColumnIds.value = [...result.missingColumns]
  if (result.missingColumns.length) remappingVisible.value = true
  else applyPendingTemplate()
}

function saveToLibrary() {
  const configuration = reportStore.configuration
  if (!configuration) return
  try {
    const entry = saveBrowserTemplate(
      configuration.title,
      createReportTemplate(
        configuration,
        reportStore.elements,
        reportStore.image,
        false,
      ),
    )
    libraryEntries.value = [...listBrowserTemplates()]
    selectedLibraryId.value = entry.id
    success.value = 'Modelo salvo na biblioteca deste navegador.'
    error.value = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Falha ao salvar.'
  }
}

function openLibraryTemplate() {
  const entry = libraryEntries.value.find(
    (candidate) => candidate.id === selectedLibraryId.value,
  )
  if (!entry) return
  prepareTemplate(JSON.stringify(entry.template))
}

function removeLibraryTemplate() {
  if (!selectedLibraryId.value) return
  deleteBrowserTemplate(selectedLibraryId.value)
  selectedLibraryId.value = ''
  libraryEntries.value = [...listBrowserTemplates()]
  success.value = 'Modelo removido da biblioteca local.'
}

function restoreDraft() {
  const draft = readDraftTemplate()
  if (!draft) return
  prepareTemplate(draft)
  success.value = 'Rascunho automático restaurado.'
}

function discardDraft() {
  clearDraftTemplate()
  draftAvailable.value = false
  success.value = 'Rascunho automático removido.'
}

function applyPendingTemplate() {
  const template = pendingTemplate.value
  const data = workbookStore.working
  if (!template || !data) return
  const mapped = applyTemplateColumnMapping(template, pendingMapping.value)
  reportStore.applyTemplate(mapped, data)
  reportStore.setRestoredImage(restoreEmbeddedImage(mapped))
  reportStore.markSaved()
  remappingVisible.value = false
  success.value =
    mapped.image && !mapped.image.embeddedDataUrl
      ? 'Modelo aplicado. Selecione novamente a imagem, pois ela não foi incorporada ao arquivo.'
      : 'Modelo validado e aplicado à planilha atual.'
}

function downloadText(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'application/json' })
  downloadBrowserFile(blob, fileName)
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Resultado de leitura inválido.'))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}

function safeName(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'modelo'
  )
}
</script>

<template>
  <section class="template-panel" aria-labelledby="template-heading">
    <div>
      <h2 id="template-heading">Modelo reutilizável</h2>
      <p class="muted">
        O JSON contém somente configuração, posições e mapeamento de colunas.
        Nenhuma linha da planilha é incluída.
      </p>
    </div>
    <div v-if="reportStore.image" class="check-field">
      <Checkbox v-model="embedImage" input-id="embed-image" binary />
      <label for="embed-image">Incorporar a imagem ao modelo</label>
    </div>
    <div class="template-actions">
      <Button
        label="Salvar modelo"
        icon="pi pi-download"
        severity="secondary"
        outlined
        @click="saveTemplate"
      />
      <input
        ref="templateInput"
        class="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="Arquivo de modelo JSON"
        @change="onTemplateSelected"
      />
      <Button
        label="Abrir modelo"
        icon="pi pi-folder-open"
        severity="secondary"
        outlined
        @click="templateInput?.click()"
      />
      <Button
        label="Salvar na biblioteca"
        icon="pi pi-bookmark"
        severity="secondary"
        outlined
        @click="saveToLibrary"
      />
    </div>
    <div v-if="libraryEntries.length" class="field">
      <label id="template-library-label" for="template-library">
        Biblioteca deste navegador
      </label>
      <Select
        v-model="selectedLibraryId"
        input-id="template-library"
        aria-labelledby="template-library-label"
        :options="libraryEntries"
        option-label="name"
        option-value="id"
        placeholder="Selecione um modelo salvo"
      />
      <div class="template-actions">
        <Button
          label="Aplicar selecionado"
          icon="pi pi-check"
          size="small"
          :disabled="!selectedLibraryId"
          @click="openLibraryTemplate"
        />
        <Button
          label="Excluir selecionado"
          icon="pi pi-trash"
          size="small"
          severity="secondary"
          outlined
          :disabled="!selectedLibraryId"
          @click="removeLibraryTemplate"
        />
      </div>
    </div>
    <Message v-if="draftAvailable" severity="info" :closable="false">
      Existe um rascunho automático salvo somente neste navegador.
      <div class="template-actions">
        <Button label="Restaurar rascunho" size="small" @click="restoreDraft" />
        <Button
          label="Descartar rascunho"
          size="small"
          severity="secondary"
          text
          @click="discardDraft"
        />
      </div>
    </Message>
    <Message v-if="error" severity="error" :closable="false" role="alert">
      {{ error }}
    </Message>
    <Message v-if="success" severity="success" :closable="false" role="status">
      {{ success }}
    </Message>

    <Dialog
      v-model:visible="remappingVisible"
      modal
      header="Relacionar colunas ausentes"
      :closable="false"
      class="mapping-dialog"
    >
      <p>
        Escolha qual coluna da planilha atual corresponde a cada coluna esperada
        pelo modelo.
      </p>
      <div
        v-for="column in expectedColumns"
        :key="column.sourceId"
        class="field mapping-field"
      >
        <label :for="`mapping-${column.sourceId}`">{{ column.label }}</label>
        <Select
          v-model="pendingMapping[column.sourceId]"
          :input-id="`mapping-${column.sourceId}`"
          :options="columnOptions"
          option-label="label"
          option-value="value"
          placeholder="Selecione uma coluna"
        />
      </div>
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          text
          @click="remappingVisible = false"
        />
        <Button
          label="Aplicar modelo"
          :disabled="!mappingComplete"
          @click="applyPendingTemplate"
        />
      </template>
    </Dialog>
  </section>
</template>
