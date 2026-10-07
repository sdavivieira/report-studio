import { test, expect } from '@playwright/test'
import { utils } from 'xlsx'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { workbookBytes } from '../fixtures/workbooks'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test('edits layout, embeds an image, saves a model and reuses it', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const firstBook = utils.book_new()
  utils.book_append_sheet(
    firstBook,
    utils.aoa_to_sheet([
      ['Produto', 'Valor'],
      ['Café', 20],
      ['Chá', 14],
    ]),
    'Dados',
  )
  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'origem.xlsx',
    mimeType: '',
    buffer: Buffer.from(workbookBytes(firstBook)),
  })
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await page.getByLabel('Título', { exact: true }).fill('Modelo editorial')
  await page.getByLabel('Subtítulo', { exact: true }).fill('Resumo compatível')
  await page.getByRole('button', { name: 'Ajustar layout' }).click()

  const titleBlock = page.getByRole('button', {
    name: 'Título. Mova com o ponteiro ou use as setas.',
    exact: true,
  })
  const titleBounds = await titleBlock.boundingBox()
  expect(titleBounds).not.toBeNull()
  await page.mouse.move(
    titleBounds!.x + titleBounds!.width / 2,
    titleBounds!.y + titleBounds!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    titleBounds!.x + titleBounds!.width / 2,
    titleBounds!.y + titleBounds!.height / 2 + 20,
  )
  await page.mouse.up()
  await expect(page.getByText('Modelo com alterações não salvas')).toBeVisible()

  const selectedTitleZIndex = await titleBlock.evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  )
  const tableZIndex = await page
    .getByRole('button', {
      name: 'Tabela. Mova com o ponteiro ou use as setas.',
      exact: true,
    })
    .evaluate((element) => Number(getComputedStyle(element).zIndex))
  expect(selectedTitleZIndex).toBeGreaterThan(tableZIndex)

  await page.getByRole('button', { name: 'Adicionar página' }).click()
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Texto livre', exact: true }).click()
  await page
    .getByLabel('Texto', { exact: true })
    .fill('Observação fora da tabela')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()

  await page.getByRole('button', { name: 'Fórmula', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page.getByRole('button', { name: 'Gráfico', exact: true }).click()
  await page.locator('#chart-type').click()
  await page.getByRole('option', { name: 'Pizza', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Tabela ou ranking', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Valor menos Valor', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Análise por Produto', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Ranking', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Totalizador', exact: true }).click()
  await page.locator('#summary-column').click()
  await page.getByRole('option', { name: 'Valor', exact: true }).click()
  await page.locator('#summary-operation').click()
  await page.getByRole('option', { name: 'Soma', exact: true }).click()
  await page.getByLabel('Rótulo', { exact: true }).fill('Valor total')
  await expect(page.getByText('Valor total: 34', { exact: true })).toBeVisible()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()

  await page.locator('.editor-assets input[type=file]').setInputFiles({
    name: 'marca.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  })
  await expect(page.locator('.image-thumbnail')).toBeVisible()
  await page.getByLabel('Texto alternativo').fill('Marca de exemplo')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Revisar e exportar' }).click()

  await page.getByLabel('Incorporar a imagem ao modelo').check()
  const templateDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Salvar modelo' }).click()
  const templateDownload = await templateDownloadPromise
  const outputDirectory = path.resolve('output/templates')
  mkdirSync(outputDirectory, { recursive: true })
  const templatePath = path.join(
    outputDirectory,
    'modelo-editorial.report-template.json',
  )
  await templateDownload.saveAs(templatePath)
  const savedTemplate = readFileSync(templatePath, 'utf8')
  expect(savedTemplate).toContain('"version": 1')
  expect(savedTemplate).toContain('data:image/png;base64,')
  expect(savedTemplate).toContain('Observação fora da tabela')
  expect(savedTemplate).toContain('"type": "summary"')
  expect(savedTemplate).toContain('"type": "formula"')
  expect(savedTemplate).toContain('"type": "chart"')
  expect(savedTemplate).toContain('"type": "dataTable"')
  expect(savedTemplate).toContain('"pageIndex": 1')
  expect(savedTemplate).not.toContain('Café')

  const pdfDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const pdfDownload = await pdfDownloadPromise
  const pdfPath = path.join(outputDirectory, 'modelo-editorial.pdf')
  await pdfDownload.saveAs(pdfPath)
  const pdf = await PDFDocument.load(readFileSync(pdfPath))
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2)

  await page.getByRole('tab', { name: '1 Importar' }).click()
  const compatibleBook = utils.book_new()
  utils.book_append_sheet(
    compatibleBook,
    utils.aoa_to_sheet([
      ['Valor', 'Produto'],
      [31, 'Bolo'],
    ]),
    'Nova base',
  )
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'compativel.xlsx',
    mimeType: '',
    buffer: Buffer.from(workbookBytes(compatibleBook)),
  })
  await page.getByRole('button', { name: 'Substituir' }).click()
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await page.getByRole('tab', { name: '5 Exportar' }).click()
  await page.getByLabel('Arquivo de modelo JSON').setInputFiles({
    name: 'modelo-editorial.report-template.json',
    mimeType: 'application/json',
    buffer: readFileSync(templatePath),
  })
  expect(pageErrors).toEqual([])
  await expect(page.getByRole('status')).toContainText(
    'Modelo validado e aplicado',
  )
  await expect(
    page.getByText('Modelo editorial', { exact: true }),
  ).toBeVisible()
})
