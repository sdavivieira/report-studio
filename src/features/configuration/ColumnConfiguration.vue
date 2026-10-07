<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Button from 'primevue/button'
import type {
  DateFormat,
  NumberFormat,
  ReportColumnConfiguration,
  TextAlignment,
} from '../../domain/report/ReportConfiguration'

const props = defineProps<{
  columns: readonly ReportColumnConfiguration[]
}>()
const emit = defineEmits<{
  updateColumn: [
    sourceId: string,
    patch: Partial<Omit<ReportColumnConfiguration, 'sourceId' | 'order'>>,
  ]
  moveColumn: [sourceId: string, direction: -1 | 1]
}>()

const alignmentOptions: { label: string; value: TextAlignment }[] = [
  { label: 'Esquerda', value: 'left' },
  { label: 'Centro', value: 'center' },
  { label: 'Direita', value: 'right' },
]
const numberFormatOptions: { label: string; value: NumberFormat }[] = [
  { label: 'Automático', value: 'automatic' },
  { label: 'Inteiro', value: 'integer' },
  { label: 'Decimal (2 casas)', value: 'decimal' },
  { label: 'Moeda (BRL)', value: 'currency' },
  { label: 'Percentual', value: 'percentage' },
]
const dateFormatOptions: { label: string; value: DateFormat }[] = [
  { label: 'Automático', value: 'automatic' },
  { label: 'Data curta', value: 'short' },
  { label: 'Data por extenso', value: 'long' },
]

function update(
  sourceId: string,
  patch: Partial<Omit<ReportColumnConfiguration, 'sourceId' | 'order'>>,
) {
  emit('updateColumn', sourceId, patch)
}
</script>

<template>
  <section class="column-configuration" aria-labelledby="column-heading">
    <div class="panel-heading">
      <div>
        <h2 id="column-heading">Colunas do relatório</h2>
        <p class="muted">
          Escolha, ordene e ajuste a largura de cada coluna. Se o total exceder
          a página, as proporções serão preservadas e o texto quebrará dentro
          das células.
        </p>
      </div>
    </div>
    <div class="column-list">
      <article
        v-for="(column, index) in props.columns"
        :key="column.sourceId"
        class="column-card"
      >
        <div class="column-visibility">
          <Checkbox
            :input-id="`visible-${column.sourceId}`"
            :model-value="column.visible"
            binary
            @update:model-value="update(column.sourceId, { visible: $event })"
          />
          <label :for="`visible-${column.sourceId}`">Exibir</label>
        </div>
        <div class="column-order" aria-label="Alterar ordem da coluna">
          <Button
            icon="pi pi-arrow-up"
            :aria-label="`Mover ${column.label} para cima`"
            text
            size="small"
            :disabled="index === 0"
            @click="emit('moveColumn', column.sourceId, -1)"
          />
          <Button
            icon="pi pi-arrow-down"
            :aria-label="`Mover ${column.label} para baixo`"
            text
            size="small"
            :disabled="index === props.columns.length - 1"
            @click="emit('moveColumn', column.sourceId, 1)"
          />
        </div>
        <div class="field column-name">
          <label :for="`label-${column.sourceId}`">Nome exibido</label>
          <InputText
            :id="`label-${column.sourceId}`"
            :model-value="column.label"
            maxlength="80"
            @update:model-value="update(column.sourceId, { label: $event })"
          />
        </div>
        <div class="field compact-field">
          <label :for="`width-${column.sourceId}`">Largura (mm)</label>
          <InputNumber
            :input-id="`width-${column.sourceId}`"
            :model-value="column.widthMm"
            :min="8"
            :max="120"
            :use-grouping="false"
            @update:model-value="
              update(column.sourceId, { widthMm: $event ?? column.widthMm })
            "
          />
        </div>
        <div class="field compact-field">
          <label :for="`alignment-${column.sourceId}`">Alinhamento</label>
          <Select
            :input-id="`alignment-${column.sourceId}`"
            :model-value="column.alignment"
            :options="alignmentOptions"
            option-label="label"
            option-value="value"
            @update:model-value="update(column.sourceId, { alignment: $event })"
          />
        </div>
        <div class="field compact-field">
          <label :for="`number-${column.sourceId}`">Números</label>
          <Select
            :input-id="`number-${column.sourceId}`"
            :model-value="column.numberFormat"
            :options="numberFormatOptions"
            option-label="label"
            option-value="value"
            @update:model-value="
              update(column.sourceId, { numberFormat: $event })
            "
          />
        </div>
        <div class="field compact-field">
          <label :for="`date-${column.sourceId}`">Datas</label>
          <Select
            :input-id="`date-${column.sourceId}`"
            :model-value="column.dateFormat"
            :options="dateFormatOptions"
            option-label="label"
            option-value="value"
            @update:model-value="
              update(column.sourceId, { dateFormat: $event })
            "
          />
        </div>
      </article>
    </div>
  </section>
</template>
