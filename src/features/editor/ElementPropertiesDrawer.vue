<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import type { WorksheetData } from '../../domain/workbook/Workbook'
import type { TextAlignment } from '../../domain/report/ReportConfiguration'
import { pageSizeFor } from '../../domain/report/ReportLayout'
import {
  elementMeasurementMillimeters,
  setElementMeasurementMillimeters,
  type ElementMeasurement,
} from '../../domain/report/ReportElementLayout'
import {
  findReportElementById,
  reportElementLabel,
  type FormulaOperator,
  type SummaryOperation,
} from '../../domain/report/ReportTemplate'
import {
  SUMMARY_OPERATION_LABELS,
  summaryOperationsForColumn,
} from '../../domain/report/ReportSummary'
import { useReportConfigurationStore } from '../../stores/reportConfigurationStore'

const props = defineProps<{
  selectedId: string
  data: WorksheetData
}>()
const visible = defineModel<boolean>('visible', { required: true })
const reportStore = useReportConfigurationStore()
const optionalTypes = [
  'subtitle',
  'date',
  'image',
  'footer',
  'pageNumber',
  'customText',
  'summary',
  'formula',
  'chart',
  'dataTable',
  'dataField',
  'shape',
]
const alignmentOptions: { label: string; value: TextAlignment }[] = [
  { label: 'Esquerda', value: 'left' },
  { label: 'Centro', value: 'center' },
  { label: 'Direita', value: 'right' },
]

const selected = computed(() =>
  findReportElementById(reportStore.elements, props.selectedId),
)
const linkedChildCount = computed(() => {
  if (!selected.value) return 0
  const descendants = new Set<string>()
  let frontier = [selected.value.id]
  while (frontier.length) {
    const parents = new Set(frontier)
    frontier = reportStore.elements
      .filter(
        (element) =>
          element.parentId &&
          parents.has(element.parentId) &&
          !descendants.has(element.id),
      )
      .map((element) => {
        descendants.add(element.id)
        return element.id
      })
  }
  return descendants.size
})
const isOptional = computed(() =>
  selected.value ? optionalTypes.includes(selected.value.type) : false,
)
const pageSize = computed(() =>
  reportStore.configuration
    ? pageSizeFor(reportStore.configuration)
    : { width: 1, height: 1 },
)
const columnOptions = computed(() =>
  props.data.columns.map((column) => ({
    label: column.label,
    value: column.id,
  })),
)
const operationOptions = computed(() => {
  const sourceId = selected.value?.summary?.sourceId
  if (!sourceId) return []
  return summaryOperationsForColumn(props.data, sourceId).map((value) => ({
    label: SUMMARY_OPERATION_LABELS[value],
    value,
  }))
})
const numericColumnOptions = computed(() =>
  props.data.columns
    .filter((column) =>
      props.data.rows.some((row) => typeof row[column.index] === 'number'),
    )
    .map((column) => ({ label: column.label, value: column.id })),
)
const formulaOperatorOptions: { label: string; value: FormulaOperator }[] = [
  { label: 'Somar', value: 'add' },
  { label: 'Subtrair', value: 'subtract' },
  { label: 'Multiplicar', value: 'multiply' },
  { label: 'Dividir', value: 'divide' },
  { label: 'Percentual da primeira sobre a segunda', value: 'percentage' },
]
const formulaAggregationOptions = [
  { label: 'Somar resultados', value: 'sum' },
  { label: 'Média dos resultados', value: 'average' },
  { label: 'Menor resultado', value: 'minimum' },
  { label: 'Maior resultado', value: 'maximum' },
]
const chartTypeOptions = [
  { label: 'Barras', value: 'bar' },
  { label: 'Pizza', value: 'pie' },
]
const chartAggregationOptions = [
  { label: 'Soma', value: 'sum' },
  { label: 'Média', value: 'average' },
  { label: 'Contagem', value: 'count' },
]
const sortDirectionOptions = [
  { label: 'Ordem original da planilha', value: 'original' },
  { label: 'Maior para menor', value: 'descending' },
  { label: 'Menor para maior', value: 'ascending' },
]

