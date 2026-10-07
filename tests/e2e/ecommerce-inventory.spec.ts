import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

const root = process.cwd()

test('reuses a filled ecommerce inventory PDF with a plain spreadsheet', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/')
  await page
    .getByLabel('PDF usado como modelo')
    .setInputFiles(
      path.join(
        root,
        'output',
        'pdf',
        'estoque-botas-ecommerce-preenchido.pdf',
      ),
    )
  await page
    .locator('.p-fileupload input[type=file]')
    .setInputFiles(
      path.join(root, 'output', 'spreadsheets', 'estoque-botas-ecommerce.xlsx'),
    )

  await expect(page.getByText('0 erros')).toBeVisible()
  await expect(page.getByText('0 avisos')).toBeVisible()
  await page.getByRole('button', { name: 'Configurar relatório' }).click()
  await expect(
    page.getByText(/Reconstruímos 1 tabela\(s\).*4 campo\(s\) avulsos/),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Ajustar layout' }).click()
  await expect(page.getByText(/1 tabela\(s\) reconstruída\(s\)/)).toBeVisible()
  await expect(page.getByText(/4 campo\(s\) da planilha/)).toBeVisible()
  await expect(
    page
      .locator('.editable-element--data-field')
      .filter({ hasText: 'R$ 89.984' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Revisar e exportar' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  const outputPath = path.join(
    root,
    'output',
    'pdf',
    'estoque-botas-ecommerce-gerado.pdf',
  )
  await download.saveAs(outputPath)

  await expect(page.getByText(/gerado com 1 página\(s\)/)).toBeVisible()
  const generated = await PDFDocument.load(await readFile(outputPath))
  expect(generated.getPageCount()).toBe(1)
  expect(browserErrors).toEqual([])
})
