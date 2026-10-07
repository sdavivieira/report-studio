import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultReportConfiguration } from '../../domain/report/ReportConfiguration'
import type { ReportTemplate } from '../../domain/report/ReportTemplate'
import {
  clearDraftTemplate,
  deleteBrowserTemplate,
  listBrowserTemplates,
  readDraftTemplate,
  saveBrowserTemplate,
  saveDraftTemplate,
} from './BrowserTemplateLibrary'

const template: ReportTemplate = {
  version: 1,
  configuration: createDefaultReportConfiguration([
    { id: 'a', index: 0, label: 'Nome', headerValue: 'Nome' },
  ]),
  elements: [],
}

describe('browser template library', () => {
  beforeEach(() => localStorage.clear())

  it('keeps a private draft without worksheet rows', () => {
    expect(saveDraftTemplate(template)).toBe(true)
    expect(JSON.parse(readDraftTemplate() ?? '{}')).toMatchObject({
      version: 1,
    })
    clearDraftTemplate()
    expect(readDraftTemplate()).toBeNull()
  })

  it('saves, lists and deletes named templates', () => {
    const entry = saveBrowserTemplate('Financeiro', template)
    expect(listBrowserTemplates()).toHaveLength(1)
    expect(listBrowserTemplates()[0]?.name).toBe('Financeiro')
    deleteBrowserTemplate(entry.id)
    expect(listBrowserTemplates()).toEqual([])
  })
})
