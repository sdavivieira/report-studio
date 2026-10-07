import { describe, expect, it } from 'vitest'
import { readReportImage } from './BrowserImageReader'

describe('browser image reader', () => {
  it('rejects unsupported content even when the extension looks valid', async () => {
    const file = new File(['not an image'], 'logo.png', { type: 'image/png' })
    await expect(readReportImage(file)).resolves.toEqual({
      ok: false,
      message: 'Selecione uma imagem PNG ou JPEG válida.',
    })
  })

  it('rejects a PNG with corrupted chunks before it reaches PDF generation', async () => {
    const corruptedPng = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
      (character) => character.charCodeAt(0),
    )
    corruptedPng[29] = corruptedPng[29]! ^ 1
    const file = new File([corruptedPng], 'corrompido.png', {
      type: 'image/png',
    })

    await expect(readReportImage(file)).resolves.toEqual({
      ok: false,
      message: 'Selecione uma imagem PNG ou JPEG válida.',
    })
  })

  it('rejects images above the session limit before decoding', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'logo.png', {
      type: 'image/png',
    })
    await expect(readReportImage(file)).resolves.toEqual({
      ok: false,
      message: 'A imagem deve ter no máximo 5 MB.',
    })
  })
})
