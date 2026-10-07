<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useWorkbookStore } from '../../stores/workbookStore'
import { defaultCleaningOptions } from '../../domain/workbook/CleaningOptions'
import CleaningPreviewDialog from './CleaningPreviewDialog.vue'
import type { CleaningOptions } from '../../domain/workbook/CleaningOptions'

const store = useWorkbookStore()
const toast = useToast()
const options = ref(defaultCleaningOptions())
const expanded = ref(false)
const showPreview = ref(false)
const simpleOptions = [
  { key: 'trimSpaces', label: 'Aparar espaços nas extremidades' },
  { key: 'collapseSpaces', label: 'Normalizar espaços repetidos' },
  { key: 'removeInvisible', label: 'Remover caracteres invisíveis' },
  { key: 'removeEmptyRows', label: 'Remover linhas vazias' },
  { key: 'removeEmptyColumns', label: 'Remover colunas vazias' },
  { key: 'renameDuplicateHeaders', label: 'Renomear cabeçalhos duplicados' },
] as const
const separators = [
  { label: 'Vírgula (,)', value: ',' },
  { label: 'Ponto (.)', value: '.' },
]
const dateFormats = [
  { label: 'Dia/mês/ano (31/12/2026)', value: 'dmy' },
  { label: 'Ano-mês-dia (2026-12-31)', value: 'ymd' },
]
const columnOptions = computed(
  () =>
    store.working?.columns.map((column) => ({
      label: `${column.label} · coluna ${(column.sourceColumnIndex ?? column.index) + 1}`,
      value: column.id,
    })) ?? [],
)

function setOptions(patch: Partial<CleaningOptions>) {
  if (store.isBusy) return
  options.value = { ...options.value, ...patch }
  store.clearCleaningPreview()
}
async function preview() {
  // Copy the small option object so no Vue proxy crosses the Worker boundary.
  if (
    await store.previewCleaning({
      ...options.value,
      numericColumns: [...options.value.numericColumns],
      dateColumns: [...options.value.dateColumns],
    })
  )
    showPreview.value = true
}
function apply() {
  if (store.applyCleaning()) {
    showPreview.value = false
    toast.add({
      severity: 'success',
      summary: 'Limpeza aplicada',
      detail:
        'A cópia de trabalho foi atualizada. O original permanece intacto.',
      life: 4000,
    })
  }
}
</script>

