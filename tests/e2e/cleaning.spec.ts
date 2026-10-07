import { test, expect } from '@playwright/test'
import { utils } from 'xlsx'
import { workbookBytes } from '../fixtures/workbooks'

test('reviews, cancels, applies, protects selection and undoes optional cleaning', async ({
  page,
}) => {
  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['Nome', 'Nome', 'Vazia', 'Data'],
      ['  Café  ', '12,50', null, '29/02/2024'],
      [null, null, null, null],
      ['Ação', '001', null, '31/02/2024'],
    ]),
    'Dados',
  )
  utils.book_append_sheet(book, utils.aoa_to_sheet([['A'], [1]]), 'Outra')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'limpeza.xlsx',
    mimeType: '',
    buffer: Buffer.from(workbookBytes(book)),
  })
  await page.getByRole('button', { name: 'Escolher limpezas' }).click()
  for (const name of [
    'Aparar espaços nas extremidades',
    'Remover linhas vazias',
    'Remover colunas vazias',
    'Renomear cabeçalhos duplicados',
    'Converter textos em números',
    'Normalizar datas em texto',
  ])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await page
    .getByRole('combobox', { name: 'Colunas numéricas', exact: true })
    .press('ArrowDown')
  await page
    .getByRole('option', { name: 'Nome · coluna 2', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Colunas numéricas', exact: true })
    .press('Escape')
  await expect(
    page.getByRole('option', { name: 'Nome · coluna 2', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Colunas de datas', exact: true })
    .press('ArrowDown')
  await page
    .getByRole('option', { name: 'Data · coluna 4', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Colunas de datas', exact: true })
    .press('Escape')
  await expect(
    page.getByRole('option', { name: 'Data · coluna 4', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Revisar alterações', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Revisar limpeza' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByText('1 linhas removidas', { exact: true }),
  ).toBeVisible()
  await expect(
    dialog.getByText('1 colunas removidas', { exact: true }),
  ).toBeVisible()
  await expect(
    dialog.getByText(
      /Preservados sem conversão: 1 valores numéricos e 1 datas/,
    ),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(
    page.getByRole('cell', { name: '12,50', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Revisar alterações', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Aplicar limpeza', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: '12.5', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: '001', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Nome (2)', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Linha completamente vazia.', { exact: true }),
  ).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Aba da planilha' }).click()
  await page.getByRole('option', { name: 'Outra', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Manter dados' })
    .click()
  await expect(
    page.getByRole('cell', { name: '12.5', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer última limpeza' }).click()
  await expect(
    page.getByRole('cell', { name: '12,50', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Linha completamente vazia.', { exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('imports and cleans 25,000 rows without truncating data', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['Nome', 'Valor'],
      ...Array.from({ length: 25_000 }, (_, i) => [` Item ${i} `, i]),
    ]),
    'Grande',
  )
  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'grande.xlsx',
    mimeType: '',
    buffer: Buffer.from(workbookBytes(book)),
  })
  await expect(
    page.getByText(/Todas as 25000 linhas permanecem em memória/),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(10)
  await page.getByRole('button', { name: 'Escolher limpezas' }).click()
  await page
    .getByRole('checkbox', { name: 'Aparar espaços nas extremidades' })
    .check()
  await page
    .getByRole('button', { name: 'Revisar alterações', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Revisar limpeza' })
  await expect(
    dialog.getByText('25000 células alteradas', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(dialog.locator('tbody tr')).toHaveCount(50)
  await dialog.getByRole('button', { name: 'Aplicar limpeza' }).click()
  await expect(
    page.getByText(/Todas as 25000 linhas permanecem em memória/),
  ).toBeVisible()
})