const reconstructedColumnWidths = computed(() => {
  const definition = selected.value?.dataTable
  if (!definition) return []
  const count = definition.sourceIds.length
  const raw = Array.from({ length: count }, (_, index) =>
    Math.max(1, definition.columnWidths?.[index] ?? 100 / Math.max(1, count)),
  )
  const total = raw.reduce((sum, width) => sum + width, 0)
  return raw.map((width) => (width / Math.max(1, total)) * 100)
})

function millimeters(property: ElementMeasurement): number {
  return selected.value
    ? elementMeasurementMillimeters(selected.value, pageSize.value, property)
    : 0
}

function updateMillimeters(property: ElementMeasurement, value: number | null) {
  if (!selected.value || value === null) return
  const updated = setElementMeasurementMillimeters(
    selected.value,
    pageSize.value,
    property,
    value,
  )
  reportStore.updateElement(selected.value.id, {
    position: updated.position,
    size: updated.size,
  })
}

function updateStyle(
  key: 'color' | 'backgroundColor' | 'fontSize' | 'alignment' | 'bold',
  value: string | number | boolean | undefined,
) {
  const element = selected.value
  const configuration = reportStore.configuration
  if (
    !element ||
    !configuration ||
    (value === undefined && key !== 'backgroundColor')
  )
    return
  reportStore.updateElement(element.id, { style: { [key]: value } })
  if (element.type === 'title') {
    if (key === 'color') configuration.colors.title = String(value)
    if (key === 'fontSize') configuration.titleFontSize = Number(value)
    if (key === 'alignment')
      configuration.titleAlignment = value as TextAlignment
  } else if (element.type === 'subtitle') {
    if (key === 'color') configuration.colors.subtitle = String(value)
    if (key === 'fontSize') configuration.subtitleFontSize = Number(value)
  } else if (['date', 'footer', 'pageNumber'].includes(element.type)) {
    if (key === 'color') configuration.colors.subtitle = String(value)
    if (key === 'fontSize') configuration.bodyFontSize = Number(value)
  }
}

function removeSelected() {
  const element = selected.value
  if (!element || !isOptional.value) return
  if (
    [
      'customText',
      'summary',
      'formula',
      'chart',
      'dataTable',
      'dataField',
      'shape',
    ].includes(element.type)
  ) {
    reportStore.removeElement(element.id)
    visible.value = false
    return
  }
  if (element.type === 'image') reportStore.setImage(null)
  else reportStore.updateElement(element.type, { visible: false })
  visible.value = false
}

function updateContent(content: string | undefined) {
  if (!selected.value || content === undefined) return
  reportStore.updateElement(selected.value.id, { content })
}

function updateSummary(
  patch: Partial<{
    label: string
    sourceId: string
    operation: SummaryOperation
  }>,
) {
  const element = selected.value
  if (!element?.summary) return
  const next = { ...element.summary, ...patch }
  if (patch.sourceId) {
    const allowed = summaryOperationsForColumn(props.data, patch.sourceId)
    if (!allowed.includes(next.operation))
      next.operation = allowed[0] ?? 'count'
  }
  reportStore.updateElement(element.id, { summary: next })
}

function updateDefinition(
  key: 'formula' | 'chart' | 'dataTable' | 'dataField' | 'shape',
  patch: Record<string, unknown>,
) {
  const element = selected.value
  const current = element?.[key]
  if (!element || !current) return
  reportStore.updateElement(element.id, { [key]: { ...current, ...patch } })
}

function updateDataTableColumns(sourceIds: string[]) {
  const definition = selected.value?.dataTable
  if (!definition || !sourceIds.length) return
  updateDefinition('dataTable', {
    sourceIds,
    columnWidths: sourceIds.map(() => 100 / sourceIds.length),
    sortSourceId: sourceIds.includes(definition.sortSourceId)
      ? definition.sortSourceId
      : sourceIds[0],
  })
}

function updateDataTableColumnWidth(index: number, value: number | null) {
  const definition = selected.value?.dataTable
  if (!definition || value === null) return
  const current = [...reconstructedColumnWidths.value]
  if (current.length < 2) return
  const minimumWidth = 5
  const maximumWidth = 100 - minimumWidth * (current.length - 1)
  const target = Math.max(minimumWidth, Math.min(maximumWidth, value))
  const remaining = 100 - target
  const otherWidth = remaining / (current.length - 1)
  const next = current.map((_, candidateIndex) =>
    candidateIndex === index ? target : otherWidth,
  )
  updateDefinition('dataTable', { columnWidths: next })
}

