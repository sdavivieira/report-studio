import { describe, expect, it, vi } from 'vitest'
import { createCleaningPreview } from './createCleaningPreview'
import { prepareCleaning } from './prepareCleaning'
import { defaultCleaningOptions } from '../../domain/workbook/CleaningOptions'
import { selectWorksheet } from '../../domain/workbook/selectWorksheet'
import type { CleaningOptions } from '../../domain/workbook/CleaningOptions'

describe('cleaning validation', () => {
  const data = selectWorksheet({ name: 'A', rows: [['A'], ['  a ']] }, 1)
  it.each<Partial<CleaningOptions>>([
    { convertNumbers: true },
    { normalizeDates: true },
    { fillEmpty: true },
    { fillEmpty: true, fillValue: 'x'.repeat(101) },
    {
      convertNumbers: true,
      normalizeDates: true,
      numericColumns: ['column-0'],
      dateColumns: ['column-0'],
    },
  ])(
    'rejects invalid options without launching processing: %o',
    async (patch) => {
      const prepare = vi.fn()
      expect(
        (
          await createCleaningPreview(
            data,
            { ...defaultCleaningOptions(), ...patch },
            { prepare },
          )
        ).ok,
      ).toBe(false)
      expect(prepare).not.toHaveBeenCalled()
    },
  )
  it('returns a typed result and handles worker failure without exposing error details', async () => {
    const options = { ...defaultCleaningOptions(), trimSpaces: true }
    expect(
      (
        await createCleaningPreview(data, options, {
          prepare: async () => prepareCleaning(data, options),
        })
      ).ok,
    ).toBe(true)
    const result = await createCleaningPreview(data, options, {
      prepare: async () => {
        throw new Error('private content')
      },
    })
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).not.toContain('private content')
  })
})
