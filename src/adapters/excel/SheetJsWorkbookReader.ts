import type { WorkbookReader } from '../../application/import-workbook/importWorkbook'
import type { ImportResult } from '../../domain/workbook/Workbook'
import type { ParseRequest } from './excel.worker'

export const sheetJsWorkbookReader: WorkbookReader = {
  read(buffer, name, size, limits) {
    return new Promise((resolve) => {
      const worker = new Worker(new URL('./excel.worker.ts', import.meta.url), {
        type: 'module',
      })
      const finish = (result: ImportResult) => {
        clearTimeout(timer)
        worker.terminate()
        resolve(result)
      }
      const timer = setTimeout(
        () =>
          finish({
            ok: false,
            code: 'timeout',
            message:
              'O processamento demorou demais. Tente uma planilha menor.',
          }),
        limits.timeoutMs,
      )
      worker.onmessage = (event: MessageEvent<ImportResult>) =>
        finish(event.data)
      worker.onerror = () =>
        finish({
          ok: false,
          code: 'parse',
          message:
            'Não foi possível processar o arquivo. Tente uma planilha menor ou salve uma nova cópia no Excel.',
        })
      const request: ParseRequest = { buffer, name, size, limits }
      worker.postMessage(request, [buffer])
    })
  },
}
