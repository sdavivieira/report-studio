import { parseWorkbook } from './parseWorkbook'
import type { ImportLimits } from '../../domain/workbook/Workbook'

export interface ParseRequest {
  buffer: ArrayBuffer
  name: string
  size: number
  limits: ImportLimits
}

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { buffer, name, size, limits } = event.data
  self.postMessage(parseWorkbook(buffer, name, size, limits))
}
