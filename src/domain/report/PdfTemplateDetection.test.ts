import { describe, expect, it } from 'vitest'
import type { WorksheetData } from '../workbook/Workbook'
import {
  createDetectedDataFields,
  createEditablePdfElements,
  createReconstructedPdfTables,
  dataFieldMatchesOriginal,
  dataFieldValue,
} from './PdfTemplateDetection'

const data: WorksheetData = {
  name: 'Vendas',
  headerRow: 0,
  columns: [
    { id: 'product', index: 0, label: 'Produto', headerValue: 'Produto' },
    { id: 'revenue', index: 1, label: 'Receita', headerValue: 'Receita' },
  ],
  rows: [['Notebook Pro', 95382]],
}

describe('detecção de campos em PDF preenchido', () => {
  it('transforma textos e formas do PDF em elementos editáveis independentes', () => {
    const elements = createEditablePdfElements(
      {
        name: 'modelo-editavel.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        reconstructionMode: 'editable',
        pages: [
          {
            width: 595,
            height: 842,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: [
              {
                text: 'ORÇAMENTO',
                x: 0.1,
                y: 0.08,
                width: 0.35,
                height: 0.04,
                fontSize: 22,
                color: '#123456',
                bold: true,
              },
            ],
            detectedShapes: [
              {
                kind: 'rectangle',
                x: 0.08,
                y: 0.06,
                width: 0.84,
                height: 0.1,
                fillColor: '#eeeeee',
                borderColor: '#654321',
                borderWidth: 2,
              },
            ],
          },
        ],
      },
      data,
    )

    expect(elements).toHaveLength(2)
    expect(elements.find((element) => element.type === 'shape')).toMatchObject({
      position: { x: 0.08, y: 0.06 },
      style: { color: '#654321', backgroundColor: '#eeeeee' },
      shape: { kind: 'rectangle', borderWidth: 2 },
    })
    expect(
      elements.find((element) => element.type === 'customText'),
    ).toMatchObject({
      parentId: 'pdf-shape-0-0',
      content: 'ORÇAMENTO',
      style: { color: '#123456', fontSize: 22, bold: true },
    })
  })

  it('relaciona textos e valores monetários às células da planilha', () => {
    const fields = createDetectedDataFields(
      {
        name: 'modelo.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        pages: [
          {
            width: 595,
            height: 842,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: [
              {
                text: 'Notebook Pro',
                x: 0.1,
                y: 0.2,
                width: 0.2,
                height: 0.02,
                fontSize: 10,
              },
              {
                text: 'R$ 95.382,00',
                x: 0.6,
                y: 0.2,
                width: 0.2,
                height: 0.02,
                fontSize: 10,
              },
            ],
          },
        ],
      },
      data,
    )

    expect(fields).toHaveLength(2)
    expect(fields[0]?.dataField).toMatchObject({
      sourceId: 'product',
      rowIndex: 0,
    })
    expect(fields[1]?.dataField).toMatchObject({
      sourceId: 'revenue',
      rowIndex: 0,
      prefix: 'R$ ',
      decimalSeparator: ',',
      thousandsSeparator: '.',
      fractionDigits: 2,
    })
    expect(dataFieldValue(fields[1]!, data)).toBe('R$ 95.382,00')
    expect(dataFieldMatchesOriginal(fields[1]!, data)).toBe(true)
  })

  it('distingue separador de milhar de casas decimais em valores inteiros', () => {
    const fields = createDetectedDataFields(
      {
        name: 'modelo.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        pages: [
          {
            width: 842,
            height: 595,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: [
              {
                text: 'R$ 95.382',
                x: 0.1,
                y: 0.2,
                width: 0.2,
                height: 0.02,
                fontSize: 10,
              },
            ],
          },
        ],
      },
      data,
    )

    expect(fields[0]?.dataField).toMatchObject({
      thousandsSeparator: '.',
      fractionDigits: 0,
    })
    expect(dataFieldValue(fields[0]!, data)).toBe('R$ 95.382')
  })

  it('relaciona um total calculado à precisão arredondada exibida no PDF', () => {
    const calculatedData: WorksheetData = {
      name: 'Orçamento',
      headerRow: 0,
      columns: [
        { id: 'total', index: 0, label: 'Total', headerValue: 'Total' },
      ],
      rows: [[389.709]],
    }
    const fields = createDetectedDataFields(
      {
        name: 'orcamento.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        pages: [
          {
            width: 595,
            height: 842,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: [
              {
                text: 'R$ 389,71',
                x: 0.7,
                y: 0.6,
                width: 0.15,
                height: 0.02,
                fontSize: 9,
              },
            ],
          },
        ],
      },
      calculatedData,
    )

    expect(fields).toHaveLength(1)
    expect(dataFieldValue(fields[0]!, calculatedData)).toBe('R$ 389,71')
  })

  it('reconhece valores de subtotal como totalizadores nomeados', () => {
    const totalData: WorksheetData = {
      name: 'Orçamento',
      headerRow: 0,
      columns: [
        { id: 'label', index: 0, label: 'Descrição', headerValue: 'Descrição' },
        { id: 'total', index: 1, label: 'Total', headerValue: 'Total' },
      ],
      rows: [['Subtotal', 2279]],
    }
    const fields = createDetectedDataFields(
      {
        name: 'orcamento.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        pages: [
          {
            width: 595,
            height: 842,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: [
              {
                text: 'SUBTOTAL:',
                x: 0.65,
                y: 0.7,
                width: 0.14,
                height: 0.02,
                fontSize: 9,
              },
              {
                text: 'R$ 2.279,00',
                x: 0.82,
                y: 0.7,
                width: 0.14,
                height: 0.02,
                fontSize: 9,
              },
            ],
          },
        ],
      },
      totalData,
    )

    expect(fields).toHaveLength(1)
    expect(
      fields.find((field) => field.dataField?.sourceId === 'total'),
    ).toMatchObject({
      dataField: {
        label: 'SUBTOTAL:',
        semanticRole: 'subtotal',
        sourceId: 'total',
      },
    })
  })

  it('mantém a apresentação percentual do PDF', () => {
    const percentData: WorksheetData = {
      ...data,
      columns: [
        { id: 'margin', index: 0, label: 'Margem', headerValue: 'Margem' },
      ],
      rows: [[0.266]],
    }
    expect(
      dataFieldValue(
        {
          id: 'margin-field',
          type: 'dataField',
          visible: true,
          position: { x: 0, y: 0 },
          size: { width: 0.1, height: 0.03 },
          keepAspectRatio: false,
          style: {},
          dataField: {
            sourceId: 'margin',
            rowIndex: 0,
            prefix: '',
            suffix: '%',
          },
        },
        percentData,
      ),
    ).toBe('26,6%')
  })

  it('reconstrói uma tabela quando reconhece os cabeçalhos da planilha', () => {
    const tables = createReconstructedPdfTables(
      {
        name: 'tabela.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        pages: [
          {
            width: 595,
            height: 842,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: [
              {
                text: 'Produto',
                x: 0.08,
                y: 0.3,
                width: 0.18,
                height: 0.025,
                fontSize: 10,
              },
              {
                text: 'Receita',
                x: 0.62,
                y: 0.3,
                width: 0.16,
                height: 0.025,
                fontSize: 10,
              },
              {
                text: 'Notebook Pro',
                x: 0.08,
                y: 0.35,
                width: 0.25,
                height: 0.02,
                fontSize: 9,
              },
              {
                text: 'R$ 95.382,00',
                x: 0.62,
                y: 0.35,
                width: 0.18,
                height: 0.02,
                fontSize: 9,
              },
            ],
          },
        ],
      },
      data,
    )

    expect(tables).toHaveLength(1)
    expect(tables[0]?.dataTable).toMatchObject({
      sourceIds: ['product', 'revenue'],
      showTitle: false,
      reconstructionConfidence: 1,
    })
    expect(tables[0]?.dataTable?.columnWidths?.[0]).toBeGreaterThan(
      tables[0]?.dataTable?.columnWidths?.[1] ?? 100,
    )
    expect(tables[0]?.size.height).toBeGreaterThanOrEqual(0.12)
  })

  it('relaciona sinônimos de quantidade e limita a tabela às linhas detectadas', () => {
    const budgetData: WorksheetData = {
      name: 'Orçamento',
      headerRow: 0,
      columns: [
        {
          id: 'description',
          index: 0,
          label: 'Descrição',
          headerValue: 'Descrição',
        },
        {
          id: 'quantity',
          index: 1,
          label: 'Quantidade',
          headerValue: 'Quantidade',
        },
        {
          id: 'unit-price',
          index: 2,
          label: 'Preço Unitário',
          headerValue: 'Preço Unitário',
        },
        { id: 'total', index: 3, label: 'Total', headerValue: 'Total' },
      ],
      rows: [
        ['Produto A', 2, 10, 20],
        ['Produto B', 3, 20, 60],
        [null, null, 'Subtotal', 80],
        [null, null, 'Impostos', 14.4],
      ],
    }
    const texts = [
      ['DESCRIÇÃO', 0.08, 0.3, 0.3],
      ['UNIDADES', 0.55, 0.3, 0.12],
      ['PREÇO', 0.72, 0.3, 0.1],
      ['TOTAL', 0.86, 0.3, 0.1],
      ['Produto A', 0.08, 0.35, 0.2],
      ['2', 0.57, 0.35, 0.03],
      ['10', 0.74, 0.35, 0.04],
      ['20', 0.88, 0.35, 0.04],
      ['Produto B', 0.08, 0.4, 0.2],
      ['3', 0.57, 0.4, 0.03],
      ['20', 0.74, 0.4, 0.04],
      ['60', 0.88, 0.4, 0.04],
      ['SUBTOTAL', 0.72, 0.45, 0.1],
      ['80', 0.88, 0.45, 0.04],
    ].map(([text, x, y, width]) => ({
      text: String(text),
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: 0.02,
      fontSize: 9,
    }))

    const tables = createReconstructedPdfTables(
      {
        name: 'orcamento.pdf',
        sourceDataUrl: 'data:application/pdf;base64,AA==',
        pages: [
          {
            width: 595,
            height: 842,
            imageDataUrl: 'data:image/png;base64,AA==',
            detectedTexts: texts,
          },
        ],
      },
      budgetData,
    )

    expect(tables[0]?.dataTable).toMatchObject({
      sourceIds: ['description', 'quantity', 'unit-price', 'total'],
      limit: 2,
    })
  })
})
