import { describe, expect, it } from 'vitest'
import { selectWorksheet } from './selectWorksheet'
import { analyzeWorksheet } from './analyzeWorksheet'
import { formatCell } from './Workbook'
import type { Worksheet } from './Workbook'

describe('worksheet selection and diagnosis', () => {
  it('does not share mutable dates or error cells with original data', () => {
    const date = new Date('2026-09-29T00:00:00Z')
    const error = { error: '#DIV/0!' }
    const original: Worksheet = { name: 'Data', rows: [[date], [date, error]] }
    const working = selectWorksheet(original, 1)
    expect(working.columns[0]?.headerValue).not.toBe(date)
    expect(working.rows[0]?.[0]).not.toBe(date)
    expect(working.rows[0]?.[1]).not.toBe(error)
    const workingDate = working.rows[0]?.[0]
    if (workingDate instanceof Date) workingDate.setUTCFullYear(2000)
    expect(date.getUTCFullYear()).toBe(2026)
  })
  it('recognizes a formatted range with only empty values as an empty sheet', () => {
    expect(
      analyzeWorksheet(
        selectWorksheet(
          {
            name: 'Vazia',
            rows: [
              ['', ' '],
              [null, ''],
              ['', null],
            ],
          },
          1,
        ),
      )[0]?.code,
    ).toBe('EMPTY_SHEET')
  })
  const source: Worksheet = {
    name: 'Dados',
    rows: [
      ['Título'],
      ['Nome', 'Nome', '', 'Data'],
      [' Café  ', 1, null, '2026-01-01'],
      ['001', '2,50', null, '02/01/2026'],
      [null, null, null, null],
      [{ error: '#DIV/0!' }, '2.50', null, new Date('2026-01-03T00:00:00Z')],
    ],
  }
  it('selects the header, preserves source and creates an independent working row', () => {
    const before = structuredClone(source)
    const result = selectWorksheet(source, 2)
    expect(result.columns.map((col) => col.label)).toEqual([
      'Nome',
      'Nome',
      'Coluna 3',
      'Data',
    ])
    expect(result.rows).toHaveLength(4)
    expect(result.rows[0]).not.toBe(source.rows[2])
    expect(source).toEqual(before)
  })
  it('identifies actionable issues with original row locations', () => {
    const issues = analyzeWorksheet(selectWorksheet(source, 2))
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_HEADER',
        'EMPTY_HEADER',
        'EMPTY_COLUMN',
        'EXTRA_SPACES',
        'NUMBER_AS_TEXT',
        'EMPTY_ROW',
        'MIXED_TYPES',
        'MIXED_DECIMALS',
        'MIXED_DATES',
        'CELL_ERROR',
      ]),
    )
    expect(issues.find((i) => i.code === 'EMPTY_ROW')).toMatchObject({
      row: 5,
      autoFixable: true,
    })
    expect(
      issues.find((i) => i.code === 'NUMBER_AS_TEXT' && i.column === 2),
    ).toMatchObject({ count: 2, row: 4 })
  })
  it('handles empty sheets, header-only data and invalid header positions', () => {
    expect(
      analyzeWorksheet(selectWorksheet({ name: 'Vazia', rows: [] }, 1))[0]
        ?.code,
    ).toBe('EMPTY_SHEET')
    expect(
      analyzeWorksheet(selectWorksheet({ name: 'Dados', rows: [['A']] }, 1))[0]
        ?.code,
    ).toBe('NO_DATA')
    expect(selectWorksheet(source, -2).headerRow).toBe(1)
    expect(selectWorksheet(source, 999).headerRow).toBe(6)
  })
  it('detects values beyond the header without calling internal blank cells malformed rows', () => {
    const data = selectWorksheet(
      { name: 'A', rows: [['A'], [1, null, 3], [2, null, null]] },
      1,
    )
    expect(
      analyzeWorksheet(data).filter((i) => i.code === 'EXTRA_CELLS'),
    ).toMatchObject([{ count: 1, row: 2 }])
  })
  it('warns about large worksheets and aggregates repeated occurrences', () => {
    const rows = Array.from({ length: 10_002 }, () =>
      Array.from({ length: 31 }, () => ' a '),
    )
    const issues = analyzeWorksheet(
      selectWorksheet({ name: 'Grande', rows }, 1),
    )
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['MANY_ROWS', 'MANY_COLUMNS']),
    )
    expect(issues.find((i) => i.code === 'EXTRA_SPACES')?.count).toBe(10_001)
  })
  it('formats supported cell types without HTML interpretation', () => {
    expect(
      [
        null,
        undefined,
        true,
        false,
        0,
        'Ação',
        { error: '#ERRO' },
        new Date('2026-09-29T00:00:00Z'),
      ].map(formatCell),
    ).toEqual(['', '', 'Sim', 'Não', '0', 'Ação', '#ERRO', '29/09/2026'])
  })
})
