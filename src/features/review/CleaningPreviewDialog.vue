<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { hasCleaningChanges } from '../../domain/workbook/CleaningOptions'
import type { CleaningPlan } from '../../domain/workbook/CleaningOptions'
import { formatCell } from '../../domain/workbook/Workbook'
import type { CellValue } from '../../domain/workbook/Workbook'

const props = defineProps<{ plan: CleaningPlan | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ apply: []; closed: [] }>()
const hasChanges = computed(
  () => props.plan !== null && hasCleaningChanges(props.plan.summary),
)

function describeCell(value: CellValue): string {
  if (value === null) return 'vazio'
  if (typeof value === 'string') return `Texto: ${JSON.stringify(value)}`
  if (typeof value === 'number') return `Número: ${value}`
  if (value instanceof Date) return `Data: ${formatCell(value)}`
  return formatCell(value)
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Revisar limpeza"
    :style="{ width: '850px', maxWidth: '95vw' }"
    @hide="emit('closed')"
  >
    <template v-if="plan">
      <div class="cleaning-summary" aria-live="polite">
        <Tag :value="`${plan.summary.changedCells} células alteradas`" />
        <Tag
          :value="`${plan.summary.removedRows} linhas removidas`"
          severity="secondary"
        />
        <Tag
          :value="`${plan.summary.removedColumns} colunas removidas`"
          severity="secondary"
        />
      </div>
      <p>
        {{ plan.summary.changedCells + plan.summary.removedCells }}
        posições de células afetadas, incluindo remoções e cabeçalhos. Nenhuma
        alteração foi aplicada ainda.
      </p>
      <Message v-if="!hasChanges" severity="info" :closable="false">
        Nenhuma alteração para as opções escolhidas.
      </Message>
      <Message
        v-if="plan.summary.convertedNumbers || plan.summary.convertedDates"
        severity="warn"
        :closable="false"
      >
        Ao aplicar, você confirma a mudança de tipo de
        {{ plan.summary.convertedNumbers }} números e
        {{ plan.summary.convertedDates }} datas. Confira a prévia abaixo.
      </Message>
      <Message
        v-if="plan.summary.preservedNumbers || plan.summary.preservedDates"
        severity="info"
        :closable="false"
      >
        Preservados sem conversão: {{ plan.summary.preservedNumbers }} valores
        numéricos e {{ plan.summary.preservedDates }} datas. Eles não atendem ao
        formato escolhido ou à conversão segura.
      </Message>
      <p v-if="plan.removedRowNumbers.length">
        Linhas removidas (numeração original, até 20):
        {{ plan.removedRowNumbers.join(', ') }}.
      </p>
      <p v-if="plan.removedColumnNames.length">
        Colunas removidas:
        {{ plan.removedColumnNames.join(', ') }}.
      </p>
      <p class="muted">
        Amostra de até 50 alterações. Aspas tornam os espaços visíveis; linhas e
        colunas correspondem ao arquivo original.
      </p>
      <DataTable
        :value="plan.samples"
        scrollable
        scroll-height="300px"
        size="small"
        class="cleaning-preview"
      >
        <Column field="row" header="Linha" />
        <Column field="column" header="Coluna" />
        <Column header="Antes">
          <template #body="{ data }">
            <span class="cell-text">{{ describeCell(data.before) }}</span>
          </template>
        </Column>
        <Column header="Depois">
          <template #body="{ data }">
            <span class="cell-text">{{ describeCell(data.after) }}</span>
          </template>
        </Column>
        <template #empty>
          Nenhuma edição de valor. Verifique as remoções no resumo.
        </template>
      </DataTable>
    </template>
    <template #footer>
      <Button
        label="Cancelar"
        severity="secondary"
        text
        @click="visible = false"
      />
      <Button
        label="Aplicar limpeza"
        icon="pi pi-check"
        :disabled="!hasChanges"
        @click="emit('apply')"
      />
    </template>
  </Dialog>
</template>
