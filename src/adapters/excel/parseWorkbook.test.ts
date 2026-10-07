import { describe, expect, it } from 'vitest'
import { utils } from 'xlsx'
import {
  exampleWorkbook,
  workbookBytes,
} from '../../../tests/fixtures/workbooks'
import { DEFAULT_IMPORT_LIMITS } from '../../domain/workbook/Workbook'
import { parseWorkbook } from './parseWorkbook'
import { selectWorksheet } from '../../domain/workbook/selectWorksheet'
import { analyzeWorksheet } from '../../domain/workbook/analyzeWorksheet'

describe('Excel parsing', () => {
  it.each(['xlsx', 'xls'] as const)(
    'reads genuine %s with types, accents and all sheets',
    (type) => {
      const bytes = workbookBytes(exampleWorkbook(), type)
      const result = parseWorkbook(
        bytes,
        `exemplo.${type}`,
        bytes.byteLength,
        DEFAULT_IMPORT_LIMITS,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.workbook.sheets.map((s) => s.name)).toEqual([
        'Operações',
        'Resumo',
        'Vazia',
      ])
      expect(result.workbook.sheets[0]?.rows[2]).toEqual([
        ' Ação  cultural ',
        12.5,
        '12,50',
        new Date('2026-09-29T00:00:00Z'),
        true,
        '<img src=x onerror="alert(1)">',
      ])
      expect(result.workbook.sheets[0]?.rows).toHaveLength(6)
      const emptySheet = result.workbook.sheets[2]
      expect(
        emptySheet && analyzeWorksheet(selectWorksheet(emptySheet, 1))[0]?.code,
      ).toBe('EMPTY_SHEET')
    },
  )
  it('preserves errors, cached formulas and uncached formulas without executing them', () => {
    const book = utils.book_new()
    const sheet = utils.aoa_to_sheet([
      ['Erro', 'Fórmula', 'Sem cache'],
      [null, null, null],
    ])
    sheet.A2 = { t: 'e', v: 7 }
    sheet.B2 = { t: 'n', f: '1+2', v: 3 }
    sheet.C2 = { t: 'n', f: '1+5' }
    sheet['!ref'] = 'A1:C2'
    utils.book_append_sheet(book, sheet, 'Teste')
    const result = parseWorkbook(
      workbookBytes(book),
      'teste.xlsx',
      1,
      DEFAULT_IMPORT_LIMITS,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.workbook.sheets[0]?.rows[1]?.[0]).toHaveProperty('error')
      expect(result.workbook.sheets[0]?.rows[1]?.[1]).toBe(3)
      expect(result.workbook.sheets[0]?.rows[1]?.[2]).toEqual({
        error: 'Fórmula sem valor calculado',
      })
    }
  })
  it('reads CSV and TSV files as simple worksheets', () => {
    const csv = new TextEncoder().encode('Produto,Quantidade\nCafé,2')
    const csvResult = parseWorkbook(
      csv.buffer,
      'dados.csv',
      csv.byteLength,
      DEFAULT_IMPORT_LIMITS,
    )
    expect(csvResult.ok).toBe(true)
    if (csvResult.ok)
      expect(csvResult.workbook.sheets[0]?.rows[1]).toEqual(['Café', 2])

    const tsv = new TextEncoder().encode('Produto\tQuantidade\nChá\t3')
    const tsvResult = parseWorkbook(
      tsv.buffer,
      'dados.tsv',
      tsv.byteLength,
      DEFAULT_IMPORT_LIMITS,
    )
    expect(tsvResult.ok).toBe(true)
    if (tsvResult.ok)
      expect(tsvResult.workbook.sheets[0]?.rows[1]).toEqual(['Chá', 3])
  })
  it('rejects text disguised as Excel and corrupt binary data', () => {
    expect(
      parseWorkbook(
        new TextEncoder().encode('name,value\nA,2').buffer,
        'fake.xls',
        1,
        DEFAULT_IMPORT_LIMITS,
      ).ok,
    ).toBe(false)
    expect(
      parseWorkbook(
        new Uint8Array([0x50, 0x4b, 3, 4, 0]).buffer,
        'corrupt.xlsx',
        5,
        DEFAULT_IMPORT_LIMITS,
      ).ok,
    ).toBe(false)
  })
  it.each([
    { maxRows: 3 },
    { maxColumns: 2 },
    { maxSheets: 2 },
    { maxCells: 10 },
    { maxBytes: 10 },
  ])('rejects excess resources instead of silently truncating: %o', (limit) => {
    expect(
      parseWorkbook(workbookBytes(), 'test.xlsx', 1, {
        ...DEFAULT_IMPORT_LIMITS,
        ...limit,
      }),
    ).toMatchObject({ ok: false, code: 'limits' })
  })
})
