import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'

type Scenario = {
  id: string
  title?: string
  pages?: number
  notes?: string[]
  xlsx?: string
  pdf?: string
}

type ScenarioResult = {
  id: string
  status: 'passed' | 'failed'
  durationMs: number
  matchedFields?: number
  generatedPages?: number
  diagnostics?: string
  components?: string[]
  error?: string
}

const root = process.cwd()
const suite = process.env.QA_SUITE ?? 'synthetic'
const qaRoot = path.join(root, 'tmp', 'qa', suite)
const outputDir = path.join(qaRoot, 'generated')
const resultPath = path.join(qaRoot, 'results.json')

test(`executes the complete ${suite} QA campaign`, async ({ page }) => {
  test.setTimeout(30 * 60 * 1000)
  const allScenarios = JSON.parse(
    await fs.readFile(path.join(qaRoot, 'manifest.json'), 'utf8'),
  ) as Scenario[]
  const requestedIds = new Set(
    (process.env.QA_FILTER ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
  const scenarios = requestedIds.size
    ? allScenarios.filter((scenario) => requestedIds.has(scenario.id))
    : allScenarios
  await fs.mkdir(outputDir, { recursive: true })
  const results: ScenarioResult[] = []

  for (const [index, scenario] of scenarios.entries()) {
    const startedAt = Date.now()
    const pageErrors: string[] = []
    const onPageError = (error: Error) => pageErrors.push(error.message)
    page.on('pageerror', onPageError)

    try {
      const xlsxPath = scenario.xlsx
        ? path.resolve(root, scenario.xlsx)
        : path.join(qaRoot, 'xlsx', `${scenario.id}.xlsx`)
      const pdfPath = scenario.pdf
        ? path.resolve(root, scenario.pdf)
        : path.join(qaRoot, 'pdf', `${scenario.id}.pdf`)

      await page.goto('/')
      await page.getByLabel('PDF usado como modelo').setInputFiles(pdfPath)
      await expect(page.getByText(path.basename(pdfPath))).toBeVisible({
        timeout: 30_000,
      })
      await page
        .locator('.p-fileupload input[type=file]')
        .setInputFiles(xlsxPath)
      await expect(
        page.getByRole('heading', { name: 'Um olhar antes de continuar.' }),
      ).toBeVisible()

      const diagnostics = await page
        .getByRole('complementary', { name: 'Diagnóstico' })
        .innerText()
      if (!/\b0 erros\b/.test(diagnostics)) {
        throw new Error(
          `Workbook diagnostics blocked the flow:\n${diagnostics}`,
        )
      }
      await page.getByRole('button', { name: 'Configurar relatório' }).click()

      const importAlert = page.getByRole('alert').filter({
        hasText: 'foi reconstruído em elementos editáveis',
      })
      await expect(importAlert).toBeVisible()
      const importText = await importAlert.innerText()
      const matchedFields = Number(
        importText.match(/(\d+) campo\(s\) avulsos/)?.[1] ?? 0,
      )
      await page.getByRole('button', { name: 'Ajustar layout' }).click()
      await expect(
        page.getByRole('heading', { name: 'Ajuste com precisão e contexto.' }),
      ).toBeVisible()

      const components = await addComponentCoverage(page, scenario.id, index)
      await page.getByRole('button', { name: 'Revisar e exportar' }).click()
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Gerar e baixar PDF' }).click()
      const download = await downloadPromise
      const generatedPath = path.join(outputDir, `${scenario.id}.pdf`)
      await download.saveAs(generatedPath)
      await expect(page.getByText(/gerado com \d+ página\(s\)/)).toBeVisible()

      const [sourcePdf, generatedPdf] = await Promise.all([
        PDFDocument.load(await fs.readFile(pdfPath)),
        PDFDocument.load(await fs.readFile(generatedPath)),
      ])
      expect(generatedPdf.getPageCount()).toBe(sourcePdf.getPageCount())
      for (
        let pageIndex = 0;
        pageIndex < sourcePdf.getPageCount();
        pageIndex += 1
      ) {
        const sourceSize = sourcePdf.getPage(pageIndex).getSize()
        const generatedSize = generatedPdf.getPage(pageIndex).getSize()
        expect(generatedSize.width).toBeCloseTo(sourceSize.width, 1)
        expect(generatedSize.height).toBeCloseTo(sourceSize.height, 1)
      }
      expect(pageErrors).toEqual([])
      results.push({
        id: scenario.id,
        status: 'passed',
        durationMs: Date.now() - startedAt,
        matchedFields,
        generatedPages: generatedPdf.getPageCount(),
        diagnostics,
        components,
      })
    } catch (error) {
      results.push({
        id: scenario.id,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        error:
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error),
      })
    } finally {
      page.off('pageerror', onPageError)
      await fs.writeFile(resultPath, JSON.stringify(results, null, 2))
    }
  }

  const failures = results.filter((result) => result.status === 'failed')
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
})

async function addComponentCoverage(
  page: import('@playwright/test').Page,
  scenarioId: string,
  index: number,
): Promise<string[]> {
  const components: string[] = []
  if (scenarioId === 's05-long-text') {
    await page.getByRole('button', { name: 'Texto livre', exact: true }).click()
    await page
      .getByLabel('Texto', { exact: true })
      .fill(
        'Nota longa fora do grid para validar composição independente da tabela.',
      )
    await closeDrawer(page)
    components.push('customText')
  }
  if (scenarioId === 's08-currencies') {
    await page.getByRole('button', { name: 'Fórmula', exact: true }).click()
    await closeDrawer(page)
    components.push('formula')
  }
  if (scenarioId === 's16-multi-sheet') {
    await page.getByRole('button', { name: 'Gráfico', exact: true }).click()
    await closeDrawer(page)
    components.push('chart')
  }
  if (scenarioId === 's20-fifty-columns') {
    await page
      .getByRole('button', { name: 'Tabela ou ranking', exact: true })
      .click()
    await closeDrawer(page)
    components.push('dataTable')
  }
  if (scenarioId === 's02-small-sales') {
    await page.getByRole('button', { name: 'Totalizador', exact: true }).click()
    await closeDrawer(page)
    components.push('summary')
  }
  if (!components.length && index % 7 === 0) {
    await page.getByRole('button', { name: 'Texto livre', exact: true }).click()
    await closeDrawer(page)
    components.push('customText')
  }
  return components
}

async function closeDrawer(page: import('@playwright/test').Page) {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
}
