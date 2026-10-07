import { describe, expect, it } from 'vitest'
import { prepareCleaning } from './prepareCleaning'
import {
  defaultCleaningOptions,
  hasCleaningChanges,
} from '../../domain/workbook/CleaningOptions'
import { selectWorksheet } from '../../domain/workbook/selectWorksheet'
import { analyzeWorksheet } from '../../domain/workbook/analyzeWorksheet'
import type { CellValue } from '../../domain/workbook/Workbook'
import type { CleaningOptions } from '../../domain/workbook/CleaningOptions'

const data = (rows: CellValue[][]) =>
  selectWorksheet({ name: 'Dados', rows }, 1)
const options = (patch: Partial<CleaningOptions>) => ({
  ...defaultCleaningOptions(),
  ...patch,
})

describe('optional cleaning preview', () => {
  it('does nothing until operations are explicitly chosen', () => {
    const source = data([[' Nome '], ['  Ana\u200B  ']])
    const result = prepareCleaning(source, defaultCleaningOptions())
    expect(result.data.rows).toEqual(source.rows)
    expect(hasCleaningChanges(result.summary)).toBe(false)
  })
  it('previews whitespace and invisible character edits once per changed cell without mutating source', () => {
    const source = data([[' Nome '], ['  Ação  cultural\u200B \u2060']])
    const before = structuredClone(source)
    const result = prepareCleaning(
      source,
      options({
        trimSpaces: true,
        collapseSpaces: true,
        removeInvisible: true,
      }),
    )
    expect(result.data.rows).toEqual([['Ação cultural']])
    expect(result.data.columns[0]?.label).toBe('Nome')
    expect(result.summary.changedCells).toBe(2)
    expect(result.samples).toHaveLength(2)
    expect(source).toEqual(before)
  })
  it('removes empty structure before filling, retains original positions and preserves zero and false', () => {
    const source = data([
      ['A', 'Vazia', 'B'],
      [null, null, null],
      [0, null, false],
      ['\u200B', null, ''],
      ['x', null, null],
    ])
    const result = prepareCleaning(
      source,
      options({
        removeInvisible: true,
        removeEmptyRows: true,
        removeEmptyColumns: true,
        fillEmpty: true,
        fillValue: '—',
      }),
    )
    expect(result.data.rows).toEqual([
      [0, false],
      ['x', '—'],
    ])
    expect(result.data.sourceRowNumbers).toEqual([3, 5])
    expect(
      result.data.columns.map((c) => [c.id, c.index, c.sourceColumnIndex]),
    ).toEqual([
      ['column-0', 0, 0],
      ['column-2', 1, 2],
    ])
    expect(result.summary).toMatchObject({
      removedRows: 2,
      removedColumns: 1,
      removedCells: 9,
      changedCells: 1,
    })
    expect(result.samples[0]).toMatchObject({ row: 5, column: 3 })
    expect(result.removedRowNumbers).toEqual([2, 4])
  })
  it('keeps source locations in diagnosis after removals and subsequent cleaning', () => {
    const source = data([
      ['A', 'Vazia', 'B'],
      [null, null, null],
      ['1', null, { error: '#DIV/0!' }],
    ])
    const first = prepareCleaning(
      source,
      options({ removeEmptyRows: true, removeEmptyColumns: true }),
    )
    const second = prepareCleaning(
      first.data,
      options({ convertNumbers: true, numericColumns: ['column-0'] }),
    )
    expect(second.samples[0]).toMatchObject({ row: 3, column: 1, after: 1 })
    expect(
      analyzeWorksheet(second.data).find(
        (issue) => issue.code === 'CELL_ERROR',
      ),
    ).toMatchObject({ row: 3, column: 3 })
  })
  it('renames duplicate headers without creating collisions with existing suffixes', () => {
    const result = prepareCleaning(
      data([
        ['A', 'a', 'A (2)', 'A'],
        [1, 2, 3, 4],
      ]),
      options({ renameDuplicateHeaders: true }),
    )
    expect(result.data.columns.map((c) => c.label)).toEqual([
      'A',
      'a (3)',
      'A (2)',
      'A (4)',
    ])
    expect(
      analyzeWorksheet(result.data).some(
        (issue) => issue.code === 'DUPLICATE_HEADER',
      ),
    ).toBe(false)
  })
  it('normalizes decimals only in chosen columns, and only in unambiguous strings', () => {
    const source = data([
      ['Valor', 'Código'],
      ['12,50', '12,50'],
      ['001,50', 'x'],
      ['1.000,50', 'x'],
    ])
    const result = prepareCleaning(
      source,
      options({ normalizeDecimals: true, numericColumns: ['column-0'] }),
    )
    expect(result.data.rows).toEqual([
      ['12.50', '12,50'],
      ['001,50', 'x'],
      ['1.000,50', 'x'],
    ])
    expect(result.summary).toMatchObject({
      preservedNumbers: 2,
      convertedNumbers: 0,
      changedCells: 1,
    })
  })
  it('converts safe text numbers and dates without touching unselected columns or invalid values', () => {
    const source = data([
      ['Valor', 'Data', 'Código'],
      ['12,50', '29/02/2024', '001'],
      ['001', '31/02/2024', '0001'],
      ['1234567890123456', '2024-03-01', '02'],
    ])
    const result = prepareCleaning(
      source,
      options({
        convertNumbers: true,
        numericColumns: ['column-0'],
        normalizeDates: true,
        dateColumns: ['column-1'],
      }),
    )
    expect(result.data.rows[0]).toEqual([
      12.5,
      new Date('2024-02-29T00:00:00Z'),
      '001',
    ])
    expect(result.data.rows[1]).toEqual(['001', '31/02/2024', '0001'])
    expect(result.summary).toMatchObject({
      convertedNumbers: 1,
      convertedDates: 1,
      preservedNumbers: 2,
      preservedDates: 2,
    })
  })
  it('processes all 25,000 rows while limiting preview samples', () => {
    const source = data([
      ['Nome'],
      ...Array.from({ length: 25_000 }, (_, index) => [` Item ${index} `]),
    ])
    const result = prepareCleaning(source, options({ trimSpaces: true }))
    expect(result.summary.changedCells).toBe(25_000)
    expect(result.samples).toHaveLength(50)
    expect(result.data.rows.at(-1)).toEqual(['Item 24999'])
    expect(source.rows.at(-1)).toEqual([' Item 24999 '])
  })
})
