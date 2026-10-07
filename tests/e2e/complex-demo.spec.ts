import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'

test('builds the five-page computer sales demonstration report', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const exampleDirectory = path.resolve('examples')
  const outputDirectory = path.resolve('output/demonstracao')
  mkdirSync(outputDirectory, { recursive: true })

  await page.goto('/')
  await page
    .locator('.p-fileupload input[type=file]')
    .setInputFiles(
      path.join(exampleDirectory, 'vendas-computadores-demonstracao.xlsx'),
    )
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await page.getByRole('tab', { name: '5 Exportar' }).click()
  await page
    .getByLabel('Arquivo de modelo JSON')
    .setInputFiles(
      path.join(
        exampleDirectory,
        'relatorio-vendas-computadores.report-template.json',
      ),
    )
  await expect(page.getByRole('status')).toContainText(
    'Modelo validado e aplicado',
  )

  await page.getByRole('tab', { name: '3 Configurar' }).click()
  const preview = page.locator('.configuration-preview')
  const company = preview.getByText('TECHNOVA COMÉRCIO DE INFORMÁTICA LTDA.')
  await expect(company).toBeVisible()
  await expect(
    preview.getByText('Página 1 de 5', { exact: true }).first(),
  ).toBeVisible()
  for (let pageNumber = 1; pageNumber <= 5; pageNumber++) {
    await preview.screenshot({
      path: path.join(outputDirectory, `preview-pagina-${pageNumber}.png`),
    })
    if (pageNumber < 5)
      await preview
        .getByRole('button', { name: 'Próxima página', exact: true })
        .click()
  }

  await page.getByRole('tab', { name: '5 Exportar' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  const pdfPath = path.join(
    outputDirectory,
    'relatorio-vendas-computadores-demonstracao.pdf',
  )
  await download.saveAs(pdfPath)
  const document = await PDFDocument.load(readFileSync(pdfPath))
  expect(document.getPageCount()).toBe(5)
  expect(pageErrors).toEqual([])
})

test('reuses the same model when the worksheet columns are reordered', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const exampleDirectory = path.resolve('examples')
  const outputDirectory = path.resolve('output/demonstracao')
  mkdirSync(outputDirectory, { recursive: true })

  await page.goto('/')
  await page
    .locator('.p-fileupload input[type=file]')
    .setInputFiles(
      path.join(
        exampleDirectory,
        'vendas-computadores-colunas-reordenadas.xlsx',
      ),
    )
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await page.getByRole('tab', { name: '5 Exportar' }).click()
  await page
    .getByLabel('Arquivo de modelo JSON')
    .setInputFiles(
      path.join(
        exampleDirectory,
        'relatorio-vendas-computadores.report-template.json',
      ),
    )
  await expect(page.getByRole('status')).toContainText(
    'Modelo validado e aplicado',
  )

  await page.getByRole('tab', { name: '3 Configurar' }).click()
  const preview = page.locator('.configuration-preview')
  await expect(preview.getByText('Faturamento: R$ 440.421,00')).toBeVisible()
  await expect(preview.getByText('Unidades: 89')).toBeVisible()
  await preview.screenshot({
    path: path.join(outputDirectory, 'modelo-reutilizado-preview.png'),
  })

  await page.getByRole('tab', { name: '5 Exportar' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  const pdfPath = path.join(
    outputDirectory,
    'relatorio-vendas-computadores-modelo-reutilizado.pdf',
  )
  await download.saveAs(pdfPath)
  const document = await PDFDocument.load(readFileSync(pdfPath))
  expect(document.getPageCount()).toBe(5)
})
