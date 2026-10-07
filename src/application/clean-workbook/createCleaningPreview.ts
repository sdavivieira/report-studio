import type { WorksheetData } from '../../domain/workbook/Workbook'
import type {
  CleaningOptions,
  CleaningResult,
} from '../../domain/workbook/CleaningOptions'
import type { CleaningProcessor } from './prepareCleaning'

export async function createCleaningPreview(
  data: WorksheetData,
  options: CleaningOptions,
  processor: CleaningProcessor,
): Promise<CleaningResult> {
  if (
    (options.convertNumbers || options.normalizeDecimals) &&
    !options.numericColumns.length
  )
    return {
      ok: false,
      message: 'Selecione as colunas para tratar os números.',
    }
  if (options.normalizeDates && !options.dateColumns.length)
    return {
      ok: false,
      message: 'Selecione as colunas para normalizar as datas.',
    }
  if (
    options.normalizeDates &&
    (options.convertNumbers || options.normalizeDecimals) &&
    options.dateColumns.some((id) => options.numericColumns.includes(id))
  )
    return {
      ok: false,
      message: 'Escolha colunas diferentes para números e datas.',
    }
  if (
    options.fillEmpty &&
    (!options.fillValue || options.fillValue.length > 100)
  )
    return {
      ok: false,
      message: 'Informe um texto de preenchimento com até 100 caracteres.',
    }
  try {
    return { ok: true, plan: await processor.prepare(data, options) }
  } catch {
    return {
      ok: false,
      message:
        'Não foi possível preparar a limpeza. Tente menos operações por vez. Os dados foram preservados.',
    }
  }
}
