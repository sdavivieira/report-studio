<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import FileUpload from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import type { FileUploadSelectEvent } from 'primevue/fileupload'
import { readReportImage } from '../../adapters/images/BrowserImageReader'
import { findReportElement } from '../../domain/report/ReportTemplate'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'

const emit = defineEmits<{ selected: [] }>()
const reportStore = useReportConfigurationStore()
const error = ref('')

async function onImageSelect(event: FileUploadSelectEvent) {
  const file = event.files[0]
  if (!file) return
  error.value = ''
  try {
    const result = await readReportImage(file)
    if (!result.ok) {
      error.value = result.message
      return
    }
    reportStore.setImage(result.image)
    const element = findReportElement(reportStore.elements, 'image')
    if (element) {
      const ratio = result.image.width / result.image.height
      reportStore.updateElement('image', {
        size: { width: element.size.width, height: element.size.width / ratio },
        visible: true,
      })
    }
    emit('selected')
  } catch {
    error.value = 'Não foi possível ler a imagem selecionada.'
  }
}

function removeImage() {
  reportStore.setImage(null)
  error.value = ''
}

function updateAlternativeText(value: string | undefined) {
  if (!reportStore.image || value === undefined) return
  reportStore.image.alternativeText = value
}
</script>

<template>
  <section aria-labelledby="image-heading">
    <h2 id="image-heading">Imagem ou logotipo</h2>
    <FileUpload
      mode="basic"
      accept="image/png,image/jpeg"
      :max-file-size="5242880"
      choose-label="Selecionar imagem"
      custom-upload
      @select="onImageSelect"
    />
    <p class="muted">PNG ou JPEG · até 5 MB · máximo de 8.000 px por lado</p>
    <template v-if="reportStore.image">
      <img
        class="image-thumbnail"
        :src="reportStore.image.dataUrl"
        :alt="reportStore.image.alternativeText"
      />
      <div class="field">
        <label for="image-alt">Texto alternativo</label>
        <InputText
          id="image-alt"
          :model-value="reportStore.image.alternativeText"
          maxlength="300"
          @update:model-value="updateAlternativeText"
        />
      </div>
      <Button
        label="Remover imagem"
        icon="pi pi-trash"
        severity="danger"
        text
        @click="removeImage"
      />
    </template>
    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>
  </section>
</template>
