import type { WorksheetData } from '../../domain/workbook/Workbook'
import type { CleaningOptions } from '../../domain/workbook/CleaningOptions'
import { prepareCleaning } from '../../application/clean-workbook/prepareCleaning'

export interface CleaningRequest {
  data: WorksheetData
  options: CleaningOptions
}

self.onmessage = (event: MessageEvent<CleaningRequest>) => {
  self.postMessage(prepareCleaning(event.data.data, event.data.options))
}
