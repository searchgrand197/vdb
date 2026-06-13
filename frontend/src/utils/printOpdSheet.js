import { buildPrintHtml } from '../components/OpdTemplateEditor/buildPrintHtml'
import { getDefaultOpdFieldConfig, normalizeOpdFieldConfig } from '../components/OpdTemplateEditor/opdCoreFields.js'
import { syncCoreFieldsIntoLayout } from '../components/OpdTemplateEditor/syncCoreFieldsIntoLayout.js'
import { writeHtmlInHiddenIframe } from './printHtmlInHiddenFrame.js'

async function fetchReceptionOpdFieldConfig() {
  let opdFieldConfig = getDefaultOpdFieldConfig()
  try {
    const settingsRes = await fetch('/api/v1/settings/reception-portal/', { credentials: 'same-origin' })
    if (settingsRes.ok) {
      const settingsData = await settingsRes.json()
      const row = settingsData?.data || settingsData || {}
      opdFieldConfig = normalizeOpdFieldConfig(row.opd_field_config, row.opd_visible_fields)
    }
  } catch { /* ignore */ }
  return opdFieldConfig
}

async function fetchOpdSlipLayout(opdFieldConfig) {
  try {
    const res = await fetch('/api/templates')
    if (res.ok) {
      const data = await res.json()
      const single = (data.templates || []).find((t) => t.key === 'single')
      if (single?.layout) {
        return syncCoreFieldsIntoLayout(single.layout, opdFieldConfig)
      }
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem('custom-editor-single-layout')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.fields) return parsed
    }
  } catch { /* ignore */ }

  return null
}

/**
 * Build the saved OPD A4 layout and print it without routing through /print-slip.
 */
export async function printOpdSheet({
  values = {},
  withBackground = true,
  layout = null,
  opdFieldConfig = null,
} = {}) {
  const cfg = opdFieldConfig || await fetchReceptionOpdFieldConfig()
  const slipLayout = layout || await fetchOpdSlipLayout(cfg)
  if (!slipLayout) {
    throw new Error('Could not load OPD template layout. Please save the layout in the OPD editor first.')
  }

  const html = buildPrintHtml(slipLayout, values, withBackground, cfg)
  writeHtmlInHiddenIframe(html)
}
