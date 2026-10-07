import type { ReportTemplate } from '../../domain/report/ReportTemplate'

const LIBRARY_KEY = 'report-studio:template-library:v1'
const DRAFT_KEY = 'report-studio:autosave:v1'
const LIBRARY_LIMIT = 12

export interface BrowserTemplateEntry {
  id: string
  name: string
  savedAt: string
  template: ReportTemplate
}

export function saveDraftTemplate(template: ReportTemplate): boolean {
  return writeStorage(DRAFT_KEY, JSON.stringify(template))
}

export function readDraftTemplate(): string | null {
  return readStorage(DRAFT_KEY)
}

export function clearDraftTemplate(): void {
  removeStorage(DRAFT_KEY)
}

export function listBrowserTemplates(): readonly BrowserTemplateEntry[] {
  const value = readStorage(LIBRARY_KEY)
  if (!value) return []
  try {
    const entries = JSON.parse(value) as unknown
    if (!Array.isArray(entries)) return []
    return entries.filter(isLibraryEntry).slice(0, LIBRARY_LIMIT)
  } catch {
    return []
  }
}

export function saveBrowserTemplate(
  name: string,
  template: ReportTemplate,
): BrowserTemplateEntry {
  const entry: BrowserTemplateEntry = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Modelo sem nome',
    savedAt: new Date().toISOString(),
    template,
  }
  const entries = [entry, ...listBrowserTemplates()].slice(0, LIBRARY_LIMIT)
  if (!writeStorage(LIBRARY_KEY, JSON.stringify(entries)))
    throw new Error('O navegador não permitiu salvar o modelo localmente.')
  return entry
}

export function deleteBrowserTemplate(id: string): void {
  const entries = listBrowserTemplates().filter((entry) => entry.id !== id)
  writeStorage(LIBRARY_KEY, JSON.stringify(entries))
}

function isLibraryEntry(value: unknown): value is BrowserTemplateEntry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BrowserTemplateEntry>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.savedAt === 'string' &&
    typeof candidate.template === 'object' &&
    candidate.template !== null
  )
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage can be disabled; clearing remains best-effort.
  }
}
