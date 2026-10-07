import { DEFAULT_IMPORT_LIMITS } from '../../domain/workbook/Workbook'
import type { ImportLimits, ImportResult } from '../../domain/workbook/Workbook'

export interface WorkbookFile {
  name: string
  size: number
  type: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface WorkbookReader {
  read(
    buffer: ArrayBuffer,
    name: string,
    size: number,
    limits: ImportLimits,
  ): Promise<ImportResult>
}

const excelMimeTypes = new Set([
  '',
  'application/octet-stream',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-ole-storage',
  'application/x-excel',
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
])

export async function importWorkbook(
  file: WorkbookFile,
  reader: WorkbookReader,
  limits: ImportLimits = DEFAULT_IMPORT_LIMITS,
): Promise<ImportResult> {
  if (!/\.(xlsx|xls|csv|tsv)$/i.test(file.name))
    return {
      ok: false,
      code: 'extension',
      message: 'Escolha uma planilha .xlsx, .xls, .csv ou .tsv.',
    }
  if (!excelMimeTypes.has(file.type.toLowerCase()))
    return {
      ok: false,
      code: 'mime',
      message: 'O tipo do arquivo não corresponde a uma planilha compatível.',
    }
  if (file.size === 0)
    return {
      ok: false,
      code: 'empty',
      message: 'O arquivo está vazio. Escolha outra planilha.',
    }
  if (file.size > limits.maxBytes)
    return {
      ok: false,
      code: 'size',
      message: `O arquivo excede o limite de ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`,
    }
  try {
    const buffer = await file.arrayBuffer()
    return await reader.read(buffer, file.name, file.size, limits)
  } catch {
    return {
      ok: false,
      code: 'read',
      message: 'Não foi possível ler o arquivo. Tente selecioná-lo novamente.',
    }
  }
}
