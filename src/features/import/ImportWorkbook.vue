<script setup lang="ts">
import { ref } from 'vue'
import FileUpload from 'primevue/fileupload'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { FileUploadSelectEvent } from 'primevue/fileupload'
import { useWorkbookStore } from '../../stores/workbookStore'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'
import { readPdfTemplate } from '../../adapters/pdf/BrowserPdfTemplateReader'

const emit = defineEmits<{ imported: [] }>()
const store = useWorkbookStore()
const reportStore = useReportConfigurationStore()
const toast = useToast()
const confirm = useConfirm()
const uploadKey = ref(0)
const pdfInput = ref<HTMLInputElement | null>(null)
const pdfBusy = ref(false)
const pdfError = ref('')

async function readFile(file: File) {
  const success = await store.importFile(file)
  uploadKey.value++
  if (success) {
    toast.add({
      severity: 'success',
      summary: 'Planilha importada',
      detail: 'Seus dados estão prontos para revisão.',
      life: 3500,
    })
    emit('imported')
  }
}

function onSelect(event: FileUploadSelectEvent) {
  const file: File | undefined = event.files[0]
  if (!file) return
  if (store.original) {
    confirm.require({
      header: 'Substituir a planilha?',
      message:
        'A planilha atual será substituída apenas se a nova importação funcionar. O arquivo original permanece intacto.',
      acceptLabel: 'Substituir',
      rejectLabel: 'Cancelar',
      accept: () => {
        void readFile(file)
      },
      reject: () => {
        uploadKey.value++
      },
    })
  } else void readFile(file)
}

async function onPdfSelected(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  pdfBusy.value = true
  pdfError.value = ''
  try {
    reportStore.setPdfTemplate(
      await readPdfTemplate(file),
      store.working ?? undefined,
    )
  } catch (error) {
    pdfError.value =
      error instanceof Error ? error.message : 'Não foi possível ler o PDF.'
  } finally {
    pdfBusy.value = false
  }
}
</script>

<template>
  <section class="import-layout" aria-labelledby="import-heading">
    <div class="import-main">
      <div class="eyebrow">SEUS DADOS, UM NOVO FORMATO</div>
      <h1 id="import-heading">
        Toda boa história
        <br />
        começa com os dados.
      </h1>
      <p class="lead">
        Traga sua planilha. Vamos conferir os dados e preparar o primeiro passo
        do seu relatório.
      </p>
      <FileUpload
        :key="uploadKey"
        mode="advanced"
        :multiple="false"
        :show-upload-button="false"
        :show-cancel-button="false"
        :disabled="store.isBusy"
        accept=".xlsx,.xls,.csv,.tsv"
        invalid-file-type-message="Escolha uma planilha .xlsx, .xls, .csv ou .tsv."
        @select="onSelect"
      >
        <template #header="{ chooseCallback }">
          <span class="upload-symbol" aria-hidden="true">
            <i class="pi pi-file-excel" />
          </span>
          <h2>Uma planilha. Muitas possibilidades.</h2>
          <p>Arraste seu arquivo aqui ou selecione no computador.</p>
          <Button
            label="Selecionar planilha"
            icon="pi pi-plus"
            :loading="store.isImporting"
            @click="chooseCallback"
          />
          <span class="file-hint">Excel, CSV ou TSV · Até 20 MB</span>
          <span class="file-hint">
            Até 50 mil linhas por aba e 1 milhão de células por arquivo
          </span>
        </template>
        <template #content="{ messages }">
          <span class="sr-only">
            A seleção do arquivo inicia a leitura local.
          </span>
          <Message
            v-for="message in messages"
            :key="message"
            severity="error"
            :closable="false"
            role="alert"
          >
            {{ message }}
          </Message>
        </template>
      </FileUpload>
      <section class="pdf-template-import" aria-labelledby="pdf-template-title">
        <div>
          <h2 id="pdf-template-title">Já possui um PDF pronto?</h2>
          <p>
            Use-o como base visual. Depois, a planilha será relacionada aos
            textos e valores encontrados no documento.
          </p>
        </div>
        <input
          ref="pdfInput"
          class="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          aria-label="PDF usado como modelo"
          @change="onPdfSelected"
        />
        <Button
          :label="
            reportStore.pdfTemplate
              ? 'Trocar PDF de modelo'
              : 'Selecionar PDF de modelo'
          "
          icon="pi pi-file-pdf"
          severity="secondary"
          outlined
          :loading="pdfBusy"
          @click="pdfInput?.click()"
        />
        <p
          v-if="reportStore.pdfTemplate"
          class="pdf-template-selected"
          role="status"
        >
          <i class="pi pi-check-circle" aria-hidden="true" />
          {{ reportStore.pdfTemplate.name }} ·
          {{ reportStore.pdfTemplate.pages.length }} página(s)
        </p>
        <Message
          v-if="pdfError"
          severity="error"
          :closable="false"
          role="alert"
        >
          {{ pdfError }}
        </Message>
      </section>
      <div v-if="store.isImporting" class="processing" role="status">
        <ProgressBar mode="indeterminate" style="height: 4px" />
        <p>Lendo a planilha no seu navegador…</p>
      </div>
      <Message
        v-if="store.error"
        severity="error"
        :closable="false"
        role="alert"
      >
        {{ store.error }}
      </Message>
      <div class="privacy-note">
        <i class="pi pi-lock" aria-hidden="true" />
        <p>
          <strong>Seus arquivos ficam com você.</strong>
          <br />
          A leitura acontece no navegador. Sem envio de dados, conta ou
          armazenamento em nuvem.
        </p>
      </div>
    </div>
    <aside class="editorial-aside" aria-label="Sobre o Report Studio">
      <div class="paper-preview" aria-hidden="true">
        <div class="paper-topline">
          <span>REPORT / STUDIO</span>
          <span>01</span>
        </div>
        <div class="paper-rule" />
        <p class="paper-kicker">DO EXCEL AO ESSENCIAL</p>
        <h2>
          Clareza em
          <br />
          cada página.
        </h2>
        <p class="paper-description">
          Uma nova perspectiva
          <br />
          para suas informações.
        </p>
        <div class="paper-table">
          <div v-for="n in 6" :key="n">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div class="paper-footer">ORGANIZAR. REVISAR. COMUNICAR.</div>
      </div>
      <div class="aside-caption">
        <span class="caption-line" />
        <p>
          Menos ruído.
          <br />
          <strong>Mais significado.</strong>
        </p>
      </div>
    </aside>
  </section>
</template>
