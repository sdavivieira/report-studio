import { describe, expect, it } from 'vitest'
import type { WorksheetData } from '../workbook/Workbook'
import { createDefaultReportConfiguration } from './ReportConfiguration'
import {
  calculateChartSeries,
  calculateDataTable,
  calculateFormula,
} from './ReportDataElements'

const data: WorksheetData = {
  name: 'Vendas',
  headerRow: 0,
  columns: [
    { id: 'seller', index: 0, label: 'Vendedor', headerValue: 'Vendedor' },
    { id: 'revenue', index: 1, label: 'Receita', headerValue: 'Receita' },
    { id: 'cost', index: 2, label: 'Custo', headerValue: 'Custo' },
  ],
  rows: [
    ['Ana', 100, 60],
    ['Bia', 250, 180],
    ['Ana', 50, 25],
  ],
}

describe('elementos de dados do relatório', () => {
  it('agrupa e ordena séries de gráficos', () => {
    expect(
      calculateChartSeries(
        {
          title: 'Receita por vendedor',
          chartType: 'bar',
          categorySourceId: 'seller',
          valueSourceId: 'revenue',
          aggregation: 'sum',
          maxItems: 5,
        },
        data,
      ),
    ).toEqual([
      { label: 'Bia', value: 250 },
      { label: 'Ana', value: 150 },
    ])
  })

  it('calcula fórmulas linha a linha e agrega o resultado', () => {
    expect(
      calculateFormula(
        {
          label: 'Lucro',
          leftSourceId: 'revenue',
          rightSourceId: 'cost',
          operator: 'subtract',
          aggregation: 'sum',
        },
        data,
      ),
    ).toBe('135')
    expect(
      calculateFormula(
        {
          label: 'Margem',
          leftSourceId: 'cost',
          rightSourceId: 'revenue',
          operator: 'percentage',
          aggregation: 'average',
        },
        data,
      ),
    ).toBe('60,6666666667')
  })

  it('gera ranking limitado e uma linha de totais', () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    const result = calculateDataTable(
      {
        title: 'Ranking',
        sourceIds: ['seller', 'revenue'],
        sortSourceId: 'revenue',
        sortDirection: 'descending',
        limit: 2,
        showRank: true,
        showTotals: true,
      },
      data,
      configuration,
    )

    expect(result.rows).toEqual([
      ['1', 'Bia', '250'],
      ['2', 'Ana', '100'],
    ])
    expect(result.totals).toEqual(['Total', '', '350'])
  })

  it('preserva a ordem da planilha em tabelas reconstruídas', () => {
    const configuration = createDefaultReportConfiguration(data.columns)
    const result = calculateDataTable(
      {
        title: 'Tabela reconstruída',
        sourceIds: ['seller', 'revenue'],
        columnWidths: [70, 30],
        sortSourceId: 'seller',
        sortDirection: 'original',
        limit: 2,
        showRank: false,
        showTotals: false,
        showTitle: false,
      },
      data,
      configuration,
    )

    expect(result.rows).toEqual([
      ['Ana', '100'],
      ['Bia', '250'],
    ])
    expect(result.columnWeights).toEqual([0.7, 0.3])
  })
})
