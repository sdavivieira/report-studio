import { test, expect } from '@playwright/test'
import { utils } from 'xlsx'
import { writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { workbookBytes } from '../fixtures/workbooks'

test('generates a valid PDF with more than ten thousand rows in a worker', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['Item'],
      ...Array.from({ length: 10_050 }, (_, index) => [`Linha ${index + 1}`]),
    ]),
    'Volume',
  )
  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'volume.xlsx',
    mimeType: '',
    buffer: Buffer.from(workbookBytes(book)),
  })
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await page.getByLabel('Título', { exact: true }).fill('Relatório extenso')
  await page.getByLabel('Margens (mm)').fill('8')
  await page.getByLabel('Tabela (pt)').fill('6')
  await page.getByLabel('Altura da linha (mm)').fill('4')
  await page.getByRole('tab', { name: '5 Exportar' }).click()
  await expect(page.getByText(/Relatório extenso: o PDF/)).toBeVisible()

  await page.evaluate(() => {
    const browserWindow = window as typeof window & { reportBlob?: Blob }
    const createObjectUrl = URL.createObjectURL.bind(URL)
    const clickAnchor = HTMLAnchorElement.prototype.click
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob) browserWindow.reportBlob = object
      return createObjectUrl(object)
    }
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download) clickAnchor.call(this)
    }
  })
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  await expect(page.getByText(/Compondo páginas/)).toBeVisible()
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Boolean((window as typeof window & { reportBlob?: Blob }).reportBlob),
        ),
      { timeout: 150_000 },
    )
    .toBe(true)
  const pdfBase64 = await page.evaluate(async () => {
    const blob = (window as typeof window & { reportBlob?: Blob }).reportBlob
    if (!blob) throw new Error('O navegador não recebeu o PDF gerado.')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    const chunkSize = 32_768
    for (let index = 0; index < bytes.length; index += chunkSize)
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    return btoa(binary)
  })
  const outputPath = testInfo.outputPath('relatorio-extenso.pdf')
  const pdfBytes = Buffer.from(pdfBase64, 'base64')
  writeFileSync(outputPath, pdfBytes)
  const pdf = await PDFDocument.load(pdfBytes)
  expect(pdf.getPageCount()).toBeGreaterThan(100)
})
