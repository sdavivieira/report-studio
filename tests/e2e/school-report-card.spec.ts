import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

const root = process.cwd()

test('preserves readable school summary values when reusing a filled report card', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/')
  await page
    .getByLabel('PDF usado como modelo')
    .setInputFiles(
      path.join(root, 'output', 'pdf', 'boletim-escolar-preenchido.pdf'),
    )
  await page
    .locator('.p-fileupload input[type=file]')
    .setInputFiles(
      path.join(
        root,
        'output',
        'spreadsheets',
        'boletim-escolar-dados-ficticios.xlsx',
      ),
    )

  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await expect(
    page.getByText(/Reconstruímos 1 tabela\(s\).*4 campo\(s\) avulsos/),
  ).toBeVisible()

  await page.getByRole('tab', { name: '4 Ajustar layout' }).click()
  await expect(page.getByText(/1 tabela\(s\) reconstruída\(s\)/)).toBeVisible()
  await expect(page.getByText(/4 campo\(s\) da planilha/)).toBeVisible()

  await page.getByRole('tab', { name: '5 Exportar' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  const outputPath = path.join(
    root,
    'output',
    'pdf',
    'boletim-escolar-gerado.pdf',
  )
  await download.saveAs(outputPath)

  const generated = await PDFDocument.load(await readFile(outputPath))
  expect(generated.getPageCount()).toBe(1)
  expect(browserErrors).toEqual([])
})
