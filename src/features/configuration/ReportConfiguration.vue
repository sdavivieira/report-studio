<script setup lang="ts">
import { computed, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import ColorPicker from 'primevue/colorpicker'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ColumnConfiguration from './ColumnConfiguration.vue'
import ReportPreview from './ReportPreview.vue'
import { useWorkbookStore } from '../../stores/workbookStore'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'
import { availablePageWidth } from '../../domain/report/ReportConfiguration'
import { pageSizeFor } from '../../domain/report/ReportLayout'
import { findReportElement } from '../../domain/report/ReportTemplate'
import type {
  PageOrientation,
  ReportColors,
  TextAlignment,
} from '../../domain/report/ReportConfiguration'

const emit = defineEmits<{ back: []; next: [] }>()
const workbookStore = useWorkbookStore()
const reportStore = useReportConfigurationStore()
const configuration = computed(() => reportStore.configuration)
const usedWidth = computed(
  () =>
    configuration.value?.columns
      .filter((column) => column.visible)
      .reduce((total, column) => total + column.widthMm, 0) ?? 0,
)
const availableWidth = computed(() =>
  configuration.value ? availablePageWidth(configuration.value) : 0,
)
const columnsAreCompressed = computed(
  () => usedWidth.value > availableWidth.value,
)
const detectedFieldCount = computed(
  () =>
    reportStore.elements.filter((element) => element.type === 'dataField')
      .length,
)
const detectedTotalizerCount = computed(
  () =>
    reportStore.elements.filter(
      (element) =>
        element.type === 'dataField' && element.dataField?.semanticRole,
    ).length,
)
const reconstructedTableCount = computed(
  () =>
    reportStore.elements.filter(
      (element) =>
        element.type === 'dataTable' &&
        element.dataTable?.reconstructionConfidence !== undefined,
    ).length,
)
const reconstructedTextCount = computed(
  () =>
    reportStore.elements.filter((element) => element.id.startsWith('pdf-text-'))
      .length,
)
const reconstructedShapeCount = computed(
  () =>
    reportStore.elements.filter((element) =>
      element.id.startsWith('pdf-shape-'),
    ).length,
)

const orientationOptions: {
  label: string
  value: PageOrientation
}[] = [
  { label: 'Retrato', value: 'portrait' },
  { label: 'Paisagem', value: 'landscape' },
]
const alignmentOptions: { label: string; value: TextAlignment }[] = [
  { label: 'Esquerda', value: 'left' },
  { label: 'Centro', value: 'center' },
  { label: 'Direita', value: 'right' },
]
const colorFields: readonly { key: keyof ReportColors; label: string }[] = [
  { key: 'background', label: 'Cor do fundo' },
  { key: 'title', label: 'Cor do título' },
  { key: 'subtitle', label: 'Cor do subtítulo' },
  { key: 'tableHeader', label: 'Cor do cabeçalho da tabela' },
  { key: 'tableHeaderText', label: 'Cor do texto do cabeçalho' },
  { key: 'cell', label: 'Cor das células' },
  { key: 'cellText', label: 'Cor do texto das células' },
  { key: 'border', label: 'Cor das bordas' },
]

watch(
  () => workbookStore.working,
  (workingData) => {
    if (workingData) reportStore.initialize(workingData)
  },
  { immediate: true },
)

watch(
  () => configuration.value?.subtitle,
  (value, previous) => {
    if (!previous && value && configuration.value) {
      const element = findReportElement(reportStore.elements, 'subtitle')
      const pageSize = pageSizeFor(configuration.value)
      reportStore.updateElement(
        'subtitle',
        {
          visible: true,
          ...(element && element.size.height === 0
            ? {
                size: {
                  ...element.size,
                  height:
                    (configuration.value.subtitleFontSize * 1.25) /
                    pageSize.height,
                },
              }
            : {}),
        },
        false,
      )
    }
  },
)
watch(
  () => configuration.value?.footerText,
  (value, previous) => {
    if (!previous && value)
      reportStore.updateElement('footer', { visible: true }, false)
  },
)
watch(
  () => configuration.value?.showDate,
  (visible) => {
    if (visible !== undefined)
      reportStore.updateElement('date', { visible }, false)
  },
)
watch(
  () => configuration.value?.showPageNumbers,
  (visible) => {
    if (visible !== undefined)
      reportStore.updateElement('pageNumber', { visible }, false)
  },
)
watch(
  () =>
    [
      configuration.value?.colors.title,
      configuration.value?.titleFontSize,
      configuration.value?.titleAlignment,
    ] as const,
  ([color, fontSize, alignment]) => {
    if (color && fontSize && alignment)
      reportStore.updateElement(
        'title',
        { style: { color, fontSize, alignment } },
        false,
      )
  },
)
watch(
  () =>
    [
      configuration.value?.colors.subtitle,
      configuration.value?.subtitleFontSize,
      configuration.value?.titleAlignment,
    ] as const,
  ([color, fontSize, alignment]) => {
    if (color && fontSize && alignment)
      reportStore.updateElement(
        'subtitle',
        { style: { color, fontSize, alignment } },
        false,
      )
  },
)
watch(
  () =>
    [
      configuration.value?.colors.subtitle,
      configuration.value?.bodyFontSize,
    ] as const,
  ([color, fontSize]) => {
    if (!color || !fontSize) return
    for (const type of ['date', 'footer', 'pageNumber'] as const)
      reportStore.updateElement(
        type,
        {
          style: {
            color,
            fontSize,
            alignment: type === 'footer' ? 'left' : 'right',
          },
        },
        false,
      )
  },
)

function updateColor(key: keyof ReportColors, value: string | undefined) {
  if (!configuration.value || !value) return
  configuration.value.colors[key] = `#${value.replace(/^#/, '')}`
}
</script>

<template>
  <section
    v-if="workbookStore.working && configuration"
    aria-labelledby="configuration-heading"
  >
    <div class="section-heading">
      <div>
        <div class="eyebrow">DÊ FORMA AO RELATÓRIO</div>
        <h1 id="configuration-heading">Conteúdo claro, escolhas explícitas.</h1>
        <p class="lead">
          Defina o texto, a página e as colunas. A prévia responde às mudanças e
          os dados da planilha continuam preservados.
        </p>
      </div>
      <Button
        label="Voltar à revisão"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        @click="emit('back')"
      />
    </div>

    <Message
      v-if="reportStore.pdfTemplate"
      severity="success"
      :closable="false"
      class="pdf-template-notice"
    >
      O PDF “{{ reportStore.pdfTemplate.name }}” foi reconstruído em elementos
      editáveis.
      <template v-if="reconstructedTableCount">
        Reconstruímos {{ reconstructedTableCount }} tabela(s) e relacionamos
      </template>
      <template v-else>Foram relacionados</template>
      {{ detectedFieldCount }} campo(s) avulsos da planilha, incluindo
      {{ detectedTotalizerCount }} totalizador(es),
      {{ reconstructedTextCount }} texto(s) e
      {{ reconstructedShapeCount }} forma(s). Você poderá ajustar conteúdo,
      cores, colunas, larguras, posições e relações no editor visual.
    </Message>

    <div class="configuration-layout">
      <div class="configuration-form">
        <section class="configuration-card" aria-labelledby="content-heading">
          <h2 id="content-heading">Textos e identificação</h2>
          <div class="form-grid">
            <div class="field full-field">
              <label for="report-title">Título</label>
              <InputText
                id="report-title"
                v-model="configuration.title"
                maxlength="120"
              />
            </div>
            <div class="field full-field">
              <label for="report-subtitle">Subtítulo</label>
              <Textarea
                id="report-subtitle"
                v-model="configuration.subtitle"
                maxlength="240"
                auto-resize
                rows="2"
              />
            </div>
            <div class="field full-field">
              <label for="report-footer">Texto do rodapé</label>
              <InputText
                id="report-footer"
                v-model="configuration.footerText"
                maxlength="160"
              />
            </div>
          </div>
          <div class="inline-options">
            <div class="check-field">
              <Checkbox
                v-model="configuration.showDate"
                input-id="show-date"
                binary
              />
              <label for="show-date">Mostrar data</label>
            </div>
            <div class="check-field">
              <Checkbox
                v-model="configuration.showTime"
                input-id="show-time"
                binary
                :disabled="!configuration.showDate"
              />
              <label for="show-time">Mostrar hora</label>
            </div>
            <div class="check-field">
              <Checkbox
                v-model="configuration.showPageNumbers"
                input-id="show-pages"
                binary
              />
              <label for="show-pages">Numerar páginas</label>
            </div>
          </div>
        </section>

        <section class="configuration-card" aria-labelledby="page-heading">
          <h2 id="page-heading">Página e tipografia</h2>
          <div class="form-grid">
            <div class="field">
              <label for="orientation">Orientação</label>
              <Select
                v-model="configuration.orientation"
                input-id="orientation"
                :options="orientationOptions"
                option-label="label"
                option-value="value"
              />
            </div>
            <div class="field">
              <label for="margin">Margens (mm)</label>
              <InputNumber
                v-model="configuration.marginMm"
                input-id="margin"
                :min="8"
                :max="40"
                :use-grouping="false"
              />
            </div>
            <div class="field">
              <label for="title-alignment">Alinhamento do título</label>
              <Select
                v-model="configuration.titleAlignment"
                input-id="title-alignment"
                :options="alignmentOptions"
                option-label="label"
                option-value="value"
              />
            </div>
            <div class="field">
              <label for="title-size">Título (pt)</label>
              <InputNumber
                v-model="configuration.titleFontSize"
                input-id="title-size"
                :min="12"
                :max="48"
                :use-grouping="false"
              />
            </div>
            <div class="field">
              <label for="subtitle-size">Subtítulo (pt)</label>
              <InputNumber
                v-model="configuration.subtitleFontSize"
                input-id="subtitle-size"
                :min="8"
                :max="24"
                :use-grouping="false"
              />
            </div>
            <div class="field">
              <label for="body-size">Tabela (pt)</label>
              <InputNumber
                v-model="configuration.bodyFontSize"
                input-id="body-size"
                :min="6"
                :max="18"
                :use-grouping="false"
              />
            </div>
            <div class="field">
              <label for="row-height">Altura da linha (mm)</label>
              <InputNumber
                v-model="configuration.rowHeightMm"
                input-id="row-height"
                :min="4"
                :max="20"
                :use-grouping="false"
              />
            </div>
            <div class="field">
              <label for="cell-padding">Espaçamento da célula (mm)</label>
              <InputNumber
                v-model="configuration.cellPaddingMm"
                input-id="cell-padding"
                :min="1"
                :max="10"
                :use-grouping="false"
              />
            </div>
          </div>
        </section>

        <section class="configuration-card" aria-labelledby="colors-heading">
          <h2 id="colors-heading">Cores</h2>
          <div class="color-grid">
            <div
              v-for="field in colorFields"
              :key="field.key"
              class="color-field"
            >
              <label :for="`color-${field.key}`">{{ field.label }}</label>
              <ColorPicker
                :input-id="`color-${field.key}`"
                :model-value="configuration.colors[field.key].slice(1)"
                format="hex"
                @update:model-value="updateColor(field.key, $event)"
              />
              <code>{{ configuration.colors[field.key] }}</code>
            </div>
          </div>
        </section>

        <ColumnConfiguration
          :columns="configuration.columns"
          @update-column="reportStore.updateColumn"
          @move-column="reportStore.moveColumn"
        />

        <div class="width-summary" aria-live="polite">
          <span>
            Largura definida:
            <strong>{{ usedWidth }} mm</strong>
            de {{ availableWidth }} mm
          </span>
          <span>
            {{ configuration.columns.filter((item) => item.visible).length }}
            colunas visíveis
          </span>
        </div>
        <Message v-if="columnsAreCompressed" severity="info" :closable="false">
          Todas as colunas serão mantidas. As larguras serão ajustadas
          proporcionalmente à página e o texto quebrará dentro de cada célula.
        </Message>
        <Message
          v-for="error in reportStore.validationErrors"
          :key="error"
          severity="error"
          :closable="false"
        >
          {{ error }}
        </Message>
        <Message
          v-if="reportStore.isValid"
          severity="success"
          :closable="false"
        >
          Configuração válida e mantida somente nesta sessão.
        </Message>
        <div class="step-actions">
          <Button
            label="Voltar à revisão"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            @click="emit('back')"
          />
          <Button
            label="Ajustar layout"
            icon="pi pi-arrow-right"
            icon-pos="right"
            :disabled="!reportStore.isValid"
            @click="emit('next')"
          />
        </div>
      </div>
      <ReportPreview
        :data="workbookStore.working"
        :configuration="configuration"
      />
    </div>
  </section>
</template>