function columnLabel(sourceId: string): string {
  return (
    props.data.columns.find((column) => column.id === sourceId)?.label ??
    sourceId
  )
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    :header="selected ? reportElementLabel(selected) : 'Propriedades'"
    class="property-drawer"
  >
    <div v-if="selected" class="drawer-fields">
      <Message v-if="linkedChildCount" severity="info" :closable="false">
        Este bloco contém {{ linkedChildCount }} elemento(s). Ao mover ou
        redimensionar o bloco, o conteúdo acompanha a alteração.
      </Message>
      <Message
        v-else-if="selected.parentId"
        severity="secondary"
        :closable="false"
      >
        Este elemento pertence a um bloco reconstruído. Ele ainda pode ser
        ajustado individualmente.
      </Message>
      <div v-if="isOptional" class="check-field">
        <ToggleSwitch
          :model-value="selected.visible"
          input-id="element-visible"
          @update:model-value="
            reportStore.updateElement(selected.id, { visible: $event })
          "
        />
        <label for="element-visible">Mostrar no relatório</label>
      </div>
      <div class="property-grid">
        <div class="field">
          <label for="element-page">Página</label>
          <InputNumber
            input-id="element-page"
            :model-value="(selected.pageIndex ?? 0) + 1"
            :min="1"
            :max="reportStore.configuration?.pageCount ?? 1"
            :disabled="selected.repeatOnEveryPage"
            @update:model-value="
              $event !== null &&
              reportStore.updateElement(selected.id, {
                pageIndex: $event - 1,
              })
            "
          />
        </div>
        <div class="check-field">
          <ToggleSwitch
            :model-value="Boolean(selected.repeatOnEveryPage)"
            input-id="element-repeat"
            @update:model-value="
              reportStore.updateElement(selected.id, {
                repeatOnEveryPage: $event,
              })
            "
          />
          <label for="element-repeat">Repetir em todas as páginas</label>
        </div>
      </div>
      <div v-if="selected.type === 'customText'" class="field">
        <label for="custom-text-content">Texto</label>
        <Textarea
          id="custom-text-content"
          :model-value="selected.content"
          rows="4"
          maxlength="1000"
          auto-resize
          @update:model-value="updateContent"
        />
      </div>
      <template v-if="selected.type === 'dataField' && selected.dataField">
        <Message severity="info" :closable="false">
          <template v-if="selected.dataField.semanticRole">
            Totalizador “{{ selected.dataField.label }}” reconhecido no PDF.
          </template>
          {{
            selected.dataField.matchReason === 'manual'
              ? 'Campo relacionado manualmente.'
              : selected.dataField.matchReason === 'numeric-value'
                ? 'Associação automática por valor numérico.'
                : 'Associação automática por texto exato.'
          }}
          <template v-if="selected.dataField.matchConfidence !== undefined">
            Confiança:
            {{ Math.round(selected.dataField.matchConfidence * 100) }}%.
          </template>
        </Message>
        <div v-if="selected.dataField.semanticRole" class="field">
          <label for="data-field-label">Nome do totalizador</label>
          <InputText
            id="data-field-label"
            :model-value="selected.dataField.label"
            maxlength="120"
            @update:model-value="
              updateDefinition('dataField', { label: $event })
            "
          />
        </div>
        <div class="field">
          <label for="data-field-column">Coluna da planilha</label>
          <Select
            input-id="data-field-column"
            :model-value="selected.dataField.sourceId"
            :options="columnOptions"
            option-label="label"
            option-value="value"
            @update:model-value="
              updateDefinition('dataField', {
                sourceId: $event,
                matchReason: 'manual',
                matchConfidence: 1,
              })
            "
          />
        </div>
        <div class="field">
          <label for="data-field-row">Linha de dados</label>
          <InputNumber
            input-id="data-field-row"
            :model-value="selected.dataField.rowIndex + 1"
            :min="1"
            :max="data.rows.length"
            :use-grouping="false"
            @update:model-value="
              $event !== null &&
              updateDefinition('dataField', { rowIndex: $event - 1 })
            "
          />
        </div>
        <div class="property-grid">
          <div class="field">
            <label for="data-field-prefix">Prefixo</label>
            <InputText
              id="data-field-prefix"
              :model-value="selected.dataField.prefix"
              maxlength="24"
              @update:model-value="
                updateDefinition('dataField', { prefix: $event })
              "
            />
          </div>
          <div class="field">
            <label for="data-field-suffix">Sufixo</label>
            <InputText
              id="data-field-suffix"
              :model-value="selected.dataField.suffix"
              maxlength="24"
              @update:model-value="
                updateDefinition('dataField', { suffix: $event })
              "
            />
          </div>
        </div>
      </template>
      <template v-if="selected.type === 'summary' && selected.summary">
        <div class="field">
          <label for="summary-label">Rótulo</label>
          <InputText
            id="summary-label"
            :model-value="selected.summary.label"
            maxlength="120"
            @update:model-value="updateSummary({ label: $event })"
          />
        </div>
        <div class="field">
          <label for="summary-column">Coluna</label>
          <Select
            input-id="summary-column"
            :model-value="selected.summary.sourceId"
            :options="columnOptions"
            option-label="label"
            option-value="value"
            @update:model-value="updateSummary({ sourceId: $event })"
          />
        </div>
        <div class="field">
          <label for="summary-operation">Cálculo</label>
          <Select
            input-id="summary-operation"
            :model-value="selected.summary.operation"
            :options="operationOptions"
            option-label="label"
            option-value="value"
            @update:model-value="updateSummary({ operation: $event })"
          />
        </div>
      </template>
      <template v-if="selected.type === 'formula' && selected.formula">
        <div class="field">
          <label for="formula-label">Rótulo</label>
          <InputText
            id="formula-label"
            :model-value="selected.formula.label"
            maxlength="120"
            @update:model-value="updateDefinition('formula', { label: $event })"
          />
        </div>
        <div class="property-grid">
          <div class="field">
            <label for="formula-left">Primeira coluna</label>
            <Select
              input-id="formula-left"
              :model-value="selected.formula.leftSourceId"
              :options="numericColumnOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('formula', { leftSourceId: $event })
              "
            />
          </div>
          <div class="field">
            <label for="formula-right">Segunda coluna</label>
            <Select
              input-id="formula-right"
              :model-value="selected.formula.rightSourceId"
              :options="numericColumnOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('formula', { rightSourceId: $event })
              "
            />
          </div>
        </div>
        <div class="property-grid">
          <div class="field">
            <label for="formula-operator">Operação</label>
            <Select
              input-id="formula-operator"
              :model-value="selected.formula.operator"
              :options="formulaOperatorOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('formula', { operator: $event })
              "
            />
          </div>
          <div class="field">
            <label for="formula-aggregation">Resultado</label>
            <Select
              input-id="formula-aggregation"
              :model-value="selected.formula.aggregation"
              :options="formulaAggregationOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('formula', { aggregation: $event })
              "
            />
          </div>
        </div>
      </template>
      <template v-if="selected.type === 'chart' && selected.chart">
        <div class="field">
          <label for="chart-title">Título do gráfico</label>
          <InputText
            id="chart-title"
            :model-value="selected.chart.title"
            maxlength="120"
            @update:model-value="updateDefinition('chart', { title: $event })"
          />
        </div>
        <div class="property-grid">
          <div class="field">
            <label for="chart-type">Tipo</label>
            <Select
              input-id="chart-type"
              :model-value="selected.chart.chartType"
              :options="chartTypeOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('chart', { chartType: $event })
              "
            />
          </div>
          <div class="field">
            <label for="chart-aggregation">Cálculo</label>
            <Select
              input-id="chart-aggregation"
              :model-value="selected.chart.aggregation"
              :options="chartAggregationOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('chart', { aggregation: $event })
              "
            />
          </div>
        </div>
        <div class="property-grid">
          <div class="field">
            <label for="chart-category">Categoria</label>
            <Select
              input-id="chart-category"
              :model-value="selected.chart.categorySourceId"
              :options="columnOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('chart', { categorySourceId: $event })
              "
            />
          </div>
          <div class="field">
            <label for="chart-value">Valor</label>
            <Select
              input-id="chart-value"
              :model-value="selected.chart.valueSourceId"
              :options="numericColumnOptions"
              option-label="label"
              option-value="value"
              :disabled="selected.chart.aggregation === 'count'"
              @update:model-value="
                updateDefinition('chart', { valueSourceId: $event })
              "
            />
          </div>
        </div>
        <div class="field">
          <label for="chart-limit">Quantidade de categorias</label>
          <InputNumber
            input-id="chart-limit"
            :model-value="selected.chart.maxItems"
            :min="2"
            :max="20"
            @update:model-value="
              $event !== null && updateDefinition('chart', { maxItems: $event })
            "
          />
        </div>
      </template>
      <template v-if="selected.type === 'dataTable' && selected.dataTable">
        <Message
          v-if="selected.dataTable.reconstructionConfidence !== undefined"
          severity="info"
          :closable="false"
        >
          Tabela reconstruída do PDF com
          {{ Math.round(selected.dataTable.reconstructionConfidence * 100) }}%
          de confiança. Confira as colunas e ajuste as larguras abaixo.
        </Message>
        <div class="field">
          <label for="data-table-title">Título da tabela</label>
          <InputText
            id="data-table-title"
            :model-value="selected.dataTable.title"
            maxlength="120"
            @update:model-value="
              updateDefinition('dataTable', { title: $event })
            "
          />
        </div>
        <div class="check-field">
          <ToggleSwitch
            :model-value="selected.dataTable.showTitle !== false"
            input-id="data-table-show-title"
            @update:model-value="
              updateDefinition('dataTable', { showTitle: $event })
            "
          />
          <label for="data-table-show-title">Mostrar título da tabela</label>
        </div>
        <div class="property-grid">
          <div class="field">
            <label for="data-table-header-background">Fundo do cabeçalho</label>
            <ColorPicker
              input-id="data-table-header-background"
              :model-value="
                (selected.dataTable.headerBackgroundColor ?? '#eef2ef').slice(1)
              "
              format="hex"
              @update:model-value="
                $event &&
                updateDefinition('dataTable', {
                  headerBackgroundColor: `#${$event}`,
                })
              "
            />
          </div>
          <div class="field">
            <label for="data-table-header-text">Texto do cabeçalho</label>
            <ColorPicker
              input-id="data-table-header-text"
              :model-value="
                (selected.dataTable.headerTextColor ?? '#253c36').slice(1)
              "
              format="hex"
              @update:model-value="
                $event &&
                updateDefinition('dataTable', {
                  headerTextColor: `#${$event}`,
                })
              "
            />
          </div>
          <div class="field">
            <label for="data-table-cell-background">Fundo das células</label>
            <ColorPicker
              input-id="data-table-cell-background"
              :model-value="
                (selected.dataTable.cellBackgroundColor ?? '#ffffff').slice(1)
              "
              format="hex"
              @update:model-value="
                $event &&
                updateDefinition('dataTable', {
                  cellBackgroundColor: `#${$event}`,
                })
              "
            />
          </div>
          <div class="field">
            <label for="data-table-cell-text">Texto das células</label>
            <ColorPicker
              input-id="data-table-cell-text"
              :model-value="
                (selected.dataTable.cellTextColor ?? '#253c36').slice(1)
              "
              format="hex"
              @update:model-value="
                $event &&
                updateDefinition('dataTable', {
                  cellTextColor: `#${$event}`,
                })
              "
            />
          </div>
          <div class="field">
            <label for="data-table-border">Bordas da tabela</label>
            <ColorPicker
              input-id="data-table-border"
              :model-value="
                (selected.dataTable.borderColor ?? '#dedfd7').slice(1)
              "
              format="hex"
              @update:model-value="
                $event &&
                updateDefinition('dataTable', {
                  borderColor: `#${$event}`,
                })
              "
            />
          </div>
        </div>
        <div class="field">
          <label for="data-table-columns">Colunas</label>
          <MultiSelect
            input-id="data-table-columns"
            :model-value="selected.dataTable.sourceIds"
            :options="columnOptions"
            option-label="label"
            option-value="value"
            display="chip"
            @update:model-value="updateDataTableColumns($event)"
          />
        </div>
        <div
          v-if="selected.dataTable.sourceIds.length > 1"
          class="drawer-fields reconstructed-column-widths"
        >
          <strong>Largura das colunas</strong>
          <div
            v-for="(sourceId, index) in selected.dataTable.sourceIds"
            :key="sourceId"
            class="field"
          >
            <label :for="`reconstructed-column-${index}`">
              {{ columnLabel(sourceId) }}
            </label>
            <InputNumber
              :input-id="`reconstructed-column-${index}`"
              :model-value="Math.round(reconstructedColumnWidths[index] ?? 0)"
              :min="5"
              :max="
                Math.max(5, 100 - 5 * (selected.dataTable.sourceIds.length - 1))
              "
              suffix="%"
              :use-grouping="false"
              @update:model-value="updateDataTableColumnWidth(index, $event)"
            />
          </div>
          <small>
            A largura total permanece em 100%. Textos maiores quebram linha
            automaticamente dentro da célula.
          </small>
        </div>
        <div class="property-grid">
          <div class="field">
            <label for="data-table-sort">Ordenar por</label>
            <Select
              input-id="data-table-sort"
              :model-value="selected.dataTable.sortSourceId"
              :options="columnOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('dataTable', { sortSourceId: $event })
              "
            />
          </div>
          <div class="field">
            <label for="data-table-direction">Ordem</label>
            <Select
              input-id="data-table-direction"
              :model-value="selected.dataTable.sortDirection"
              :options="sortDirectionOptions"
              option-label="label"
              option-value="value"
              @update:model-value="
                updateDefinition('dataTable', { sortDirection: $event })
              "
            />
          </div>
        </div>
        <div class="field">
          <label for="data-table-limit">Máximo de linhas</label>
          <InputNumber
            input-id="data-table-limit"
            :model-value="selected.dataTable.limit"
            :min="1"
            :max="100"
            @update:model-value="
              $event !== null &&
              updateDefinition('dataTable', { limit: $event })
            "
          />
        </div>
        <div class="check-field">
          <ToggleSwitch
            :model-value="selected.dataTable.showRank"
            input-id="data-table-rank"
            @update:model-value="
              updateDefinition('dataTable', { showRank: $event })
            "
          />
          <label for="data-table-rank">Mostrar posição do ranking</label>
        </div>
        <div class="check-field">
          <ToggleSwitch
            :model-value="selected.dataTable.showTotals"
            input-id="data-table-totals"
            @update:model-value="
              updateDefinition('dataTable', { showTotals: $event })
            "
          />
          <label for="data-table-totals">Mostrar linha de totais</label>
        </div>
      </template>
      <div class="property-grid">
        <div
          v-for="property in ['width', 'height'] as const"
          :key="property"
          class="field"
        >
          <label :for="`element-${property}`">
            {{
              {
                x: 'X (mm)',
                y: 'Y (mm)',
                width: 'Largura (mm)',
                height: 'Altura (mm)',
              }[property]
            }}
          </label>
          <InputNumber
            :input-id="`element-${property}`"
            :model-value="millimeters(property)"
            :min="property === 'width' || property === 'height' ? 2 : undefined"
            :min-fraction-digits="1"
            :max-fraction-digits="1"
            @update:model-value="updateMillimeters(property, $event)"
          />
        </div>
      </div>
      <details class="fine-positioning">
        <summary>Ajuste fino de posição (X e Y)</summary>
        <p>
          Use estes campos somente quando precisar alinhar o bloco com uma
          medida exata.
        </p>
        <div class="property-grid">
          <div
            v-for="property in ['x', 'y'] as const"
            :key="property"
            class="field"
          >
            <label :for="`element-${property}`">
              {{ property === 'x' ? 'X (mm)' : 'Y (mm)' }}
            </label>
            <InputNumber
              :input-id="`element-${property}`"
              :model-value="millimeters(property)"
              :min-fraction-digits="1"
              :max-fraction-digits="1"
              @update:model-value="updateMillimeters(property, $event)"
            />
          </div>
        </div>
      </details>
      <div v-if="selected.type === 'image'" class="check-field">
        <ToggleSwitch
          :model-value="selected.keepAspectRatio"
          input-id="keep-ratio"
          @update:model-value="
            reportStore.updateElement('image', { keepAspectRatio: $event })
          "
        />
        <label for="keep-ratio">Manter proporção</label>
      </div>
      <template
        v-if="
          selected.type !== 'table' &&
          selected.type !== 'image' &&
          selected.type !== 'shape'
        "
      >
        <div class="field">
          <label for="element-color">Cor</label>
          <ColorPicker
            input-id="element-color"
            :model-value="selected.style.color?.slice(1)"
            format="hex"
            @update:model-value="$event && updateStyle('color', `#${$event}`)"
          />
        </div>
        <div class="field">
          <label for="element-font-size">Fonte (pt)</label>
          <InputNumber
            input-id="element-font-size"
            :model-value="selected.style.fontSize"
            :min="6"
            :max="48"
            @update:model-value="updateStyle('fontSize', $event ?? undefined)"
          />
        </div>
        <div class="field">
          <label for="element-alignment">Alinhamento</label>
          <Select
            input-id="element-alignment"
            :model-value="selected.style.alignment"
            :options="alignmentOptions"
            option-label="label"
            option-value="value"
            @update:model-value="updateStyle('alignment', $event)"
          />
        </div>
        <template
          v-if="
            ['customText', 'summary', 'formula', 'dataField'].includes(
              selected.type,
            )
          "
        >
          <div class="check-field">
            <ToggleSwitch
              :model-value="Boolean(selected.style.bold)"
              input-id="element-bold"
              @update:model-value="updateStyle('bold', $event)"
            />
            <label for="element-bold">Texto em negrito</label>
          </div>
          <div class="check-field">
            <ToggleSwitch
              :model-value="Boolean(selected.style.backgroundColor)"
              input-id="element-background-enabled"
              @update:model-value="
                updateStyle('backgroundColor', $event ? '#eeeeee' : undefined)
              "
            />
            <label for="element-background-enabled">Usar cor de fundo</label>
          </div>
          <div v-if="selected.style.backgroundColor" class="field">
            <label for="element-background-color">Cor de fundo</label>
            <ColorPicker
              input-id="element-background-color"
              :model-value="selected.style.backgroundColor.slice(1)"
              format="hex"
              @update:model-value="
                $event && updateStyle('backgroundColor', `#${$event}`)
              "
            />
          </div>
        </template>
      </template>
      <template v-if="selected.type === 'shape'">
        <div class="field">
          <label for="shape-border-width">Espessura da borda ou linha</label>
          <InputNumber
            input-id="shape-border-width"
            :model-value="selected.shape?.borderWidth ?? 0.7"
            :min="0"
            :max="20"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            suffix=" pt"
            @update:model-value="
              $event !== null &&
              updateDefinition('shape', { borderWidth: $event })
            "
          />
        </div>
        <div class="field">
          <label for="shape-color">Cor da borda ou linha</label>
          <ColorPicker
            input-id="shape-color"
            :model-value="selected.style.color?.slice(1)"
            format="hex"
            @update:model-value="$event && updateStyle('color', `#${$event}`)"
          />
        </div>
        <div class="check-field">
          <ToggleSwitch
            :model-value="Boolean(selected.style.backgroundColor)"
            input-id="shape-background-enabled"
            @update:model-value="
              updateStyle('backgroundColor', $event ? '#eeeeee' : undefined)
            "
          />
          <label for="shape-background-enabled">Usar preenchimento</label>
        </div>
        <div v-if="selected.style.backgroundColor" class="field">
          <label for="shape-background-color">Cor de preenchimento</label>
          <ColorPicker
            input-id="shape-background-color"
            :model-value="selected.style.backgroundColor.slice(1)"
            format="hex"
            @update:model-value="
              $event && updateStyle('backgroundColor', `#${$event}`)
            "
          />
        </div>
      </template>
      <Button
        label="Restaurar todas as posições"
        icon="pi pi-replay"
        severity="secondary"
        outlined
        @click="reportStore.resetLayout(data)"
      />
      <Button
        v-if="isOptional"
        label="Remover do layout"
        icon="pi pi-trash"
        severity="danger"
        text
        @click="removeSelected"
      />
    </div>
  </Drawer>
</template>
