import { describe, expect, it, vi } from 'vitest'
import { importWorkbook } from './importWorkbook'
import type { WorkbookFile, WorkbookReader } from './importWorkbook'
import { DEFAULT_IMPORT_LIMITS } from '../../domain/workbook/Workbook'

const file = (overrides: Partial<WorkbookFile> = {}): WorkbookFile => ({
  name: 'teste.xlsx',
  size: 50,
  type: '',
  arrayBuffer: async () => new ArrayBuffer(50),
  ...overrides,
})
const reader: WorkbookReader = {
  read: vi.fn(async () => ({
    ok: true as const,
    workbook: { fileName: 'teste.xlsx', fileSize: 50, sheets: [] },
  })),
}

describe('import use case', () => {
  it.each([
    [{ name: 'teste.pdf' }, 'extension'],
    [{ type: 'image/png' }, 'mime'],
    [{ size: 0 }, 'empty'],
    [{ size: 30 * 1024 * 1024 }, 'size'],
  ] as const)(
    'validates metadata before reading: %o',
    async (metadata, code) => {
      const readBytes = vi.fn()
      expect(
        await importWorkbook(
          file({ ...metadata, arrayBuffer: readBytes }),
          reader,
        ),
      ).toMatchObject({ ok: false, code })
      expect(readBytes).not.toHaveBeenCalled()
    },
  )
  it('accepts missing MIME and uppercase extensions', async () => {
    expect(
      (await importWorkbook(file({ name: 'ARQUIVO.XLS' }), reader)).ok,
    ).toBe(true)
  })
  it('accepts CSV and TSV text files', async () => {
    expect(
      (
        await importWorkbook(
          file({ name: 'dados.csv', type: 'text/csv' }),
          reader,
        )
      ).ok,
    ).toBe(true)
    expect(
      (
        await importWorkbook(
          file({ name: 'dados.tsv', type: 'text/tab-separated-values' }),
          reader,
        )
      ).ok,
    ).toBe(true)
  })
  it('honors configurable size limits', async () => {
    expect(
      await importWorkbook(file(), reader, {
        ...DEFAULT_IMPORT_LIMITS,
        maxBytes: 20,
      }),
    ).toMatchObject({ ok: false, code: 'size' })
  })
  it('maps read errors to a user-facing result', async () => {
    expect(
      await importWorkbook(
        file({
          arrayBuffer: async () => {
            throw Error('private data')
          },
        }),
        reader,
      ),
    ).toEqual({
      ok: false,
      code: 'read',
      message: 'Não foi possível ler o arquivo. Tente selecioná-lo novamente.',
    })
  })
})
