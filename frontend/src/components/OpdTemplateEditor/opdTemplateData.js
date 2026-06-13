import api from '../../api'
import { getDefaultOpdFieldConfig, normalizeOpdFieldConfig } from './opdCoreFields.js'
import { syncCoreFieldsIntoLayout } from './syncCoreFieldsIntoLayout.js'

const LOCAL_STORAGE_KEY = 'custom-editor-single-layout'

export async function loadOpdTemplateData() {
  let opdFieldConfig = getDefaultOpdFieldConfig()
  try {
    const { data } = await api.get('/settings/reception-portal/')
    const row = data?.data || data || {}
    opdFieldConfig = normalizeOpdFieldConfig(row.opd_field_config, row.opd_visible_fields)
  } catch {
    // keep defaults
  }

  let layout = null
  try {
    const res = await fetch('/api/templates')
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const list = Array.isArray(data.templates) ? data.templates : []
      const single = list.find((t) => t.key === 'single' && t.layout)
      if (single?.layout) {
        layout = syncCoreFieldsIntoLayout(single.layout, opdFieldConfig)
      }
    }
  } catch {
    // fall back to localStorage
  }

  if (!layout) {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.fields && typeof parsed.fields === 'object') {
          layout = syncCoreFieldsIntoLayout(parsed, opdFieldConfig)
        }
      }
    } catch {
      // ignore
    }
  }

  return { opdFieldConfig, layout }
}

export async function persistOpdTemplateLayoutWithCoreFields(opdFieldConfig) {
  try {
    const res = await fetch('/api/templates')
    if (!res.ok) return
    const data = await res.json()
    const single = (data.templates || []).find((t) => t.key === 'single')
    const baseLayout = single?.layout || {}
    const synced = syncCoreFieldsIntoLayout(baseLayout, opdFieldConfig)
    await fetch('/api/templates/update-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ key: 'single', layout: synced }),
    })
  } catch {
    // best-effort sync
  }
}

export async function saveOpdFieldConfig(opdFieldConfig) {
  const normalized = normalizeOpdFieldConfig(opdFieldConfig)
  const { data } = await api.patch('/settings/reception-portal/', { opd_field_config: normalized })
  const row = data?.data || data || {}
  const saved = normalizeOpdFieldConfig(row.opd_field_config, row.opd_visible_fields)
  await persistOpdTemplateLayoutWithCoreFields(saved)
  return saved
}

export function normalizeOpdCustomFields(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    const name = String(key || '').trim()
    if (!name) continue
    out[name] = value == null ? '' : String(value)
  }
  return out
}

export function buildOpdCustomFieldPayload(fieldNames, values) {
  const out = {}
  for (const name of fieldNames || []) {
    const key = String(name || '').trim()
    if (!key) continue
    out[key] = values?.[key] == null ? '' : String(values[key])
  }
  return out
}
