import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

const root = process.cwd()
const fixture = (...parts: string[]) =>
  path.join(root, 'tests', 'fixtures', 'real-budget', ...parts)

test('reconstructs the supplied budget and preserves its calculated totals', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/')
  await page
    .getByLabel('PDF usado como modelo')
    .setInputFiles(fixture('orcamento_em_reais.pdf'))
  await page
    .locator('.p-fileupload input[type=file]')
    .setInputFiles(fixture('orcamento_simples.xlsx'))

  await page.getByRole('tab', { name: '3 Configurar' }).click()
  await expect(
    page.getByText(/Reconstruímos 1 tabela\(s\).*5 campo\(s\) avulsos/s),
  ).toBeVisible()
  await expect(page.getByText(/incluindo 5 totalizador\(es\)/)).toBeVisible()
  await expect(
    page.locator('.configuration-preview .pdf-template-background'),
  ).toHaveCount(0)
  await expect(page.getByText(/texto\(s\).*forma\(s\)/s)).toBeVisible()

  const reconstructedTable = page
    .getByRole('complementary', { name: 'Prévia da página' })
    .getByRole('table')
  const reconstructedRegion = reconstructedTable.locator('..')
  await expect(reconstructedRegion).toHaveClass(/without-title/)
  await expect(reconstructedRegion).toHaveCSS('padding', '0px')
  await expect(reconstructedTable.getByRole('columnheader')).toHaveText([
    'Descrição',
    'Quantidade',
    'Preço Unitário',
    'Total',
  ])
  await expect(reconstructedTable.locator('tbody tr')).toHaveCount(5)
  await expect(reconstructedTable.locator('thead th').first()).toHaveCSS(
    'background-color',
    'rgb(214, 0, 0)',
  )
  await expect(reconstructedTable.locator('tbody tr').first()).toContainText(
    'R$ 45,00',
  )

  await page.getByRole('tab', { name: '4 Ajustar layout' }).click()
  await expect(page.getByLabel('Referência PDF')).not.toBeChecked()
  await expect(
    page.locator('.editor-page .pdf-template-background'),
  ).toHaveCount(0)
  await expect(page.locator('.resize-handle').first()).toHaveCSS('opacity', '0')
  await expect(page.locator('.editable-element--data-field')).toHaveText([
    'R$ 2.279,00',
    'R$ 113,95',
    'R$ 2.165,05',
    'R$ 389,71',
    'R$ 2.554,76',
  ])
  for (const label of [
    'SUBTOTAL',
    'DESCONTO',
    'BASE TRIBUTÁVEL',
    'ICMS',
    'TOTAL ORÇADO',
  ])
    await expect(
      page.locator('.element-list').getByRole('button', {
        name: new RegExp(`Totalizador: ${label}`, 'i'),
      }),
    ).toBeVisible()

  const tableBlock = page.getByRole('button', {
    name: /Tabela reconstruída\. Mova com o ponteiro/,
  })
  await tableBlock.hover()
  await expect(tableBlock.locator('.resize-handle')).toHaveCSS('opacity', '1')

  const totalField = page.locator('.editable-element--data-field').last()
  const parentId = await totalField.getAttribute('data-parent-id')
  expect(parentId).toBeTruthy()
  const parentBlock = page.locator(`[data-element-id="${parentId}"]`)
  const parentBefore = await parentBlock.boundingBox()
  const childBefore = await totalField.boundingBox()
  expect(parentBefore).toBeTruthy()
  expect(childBefore).toBeTruthy()
  await page.mouse.move(parentBefore!.x + 8, parentBefore!.y + 8)
  await page.mouse.down()
  await page.mouse.move(parentBefore!.x + 28, parentBefore!.y + 23)
  const childDuringDrag = await totalField.boundingBox()
  expect(childDuringDrag).toBeTruthy()
  const childId = await totalField.getAttribute('data-element-id')
  const topElementId = await page.evaluate(
    ({ x, y }) =>
      (
        document
          .elementFromPoint(x, y)
          ?.closest<HTMLElement>('[data-element-id]') ?? null
      )?.dataset.elementId,
    {
      x: childDuringDrag!.x + childDuringDrag!.width / 2,
      y: childDuringDrag!.y + childDuringDrag!.height / 2,
    },
  )
  expect(topElementId).toBe(childId)
  await page.mouse.up()
  const childAfter = await totalField.boundingBox()
  expect(childAfter!.x - childBefore!.x).toBeCloseTo(20, 0)
  expect(childAfter!.y - childBefore!.y).toBeCloseTo(15, 0)
  await page.keyboard.press('Control+z')
  const childRestored = await totalField.boundingBox()
  expect(childRestored!.x).toBeCloseTo(childBefore!.x, 0)
  expect(childRestored!.y).toBeCloseTo(childBefore!.y, 0)

  await expect(parentBlock).toHaveClass(/editable-element--selected/)
  const canvasBeforeResize = await page.locator('.editor-canvas').boundingBox()
  expect(canvasBeforeResize).toBeTruthy()
  await page.mouse.click(canvasBeforeResize!.x + 5, canvasBeforeResize!.y + 5)
  await expect(page.locator('.editable-element--selected')).toHaveCount(0)

  await page.setViewportSize({ width: 900, height: 650 })
  const sidebarBox = await page.locator('.editor-assets').boundingBox()
  const canvasBox = await page.locator('.editor-canvas').boundingBox()
  expect(sidebarBox?.height).toBeLessThanOrEqual(500)
  expect(canvasBox?.x).toBeGreaterThan(sidebarBox?.x ?? 0)
  await expect(page.locator('.element-list')).toHaveCSS('max-height', '220px')

  await page.getByRole('tab', { name: '5 Exportar' }).click()
  await expect(page.getByText('Nenhum problema encontrado')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
  const download = await downloadPromise
  const outputPath = path.join(
    root,
    'output',
    'pdf',
    'orcamento-reconstruido-validado.pdf',
  )
  await download.saveAs(outputPath)

  const generated = await PDFDocument.load(await readFile(outputPath))
  expect(generated.getPageCount()).toBe(1)
  expect(browserErrors).toEqual([])
})
