import { describe, expect, it } from 'vitest'
import {
  cleanText,
  parseCalendarDate,
  parsePlainNumber,
  sameCell,
} from './normalizeCell'
import { defaultCleaningOptions } from './CleaningOptions'

describe('safe normalizations', () => {
  it('preserves extremely small nonzero values instead of converting them to zero', () => {
    const tinyDecimal = `0.${'0'.repeat(323)}1`
    expect(parsePlainNumber(tinyDecimal, '.')).toBeNull()
    expect(parsePlainNumber(`-${tinyDecimal}`, '.')).toBeNull()
    expect(parsePlainNumber('0.000', '.')).toBe(0)
  })
  it.each([
    '001',
    '1.234,56',
    '1e3',
    ' 12',
    '1234567890123456',
    '1,2,3',
    'Infinity',
    '0x10',
    '12.50',
  ])('preserves ambiguous or unsafe numeric text %s', (value) =>
    expect(parsePlainNumber(value, ',')).toBeNull(),
  )
  it.each([
    ['0', 0],
    ['-12,50', -12.5],
    ['+3', 3],
    ['0,125', 0.125],
  ] as const)('converts %s', (value, number) =>
    expect(parsePlainNumber(value, ',')).toBe(number),
  )
  it('supports dot decimal and strict ISO calendar dates', () => {
    expect(parsePlainNumber('12.50', '.')).toBe(12.5)
    expect(parseCalendarDate('2024-02-29', 'ymd')).toEqual(
      new Date('2024-02-29T00:00:00Z'),
    )
  })
  it.each([
    '31/04/2026',
    '29/02/2025',
    '00/12/2026',
    '12/13/2026',
    '12/01/0099',
    '1/1/2026',
    '2026-01-01',
  ])('preserves invalid or differently formatted date %s', (value) =>
    expect(parseCalendarDate(value, 'dmy')).toBeNull(),
  )
  it('preserves line breaks, typed values and equivalent date/error values', () => {
    expect(
      cleanText(' A  B\nC ', {
        ...defaultCleaningOptions(),
        collapseSpaces: true,
      }),
    ).toBe(' A B\nC ')
    expect(cleanText(0, defaultCleaningOptions())).toBe(0)
    expect(sameCell(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(true)
    expect(sameCell({ error: 'x' }, { error: 'x' })).toBe(true)
    expect(sameCell('1', 1)).toBe(false)
  })
})
