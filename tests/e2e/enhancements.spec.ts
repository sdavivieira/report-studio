import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { utils } from 'xlsx'
import { workbookBytes } from '../fixtures/workbooks'

test('maps a field manually, previews records, saves a model and exports a batch', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['Nome', 'Valor'],
      ['Ana', 100],
      ['Bia', 250],
    ]),
    'Dados',
  )

  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'lote.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(workbookBytes(book)),
  })
  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await page.getByRole('button', { name: 'Ajustar layout' }).click()

  await page.getByRole('button', { name: 'Campo da planilha' }).click()
  await expect(page.getByText('Campo relacionado manualmente.')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()

  await page.getByLabel('Registro usado na prévia').fill('2')
  await expect(page.locator('.editor-page')).toContainText('Bia')
  await page.getByRole('button', { name: 'Duplicar bloco' }).click()
  await expect(page.locator('.editable-element--data-field')).toHaveCount(2)

  await page.getByRole('button', { name: 'Revisar e exportar' }).click()
  await expect(
    page.getByText('Nenhum problema encontrado antes da exportação.'),
  ).not.toBeVisible()
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click()
  await expect(page.getByText('Modelo salvo na biblioteca')).toBeVisible()

  await page.getByRole('combobox', { name: 'Formato da exportação' }).click()
  await page
    .getByRole('option', { name: 'Um relatório por registro, no mesmo PDF' })
    .click()
  await page.getByLabel('Quantidade').fill('2')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Gerar lote com 2 registro/ }).click()
  const download = await downloadPromise
  const bytes = await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
  })
  const pdf = await PDFDocument.load(bytes)
  expect(pdf.getPageCount()).toBe(2)
  await expect(
    page.getByRole('region', { name: 'Gerar PDF' }).getByRole('status'),
  ).toContainText(/gerado com 2 página/)
})
