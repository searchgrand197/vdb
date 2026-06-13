const CANVAS_W = 1024
const DEFAULT_BOX_W = Math.round((CANVAS_W * 3) / 12)
const DEFAULT_BOX_H = 46
const DEFAULT_START_X = 40
const DEFAULT_START_Y = 120
const DEFAULT_ROW_GAP = 52

export const OPD_CORE_FIELDS = [
  { key: 'phone', label: 'Phone', templateFieldName: 'Phone', autofillType: 'phone' },
  { key: 'uhid', label: 'UHID', templateFieldName: 'UHID', autofillType: 'uhid' },
  { key: 'opd_no', label: 'OPD No', templateFieldName: 'OPD No', autofillType: 'token' },
  { key: 'visit_date', label: 'Date', templateFieldName: 'Date', autofillType: 'visit_datetime' },
  { key: 'patient_name', label: 'Patient Name', templateFieldName: 'Patient', autofillType: 'patient' },
  { key: 'guardian', label: 'Guardian', templateFieldName: 'Guardian', autofillType: 'guardian' },
  { key: 'age_sex', label: 'Age and Sex', templateFieldName: 'Age and Sex', autofillType: 'age_sex' },
  { key: 'address', label: 'Address', templateFieldName: 'Address', autofillType: 'address' },
  { key: 'doctor', label: 'Doctor', templateFieldName: 'Doctor', autofillType: 'doctor' },
  { key: 'department', label: 'Department', templateFieldName: 'Department', autofillType: 'department' },
  { key: 'amount', label: 'Amount', templateFieldName: 'Amount', autofillType: 'amount_mode' },
  { key: 'chief_complaint', label: 'Chief Complaint', templateFieldName: 'Chief Complaint', autofillType: 'chief_complaint' },
]

const CORE_BY_KEY = Object.fromEntries(OPD_CORE_FIELDS.map((row) => [row.key, row]))
const CORE_BY_TEMPLATE_NAME = Object.fromEntries(
  OPD_CORE_FIELDS.map((row) => [row.templateFieldName, row]),
)

export function getDefaultOpdFieldConfig() {
  const out = {}
  for (const row of OPD_CORE_FIELDS) {
    out[row.key] = {
      createForm: row.key !== 'opd_no' && row.key !== 'visit_date',
      slip: true,
      showLabel: true,
      label: row.label,
    }
  }
  return out
}

export function normalizeOpdFieldConfig(raw, hiddenFields = []) {
  const hidden = new Set(Array.isArray(hiddenFields) ? hiddenFields : [])
  const defaults = getDefaultOpdFieldConfig()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Object.keys(raw).length) {
    if (!hidden.size) return defaults
    const legacy = { ...defaults }
    for (const key of hidden) {
      if (legacy[key]) legacy[key] = { ...legacy[key], createForm: false }
    }
    return legacy
  }
  const out = { ...defaults }
  for (const row of OPD_CORE_FIELDS) {
    const src = raw[row.key]
    if (!src || typeof src !== 'object') continue
    out[row.key] = {
      createForm: src.createForm !== false,
      slip: src.slip !== false,
      showLabel: src.showLabel !== false,
      label: String(src.label || row.label).trim() || row.label,
    }
  }
  const legacyPhone = raw.phone
  if ((!raw.uhid || typeof raw.uhid !== 'object') && legacyPhone && typeof legacyPhone === 'object') {
    out.uhid = {
      ...out.uhid,
      createForm: legacyPhone.createForm !== false,
      slip: legacyPhone.slip !== false,
      showLabel: legacyPhone.showLabel !== false,
    }
  }
  const legacyAge = raw.age
  const legacyGender = raw.gender
  if ((!raw.age_sex || typeof raw.age_sex !== 'object') && (legacyAge || legacyGender)) {
    out.age_sex = {
      ...out.age_sex,
      createForm: (legacyAge?.createForm !== false) && (legacyGender?.createForm !== false),
      slip: (legacyAge?.slip !== false) || (legacyGender?.slip !== false),
      showLabel: (legacyAge?.showLabel !== false) && (legacyGender?.showLabel !== false),
    }
  }
  if (hidden.has('age') || hidden.has('gender')) {
    out.age_sex = { ...out.age_sex, createForm: false }
  }
  return out
}

export function formatAgeSexForSlip(age, gender, ageUnit = 'years') {
  const ageStrRaw = age != null && String(age).trim() !== '' ? String(age).trim() : ''
  let ageStr = ageStrRaw
  if (ageStrRaw) {
    const unit = String(ageUnit || 'years').trim().toLowerCase()
    if (unit === 'months') ageStr = `${ageStrRaw}M`
    else if (unit === 'days') ageStr = `${ageStrRaw}D`
    else ageStr = `${ageStrRaw}Y`
  }
  const gAbbr = gender === 'female' ? 'F' : gender === 'male' ? 'M' : gender ? 'O' : ''
  return [ageStr, gAbbr].filter(Boolean).join('/')
}

export function getCoreFieldByKey(key) {
  return CORE_BY_KEY[key] || null
}

export function getCoreFieldByTemplateName(name) {
  return CORE_BY_TEMPLATE_NAME[String(name || '')] || null
}

export function isCoreTemplateField(name) {
  return Boolean(getCoreFieldByTemplateName(name))
}

export function getReservedCoreTemplateNames() {
  return OPD_CORE_FIELDS.map((row) => row.templateFieldName)
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

export function getSlipLabelForField(fieldName, fieldCfg, opdFieldConfig) {
  const core = getCoreFieldByTemplateName(fieldName)
  if (core) {
    const row = opdFieldConfig?.[core.key]
    if (row && row.showLabel === false) return ''
    const label = String(row?.label || core.label || fieldName).trim()
    return label ? `${label}: ` : ''
  }
  if (fieldCfg?.showLabel === false) return ''
  if (fieldCfg?.showLabel === true) {
    const label = String(fieldCfg.label || fieldName).trim()
    return label ? `${label}: ` : ''
  }
  return null
}

export function shouldUseGlobalFieldLabels(fieldName, fieldCfg) {
  if (getCoreFieldByTemplateName(fieldName)) return false
  if (typeof fieldCfg?.showLabel === 'boolean') return false
  return true
}

export function resolveSlipFieldLabel(fieldName, fieldCfg, layout, opdFieldConfig) {
  const useGlobal = shouldUseGlobalFieldLabels(fieldName, fieldCfg)
  if (useGlobal) {
    if (layout?.showFieldLabels !== true) return ''
    return `${fieldName}: `
  }
  return getSlipLabelForField(fieldName, fieldCfg, opdFieldConfig)
}

export function getFieldInputCaption(fieldName, fieldCfg, layout, opdFieldConfig) {
  const prefix = resolveSlipFieldLabel(fieldName, fieldCfg, layout, opdFieldConfig)
  if (!prefix) return fieldName
  return String(prefix).replace(/:\s*$/, '').trim() || fieldName
}
