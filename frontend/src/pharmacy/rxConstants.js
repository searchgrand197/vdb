/** Shared with doctor OPD prescription and IPD discharge medication. */
export const DEFAULT_RX_DAYS = [1, 3, 5, 7, 10, 14, 30]
export const DEFAULT_TIMING_OPTIONS = [
  { v: 'AF', l: 'After Food' },
  { v: 'BF', l: 'Before Food' },
  { v: 'EM', l: 'Empty Stomach' },
  { v: 'BD', l: 'Twice Daily' },
  { v: 'TDS', l: 'Three Times' },
  { v: 'QID', l: 'Four Times' },
  { v: 'HS', l: 'Bedtime' },
  { v: 'SOS', l: 'As Needed' },
]
export const DEFAULT_DOSAGE_PATTERNS = [
  { v: '1', l: '1 (OD)', q: 1 },
  { v: '1-0-1', l: '1-0-1 (BD)', q: 2 },
  { v: '1-1', l: '1-1 (BD)', q: 2 },
  { v: '1-1-1', l: '1-1-1 (TDS)', q: 3 },
  { v: '1-1-1-1', l: '1-1-1-1 (QID)', q: 4 },
  { v: '0-1', l: '0-1 (Night)', q: 1 },
  { v: '1-0', l: '1-0 (Morning)', q: 1 },
  { v: '2-2', l: '2-2 (BD)', q: 4 },
  { v: '2-2-2', l: '2-2-2 (TDS)', q: 6 },
  { v: '0.5-0.5', l: '0.5-0.5 (Half BD)', q: 1 },
]

export function calculateRxQty(pattern, days, dosagePatternOptions = DEFAULT_DOSAGE_PATTERNS) {
  const matched = dosagePatternOptions.find((p) => String(p.v) === String(pattern))
  const eq = Number(matched?.q)
  const perDay = Number.isFinite(eq) && eq > 0
    ? eq
    : String(pattern)
        .split('-')
        .reduce((acc, curr) => acc + (Number(curr) || 0), 0)
  return Math.ceil(perDay * (Number(days) || 1)) || 1
}

export function timingLabel(timing, timingOptions = DEFAULT_TIMING_OPTIONS) {
  return timingOptions.find((t) => t.v === timing)?.l || timing || ''
}

/** Prefer Saroj / Saroj Pharma over other branches when picking a default. */
export function pickDefaultPharmacyBranchId(branches) {
  if (!Array.isArray(branches) || !branches.length) return ''
  const saroj = branches.find((b) => {
    const text = `${b.label || ''} ${b.name || ''} ${b.display_name || ''}`.toLowerCase()
    return text.includes('saroj')
  })
  return String((saroj || branches[0]).id)
}
