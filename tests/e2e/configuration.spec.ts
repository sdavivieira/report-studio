import { test, expect } from '@playwright/test'
import { utils } from 'xlsx'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { workbookBytes } from '../fixtures/workbooks'

test('configures a report from worksheet columns and validates page width', async ({
  page,
}) => {
  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['Produto', 'Quantidade', 'Preço'],
      ...Array.from({ length: 75 }, (_, index) => [
        index === 0
          ? 'Café especial com origem selecionada e torra artesanal'
          : `Produto ${index + 1}`,
        index + 2,
        12.5 + index,
      ]),
    ]),
    'Vendas',
  )
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'vendas.xlsx',
    mimeType: '',
    buffer: Buffer.from(workbookBytes(book)),
  })
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Conteúdo claro, escolhas explícitas.' }),
  ).toBeVisible()

  const firstColumnCard = page.locator('.column-card').first()
  const columnCardFitsContainer = await firstColumnCard.evaluate((card) => {
    const container = card.closest('.column-configuration')
    if (!container) return false

    const cardBounds = card.getBoundingClientRect()
    const containerBounds = container.getBoundingClientRect()
    return cardBounds.right <= containerBounds.right
  })
  expect(columnCardFitsContainer).toBe(true)

  await page.getByLabel('Título', { exact: true }).fill('Vendas do mês')
  await page.getByLabel('Subtítulo', { exact: true }).fill('Resumo por produto')
  await page.getByLabel('Texto do rodapé').fill('Uso interno')
  await expect(page.locator('.report-page')).toContainText('Vendas do mês')
  await expect(page.locator('.report-page')).toContainText('Café')
  await expect(
    page.getByRole('button', { name: 'Próxima página' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page.getByText(/Continuação da tabela/)).toBeVisible()

  await page.getByLabel('Nome exibido').nth(1).fill('Itens vendidos')
  await page.getByRole('button', { name: 'Mover Preço para cima' }).click()
  const previewHeaders = page.locator('.report-page th')
  await expect(previewHeaders.nth(1)).toHaveText('Preço')
  await expect(previewHeaders.nth(2)).toHaveText('Itens vendidos')

  await page.getByLabel('Largura (mm)').first().fill('120')
  const secondWidth = page.getByLabel('Largura (mm)').nth(1)
  await secondWidth.fill('120')
  await secondWidth.press('Tab')
  await expect(page.getByText(/Todas as colunas serão mantidas/)).toBeVisible()
  const previewCellsFit = await page
    .locator('.report-page td')
    .evaluateAll((cells) =>
      cells.every(
        (cell) =>
          cell.scrollWidth <= cell.clientWidth &&
          getComputedStyle(cell).whiteSpace === 'normal' &&
          getComputedStyle(cell).overflowWrap === 'anywhere',
      ),
    )
  expect(previewCellsFit).toBe(true)
  await page.getByLabel('Largura (mm)').first().fill('80')
  await page.getByLabel('Largura (mm)').nth(1).fill('30')
  await page.getByLabel('Largura (mm)').nth(1).press('Tab')
  await page.locator('label[for="visible-column-1"]').click()
  await expect(page.locator('#visible-column-1')).not.toBeChecked()
  await expect(
    page.getByText('Configuração válida e mantida somente nesta sessão.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Ajustar layout' }).click()
  await expect(
    page.getByRole('heading', { name: 'Ajuste com precisão e contexto.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Revisar e exportar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Revise, salve e exporte.' }),
  ).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('vendas-do-mes.pdf')
  const outputDirectory = path.resolve('output/pdf')
  mkdirSync(outputDirectory, { recursive: true })
  const outputPath = path.join(outputDirectory, 'report-studio-exemplo.pdf')
  await download.saveAs(outputPath)
  const pdfBytes = readFileSync(outputPath)
  expect(pdfBytes.subarray(0, 4).toString()).toBe('%PDF')
  const pdf = await PDFDocument.load(pdfBytes)
  expect(pdf.getPageCount()).toBeGreaterThan(1)
  await expect(page.getByRole('status')).toContainText(/gerado com \d+ página/)
  expect(errors).toEqual([])
})