<template>
  <section class="cleaning-panel" aria-labelledby="cleaning-heading">
    <div class="panel-heading">
      <div>
        <h2 id="cleaning-heading">Limpeza opcional</h2>
        <p class="muted">
          Você escolhe o que mudar. Sempre com prévia e uma opção de desfazer.
        </p>
      </div>
      <div class="cleaning-actions">
        <Button
          v-if="store.canUndoCleaning"
          label="Desfazer última limpeza"
          icon="pi pi-undo"
          severity="secondary"
          outlined
          :disabled="store.isBusy"
          @click="store.undoCleaning"
        />
        <Button
          :label="expanded ? 'Recolher opções' : 'Escolher limpezas'"
          :icon="expanded ? 'pi pi-chevron-up' : 'pi pi-sliders-h'"
          severity="secondary"
          :aria-expanded="expanded"
          aria-controls="cleaning-options"
          :disabled="store.isBusy"
          @click="expanded = !expanded"
        />
      </div>
    </div>
    <div
      v-if="store.appliedCleanings.length"
      class="cleaning-history"
      aria-live="polite"
    >
      <Tag
        :value="`${store.appliedCleanings.length} limpeza(s) aplicada(s)`"
        severity="success"
      />
      <ol>
        <li v-for="(summary, index) in store.appliedCleanings" :key="index">
          {{ summary.operations.join(' · ') }} —
          {{ summary.changedCells }} células alteradas,
          {{ summary.removedRows }} linhas e
          {{ summary.removedColumns }} colunas removidas.
        </li>
      </ol>
    </div>
    <div v-show="expanded" id="cleaning-options">
      <fieldset :disabled="store.isBusy" class="cleaning-fieldset">
        <legend>Texto e estrutura</legend>
        <div class="cleaning-checkboxes">
          <div
            v-for="option in simpleOptions"
            :key="option.key"
            class="check-field"
          >
            <Checkbox
              :input-id="option.key"
              binary
              :model-value="options[option.key]"
              @update:model-value="setOptions({ [option.key]: $event })"
            />
            <label :for="option.key">{{ option.label }}</label>
          </div>
        </div>
        <div class="check-field">
          <Checkbox
            input-id="fill-empty"
            binary
            :model-value="options.fillEmpty"
            @update:model-value="setOptions({ fillEmpty: $event })"
          />
          <label for="fill-empty">Preencher células vazias</label>
        </div>
        <div v-if="options.fillEmpty" class="field">
          <label for="fill-value">Texto de preenchimento</label>
          <InputText
            id="fill-value"
            :model-value="options.fillValue"
            :maxlength="100"
            @update:model-value="setOptions({ fillValue: $event ?? '' })"
          />
          <small>
            Aplicado como texto, após remover linhas e colunas vazias.
          </small>
        </div>
      </fieldset>
      <div class="cleaning-conversions">
        <fieldset :disabled="store.isBusy" class="cleaning-fieldset">
          <legend>Números</legend>
          <div class="check-field">
            <Checkbox
              input-id="normalize-decimals"
              binary
              :model-value="options.normalizeDecimals"
              @update:model-value="setOptions({ normalizeDecimals: $event })"
            />
            <label for="normalize-decimals">Normalizar separador decimal</label>
          </div>
          <div class="check-field">
            <Checkbox
              input-id="convert-numbers"
              binary
              :model-value="options.convertNumbers"
              @update:model-value="setOptions({ convertNumbers: $event })"
            />
            <label for="convert-numbers">Converter textos em números</label>
          </div>
          <template v-if="options.normalizeDecimals || options.convertNumbers">
            <div class="field">
              <label id="numeric-columns-label">Colunas numéricas</label>
              <MultiSelect
                :model-value="options.numericColumns"
                :options="columnOptions"
                option-label="label"
                option-value="value"
                aria-labelledby="numeric-columns-label"
                placeholder="Escolha as colunas"
                @update:model-value="setOptions({ numericColumns: $event })"
              />
            </div>
            <div class="field">
              <label id="source-separator-label">
                Separador decimal de origem
              </label>
              <Select
                :model-value="options.decimalSeparator"
                :options="separators"
                option-label="label"
                option-value="value"
                aria-labelledby="source-separator-label"
                @update:model-value="setOptions({ decimalSeparator: $event })"
              />
            </div>
            <div
              v-if="options.normalizeDecimals && !options.convertNumbers"
              class="field"
            >
              <label id="target-separator-label">Separador decimal final</label>
              <Select
                :model-value="options.targetDecimalSeparator"
                :options="separators"
                option-label="label"
                option-value="value"
                aria-labelledby="target-separator-label"
                @update:model-value="
                  setOptions({ targetDecimalSeparator: $event })
                "
              />
            </div>
            <p class="muted">
              Códigos com zeros à esquerda, separadores de milhar e valores com
              mais de 15 dígitos significativos serão preservados. A conversão
              em número tem prioridade sobre a troca textual de separador.
            </p>
          </template>
        </fieldset>
        <fieldset :disabled="store.isBusy" class="cleaning-fieldset">
          <legend>Datas</legend>
          <div class="check-field">
            <Checkbox
              input-id="normalize-dates"
              binary
              :model-value="options.normalizeDates"
              @update:model-value="setOptions({ normalizeDates: $event })"
            />
            <label for="normalize-dates">Normalizar datas em texto</label>
          </div>
          <template v-if="options.normalizeDates">
            <div class="field">
              <label id="date-columns-label">Colunas de datas</label>
              <MultiSelect
                :model-value="options.dateColumns"
                :options="columnOptions"
                option-label="label"
                option-value="value"
                aria-labelledby="date-columns-label"
                placeholder="Escolha as colunas"
                @update:model-value="setOptions({ dateColumns: $event })"
              />
            </div>
            <div class="field">
              <label id="date-format-label">Formato de origem</label>
              <Select
                :model-value="options.dateFormat"
                :options="dateFormats"
                option-label="label"
                option-value="value"
                aria-labelledby="date-format-label"
                @update:model-value="setOptions({ dateFormat: $event })"
              />
            </div>
            <p class="muted">
              Datas impossíveis ou fora do formato escolhido serão preservadas.
              A data de calendário não muda com o fuso horário.
            </p>
          </template>
        </fieldset>
      </div>
      <Message
        v-if="store.cleaningError"
        severity="error"
        role="alert"
        :closable="false"
      >
        {{ store.cleaningError }}
      </Message>
      <div class="cleaning-footer">
        <p class="muted">
          O tratamento de texto inclui cabeçalhos. Remoções são calculadas antes
          do preenchimento.
        </p>
        <Button
          label="Revisar alterações"
          icon="pi pi-search"
          :loading="store.isPreparing"
          :disabled="store.isImporting"
          @click="preview"
        />
      </div>
      <p v-if="store.isPreparing" role="status">
        Preparando a prévia no seu navegador…
      </p>
    </div>
    <CleaningPreviewDialog
      v-model:visible="showPreview"
      :plan="store.pendingPlan"
      @apply="apply"
      @closed="store.clearCleaningPreview"
    />
  </section>
</template>
