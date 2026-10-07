import type { ReportImage } from '../../domain/report/ReportTemplate'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_SIDE = 8_000

export type ImageReadResult =
  { ok: true; image: ReportImage } | { ok: false; message: string }

export async function readReportImage(file: File): Promise<ImageReadResult> {
  if (!/\.(png|jpe?g)$/i.test(file.name))
    return {
      ok: false,
      message: 'Use um arquivo com extensão .png, .jpg ou .jpeg.',
    }
  if (file.size > MAX_IMAGE_BYTES)
    return { ok: false, message: 'A imagem deve ter no máximo 5 MB.' }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detectedType = detectImageType(bytes)
  if (!detectedType || !hasValidImageStructure(bytes, detectedType))
    return { ok: false, message: 'Selecione uma imagem PNG ou JPEG válida.' }
  if (file.type && file.type !== detectedType)
    return {
      ok: false,
      message: 'O conteúdo da imagem não corresponde ao tipo informado.',
    }

  let dataUrl: string
  let dimensions: { width: number; height: number }
  try {
    dataUrl = await readAsDataUrl(file)
    dimensions = await readImageDimensions(dataUrl)
  } catch {
    return { ok: false, message: 'Selecione uma imagem PNG ou JPEG válida.' }
  }
  if (dimensions.width > MAX_IMAGE_SIDE || dimensions.height > MAX_IMAGE_SIDE)
    return {
      ok: false,
      message: `A imagem deve ter no máximo ${MAX_IMAGE_SIDE} px em cada lado.`,
    }

  return {
    ok: true,
    image: {
      name: file.name,
      mimeType: detectedType,
      width: dimensions.width,
      height: dimensions.height,
      dataUrl,
      alternativeText: file.name.replace(/\.[^.]+$/, ''),
    },
  }
}

function hasValidImageStructure(
  bytes: Uint8Array,
  type: ReportImage['mimeType'],
): boolean {
  return type === 'image/png'
    ? hasValidPngChunks(bytes)
    : bytes.length >= 4 &&
        bytes[bytes.length - 2] === 0xff &&
        bytes[bytes.length - 1] === 0xd9
}

function hasValidPngChunks(bytes: Uint8Array): boolean {
  if (bytes.length < 45) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  let sawHeader = false

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const typeStart = offset + 4
    const dataStart = offset + 8
    const crcOffset = dataStart + length
    const nextOffset = crcOffset + 4
    if (nextOffset > bytes.length) return false

    const type = String.fromCharCode(...bytes.subarray(typeStart, dataStart))
    if (!sawHeader && (type !== 'IHDR' || length !== 13)) return false
    const expectedCrc = view.getUint32(crcOffset)
    const actualCrc = pngCrc32(bytes.subarray(typeStart, crcOffset))
    if (actualCrc !== expectedCrc) return false

    sawHeader = true
    offset = nextOffset
    if (type === 'IEND') return length === 0 && offset === bytes.length
  }
  return false
}

function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function detectImageType(
  bytes: Uint8Array,
): ReportImage['mimeType'] | undefined {
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  if (isPng) return 'image/png'
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  return isJpeg ? 'image/jpeg' : undefined
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

function readImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = window.setTimeout(
      () => reject(new Error('A leitura da imagem excedeu o tempo limite.')),
      10_000,
    )
    image.onload = () => {
      window.clearTimeout(timeout)
      resolve({ width: image.width, height: image.height })
    }
    image.onerror = () => {
      window.clearTimeout(timeout)
      reject(new Error('Não foi possível abrir a imagem.'))
    }
    image.src = dataUrl
  })
}
