import {
  OPD_CORE_FIELDS,
  getCoreFieldByTemplateName,
  getReservedCoreTemplateNames,
  normalizeOpdFieldConfig,
} from './opdCoreFields.js'

const CANVAS_W = 1024
const DEFAULT_BOX_W = Math.round((CANVAS_W * 3) / 12)
const DEFAULT_BOX_H = 46
const DEFAULT_START_X = 40
const DEFAULT_START_Y = 120
const DEFAULT_ROW_GAP = 52
const LEGACY_CORE_NAME_ALIASES = {
  patient_name: ['Patient Name', 'PatientName'],
  age_sex: ['Age / Sex', 'Age/Sex', 'Age Sex', 'Age and Sex', 'Age&Sex'],
}

function defaultLayoutForIndex(index) {
  return {
    x: DEFAULT_START_X,
    y: DEFAULT_START_Y + index * DEFAULT_ROW_GAP,
    size: 13,
    width: DEFAULT_BOX_W,
    height: DEFAULT_BOX_H,
  }
}

function cloneLayout(layout) {
  return {
    ...layout,
    fields: { ...(layout?.fields || {}) },
    notes: { ...(layout?.notes || {}) },
    shapes: { ...(layout?.shapes || {}) },
    tables: { ...(layout?.tables || {}) },
  }
}

export function syncCoreFieldsIntoLayout(layout, rawOpdFieldConfig) {
  const next = cloneLayout(layout || {})
  if (!next.fields) next.fields = {}
  const cfg = normalizeOpdFieldConfig(rawOpdFieldConfig)
  const reserved = new Set(getReservedCoreTemplateNames())

  const migrateLegacyCoreFieldKey = (row) => {
    const templateName = row.templateFieldName
    if (next.fields[templateName]) return

    const aliases = LEGACY_CORE_NAME_ALIASES[row.key] || []
    for (const alias of aliases) {
      if (!next.fields[alias]) continue
      next.fields[templateName] = next.fields[alias]
      delete next.fields[alias]
      return
    }

    for (const [fieldName, fieldCfg] of Object.entries(next.fields)) {
      if (fieldName === templateName) continue
      if (!fieldCfg || typeof fieldCfg !== 'object') continue
      if (fieldCfg.coreKey !== row.key) continue
      next.fields[templateName] = fieldCfg
      delete next.fields[fieldName]
      return
    }
  }

  for (let index = 0; index < OPD_CORE_FIELDS.length; index += 1) {
    const row = OPD_CORE_FIELDS[index]
    const fieldCfg = cfg[row.key] || {}
    const templateName = row.templateFieldName
    migrateLegacyCoreFieldKey(row)
    const existing = next.fields[templateName]
    if (fieldCfg.slip) {
      const base = defaultLayoutForIndex(index)
      next.fields[templateName] = {
        ...base,
        ...(existing || {}),
        system: true,
        coreKey: row.key,
      }
    } else if (existing?.system || getCoreFieldByTemplateName(templateName)) {
      delete next.fields[templateName]
    }
  }

  for (const name of Object.keys(next.fields)) {
    const row = next.fields[name]
    if (!row) continue
    if (reserved.has(name) && row.system !== true) {
      row.system = true
      const core = getCoreFieldByTemplateName(name)
      if (core) row.coreKey = core.key
    }
  }

  for (const legacyName of ['Age', 'Gender']) {
    const row = next.fields[legacyName]
    if (row?.system) delete next.fields[legacyName]
  }

  return next
}

export function filterLayoutFieldsForSlip(layout, rawOpdFieldConfig) {
  const cfg = normalizeOpdFieldConfig(rawOpdFieldConfig)
  const fields = layout?.fields || {}
  const out = {}
  for (const [name, fieldCfg] of Object.entries(fields)) {
    const core = getCoreFieldByTemplateName(name)
    if (core) {
      if (cfg[core.key]?.slip !== false) out[name] = fieldCfg
      continue
    }
    out[name] = fieldCfg
  }
  return out
}
