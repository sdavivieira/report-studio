import { test, expect } from '@playwright/test'
import { workbookBytes, exampleWorkbook } from '../fixtures/workbooks'

test('imports, reviews, changes sheets and headers entirely locally', async ({
  page,
}) => {
  const errors: string[] = []
  const external: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (
      !request.url().startsWith('http://127.0.0.1:4175') &&
      !request.url().startsWith('data:')
    )
      external.push(request.url())
  })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /Toda boa história/ }),
  ).toBeVisible()
  await expect(page.getByRole('tabpanel', { name: '1 Importar' })).toBeVisible()
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'operacoes.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(workbookBytes()),
  })
  await expect(
    page.getByRole('heading', { name: 'Um olhar antes de continuar.' }),
  ).toBeVisible()
  await expect(page.getByRole('tabpanel', { name: '2 Revisar' })).toBeVisible()
  const header = page.getByRole('spinbutton', { name: 'Linha do cabeçalho' })
  await header.fill('2')
  await header.press('Tab')
  await expect(
    page.getByText('Cabeçalho duplicado.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'Ação cultural', exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: '<img src=x onerror="alert(1)">' }),
  ).toBeVisible()
  await expect(page.locator('tbody img')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Aba da planilha' }).click()
  await page.getByRole('option', { name: 'Resumo', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Belém' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Aba da planilha' }).click()
  await page.getByRole('option', { name: 'Vazia', exact: true }).click()
  await expect(
    page.getByText('A aba está vazia.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Descartar', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Descartar', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: /Toda boa história/ }),
  ).toBeVisible()
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('reads legacy XLS, keeps original on failed replacement and has no horizontal overflow on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'legado.xls',
    mimeType: 'application/vnd.ms-excel',
    buffer: Buffer.from(workbookBytes(exampleWorkbook(), 'xls')),
  })
  await expect(
    page.getByRole('heading', { name: 'Um olhar antes de continuar.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Trocar planilha' }).click()
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'corrompido.xlsx',
    mimeType: '',
    buffer: Buffer.from('invalid'),
  })
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Substituir', exact: true })
    .click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível interpretar' }),
  ).toBeVisible()
  await expect(page.getByText('legado.xls', { exact: true })).toBeVisible()
})

test('imports UTF-8 CSV data and preserves accented text', async ({ page }) => {
  await page.goto('/')
  await page.locator('.p-fileupload input[type=file]').setInputFiles({
    name: 'vendas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Produto,Valor\nCafé especial,12.5', 'utf8'),
  })

  await expect(
    page.getByRole('heading', { name: 'Um olhar antes de continuar.' }),
  ).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Café especial' })).toBeVisible()
  await expect(page.getByText('vendas.csv', { exact: true })).toBeVisible()
})

test('rejects unsupported and empty files with understandable messages', async ({
  page,
}) => {
  await page.goto('/')
  const input = page.locator('.p-fileupload input[type=file]')
  await input.setInputFiles({
    name: 'arquivo.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('a,b'),
  })
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'planilha .xlsx, .xls, .csv ou .tsv' }),
  ).toBeVisible()
  await input.setInputFiles({
    name: 'vazio.xlsx',
    mimeType: '',
    buffer: Buffer.alloc(0),
  })
  await expect(
    page.getByRole('alert').filter({ hasText: 'O arquivo está vazio' }),
  ).toBeVisible()
})
