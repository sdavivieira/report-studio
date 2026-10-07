import { read, utils, SSF } from 'xlsx'
import type { CellObject } from 'xlsx'
import type {
  CellValue,
  ImportLimits,
  ImportResult,
  Worksheet,
} from '../../domain/workbook/Workbook'

const parseFailure: ImportResult = {
  ok: false,
  code: 'parse',
  message:
    'Não foi possível interpretar o Excel. Verifique se o arquivo está íntegro e não é protegido por senha.',
}
const limitFailure: ImportResult = {
  ok: false,
  code: 'limits',
  message:
    'A planilha excede os limites de processamento. Divida o arquivo em abas ou arquivos menores. Nenhum dado foi importado parcialmente.',
}

// SheetJS exposes SSF without types; keep its concrete boundary inside this adapter.
const dateFormats = SSF as {
  is_date(format: string): boolean
  parse_date_code(
    value: number,
    options: { date1904: boolean },
  ): {
    y: number
    m: number
    d: number
    H: number
    M: number
    S: number
    u: number
  } | null
}

function cellValue(cell: CellObject | undefined, date1904: boolean): CellValue {
  if (!cell) return null
  if (cell.f && cell.v == null) return { error: 'Fórmula sem valor calculado' }
  if (cell.t === 'e') return { error: cell.w ?? '#ERRO!' }
  if (cell.v == null) return null
  if (cell.t === 'd') {
    const date = cell.v instanceof Date ? cell.v : new Date(String(cell.v))
    return Number.isNaN(date.getTime()) ? { error: 'Data inválida' } : date
  }
  if (typeof cell.v === 'number') {
    if (!Number.isFinite(cell.v)) return { error: 'Número inválido' }
    if (typeof cell.z === 'string' && dateFormats.is_date(cell.z)) {
      const parts = dateFormats.parse_date_code(cell.v, { date1904 })
      if (
        !parts ||
        parts.d === 0 ||
        (parts.y === 1900 && parts.m === 2 && parts.d === 29)
      )
        return { error: 'Data inválida' }
      return new Date(
        Date.UTC(
          parts.y,
          parts.m - 1,
          parts.d,
          parts.H,
          parts.M,
          parts.S,
          Math.round(parts.u * 1000),
        ),
      )
    }
    return cell.v
  }
  if (typeof cell.v === 'boolean' || typeof cell.v === 'string') return cell.v
  return null
}

export function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number,
  limits: ImportLimits,
): ImportResult {
  const bytes = new Uint8Array(buffer)
  const zip =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
    (value, index) => bytes[index] === value,
  )
  const biff =
    bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1] ?? -1)
  const delimitedText = /\.(csv|tsv)$/i.test(fileName)
  if (!zip && !ole && !biff && !delimitedText) return parseFailure
  if (buffer.byteLength > limits.maxBytes) return limitFailure
  try {
    const source = delimitedText
      ? new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '')
      : buffer
    const book = read(source, {
      type: delimitedText ? 'string' : 'array',
      ...(fileName.toLowerCase().endsWith('.tsv') ? { FS: '\t' } : {}),
      cellDates: false,
      cellNF: true,
      cellFormula: true,
      cellHTML: false,
      sheetRows: limits.maxRows + 1,
    })
    if (!book.SheetNames.length)
      return {
        ok: false,
        code: 'empty',
        message: 'A planilha não contém abas.',
      }
    if (book.SheetNames.length > limits.maxSheets) return limitFailure
    const sheets: Worksheet[] = []
    let totalCells = 0
    for (const name of book.SheetNames) {
      const source = book.Sheets[name]
      const reference = source?.['!fullref'] ?? source?.['!ref']
      if (!source || !reference) {
        sheets.push({ name, rows: [] })
        continue
      }
      const range = utils.decode_range(reference)
      const height = range.e.r + 1
      const width = range.e.c + 1
      totalCells += height * width
      if (
        height > limits.maxRows ||
        width > limits.maxColumns ||
        totalCells > limits.maxCells
      )
        return limitFailure
      const rows = Array.from({ length: height }, (_, row) =>
        Array.from({ length: width }, (_, col) =>
          cellValue(
            source[utils.encode_cell({ r: row, c: col })] as
              CellObject | undefined,
            !!book.Workbook?.WBProps?.date1904,
          ),
        ),
      )
      sheets.push({ name, rows })
    }
    return { ok: true, workbook: { fileName, fileSize, sheets } }
  } catch {
    return parseFailure
  }
}
