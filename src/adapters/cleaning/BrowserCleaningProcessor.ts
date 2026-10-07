import type { CleaningProcessor } from '../../application/clean-workbook/prepareCleaning'
import type { CleaningPlan } from '../../domain/workbook/CleaningOptions'
import type { CleaningRequest } from './cleaning.worker'

export const browserCleaningProcessor: CleaningProcessor = {
  prepare(data, options) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('./cleaning.worker.ts', import.meta.url),
        { type: 'module' },
      )
      const finish = () => {
        clearTimeout(timer)
        worker.terminate()
      }
      const timer = setTimeout(() => {
        finish()
        reject(
          new Error('A prévia demorou demais. Tente menos operações por vez.'),
        )
      }, 30_000)
      worker.onmessage = (event: MessageEvent<CleaningPlan>) => {
        finish()
        resolve(event.data)
      }
      worker.onerror = () => {
        finish()
        reject(
          new Error(
            'Não foi possível preparar a limpeza. Seus dados foram preservados.',
          ),
        )
      }
      const request: CleaningRequest = { data, options }
      try {
        worker.postMessage(request)
      } catch {
        finish()
        reject(new Error('Não foi possível preparar os dados para limpeza.'))
      }
    })
  },
}
