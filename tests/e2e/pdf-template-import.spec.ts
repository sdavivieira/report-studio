import { expect, test } from '@playwright/test'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { utils } from 'xlsx'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { workbookBytes } from '../fixtures/workbooks'

const root = process.cwd()

test('uses a filled PDF as a reusable visual model for spreadsheet data', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/')
  await page
    .getByLabel('PDF usado como modelo')
    .setInputFiles(path.join(root, 'examples', 'modelo-pdf-preenchido.pdf'))
  await expect(page.getByText(/modelo-pdf-preenchido\.pdf/)).toBeVisible()

  await page
    .locator('.p-fileupload input[type=file]')
    .setInputFiles(
      path.join(root, 'examples', 'vendas-computadores-demonstracao.xlsx'),
    )
  await page.getByRole('tab', { name: '3 Configurar' }).click()

  await expect(
    page.getByText(/foi reconstruído em elementos editáveis/),
  ).toBeVisible()
  await expect(
    page.locator('.configuration-preview .pdf-template-background'),
  ).toHaveCount(0)
  await expect(page.locator('.report-custom-element')).not.toHaveCount(0)

  await page.getByRole('tab', { name: '4 Ajustar layout' }).click()
  await expect(
    page.locator('.editor-page .pdf-template-background'),
  ).toHaveCount(0)
  await page.getByLabel('Referência PDF').click()
  await expect(
    page.locator('.editor-page .pdf-template-background'),
  ).toBeVisible()
  await page.getByLabel('Referência PDF').click()
  await expect(
    page.locator('.editor-page .pdf-template-background'),
  ).toHaveCount(0)
  await expect(page.getByText(/\d+ tabela\(s\) · \d+ campo\(s\)/)).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /Tabela reconstruída\. Mova com o ponteiro/,
    }),
  ).toBeVisible()

  await page.getByRole('tab', { name: '5 Exportar' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  const outputPath = path.join(
    root,
    'output',
    'demonstracao',
    'modelo-pdf-preenchido-reutilizado.pdf',
  )
  await download.saveAs(outputPath)

  const generated = await PDFDocument.load(await readFile(outputPath))
  expect(generated.getPageCount()).toBe(5)
  expect(browserErrors).toEqual([])
})

test('reconstructs a detected PDF table and lets the user resize its columns', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const sourcePdf = await PDFDocument.create()
  const sourcePage = sourcePdf.addPage([595, 842])
  const font = await sourcePdf.embedFont(StandardFonts.Helvetica)
  sourcePage.drawText('Produto', { x: 50, y: 650, size: 12, font })
  sourcePage.drawText('Receita', { x: 370, y: 650, size: 12, font })
  sourcePage.drawText('Notebook Pro', { x: 50, y: 615, size: 10, font })
  sourcePage.drawText('95382', { x: 370, y: 615, size: 10, font })
  sourcePage.drawRectangle({
    x: 45,
    y: 600,
    width: 440,
    height: 80,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  })

  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['Produto', 'Receita'],
      ['Notebook Pro', 95382],
      [
        'Computador Gamer com descrição muito longa e especificações completas do produto',
        127500,
      ],
    ]),
    'Dados',
  )

  await page.goto('/')
  await page.getByLabel('PDF usado como modelo').setInputFiles({
    name: 'tabela-preenchida.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await sourcePdf.save()),
  })
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'produtos.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(workbookBytes(book)),
  })
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await page.getByRole('button', { name: 'Ajustar layout' }).click()

  await expect(page.getByText(/1 tabela\(s\) · \d+ campo\(s\)/)).toBeVisible()
  const tableBlock = page.getByRole('button', {
    name: /Tabela reconstruída\. Mova com o ponteiro/,
  })
  await tableBlock.dblclick()
  await expect(
    page.getByText(/Tabela reconstruída do PDF com 100%/),
  ).toBeVisible()

  const drawer = page.locator('.property-drawer')
  const productWidth = drawer.getByRole('spinbutton', { name: 'Produto' })
  await productWidth.fill('70')
  await productWidth.press('Tab')
  await expect(page.locator('.editor-data-table col').first()).toHaveAttribute(
    'style',
    /70%/,
  )
  await expect(page.locator('.editor-data-table td').last()).toHaveCSS(
    'overflow-wrap',
    'anywhere',
  )

  await drawer.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Revisar e exportar' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  const outputPath = path.join(
    root,
    'output',
    'pdf',
    'reconstrucao-assistida-tabela.pdf',
  )
  await download.saveAs(outputPath)
  const generated = await PDFDocument.load(await readFile(outputPath))
  expect(generated.getPageCount()).toBe(1)
})
