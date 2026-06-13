import { useEffect, useState } from 'react'
import { format } from 'date-fns'

export const TIME_DISPLAY_MODE_CHANGED = 'time-display-mode-changed'

const TOKENS_24H = {
  time: 'HH:mm',
  timeSeconds: 'HH:mm:ss',
  dateTime: 'd/M/yyyy HH:mm',
  dateTimeSeconds: 'd/M/yyyy HH:mm:ss',
  dateTimeParen: 'd/M/yyyy (HH:mm)',
  dateTimeParenSeconds: 'd/M/yyyy (HH:mm:ss)',
}

const TOKENS_12H = {
  time: 'h:mm a',
  timeSeconds: 'h:mm:ss a',
  dateTime: 'd/M/yyyy h:mm a',
  dateTimeSeconds: 'd/M/yyyy h:mm:ss a',
  dateTimeParen: 'd/M/yyyy (h:mm a)',
  dateTimeParenSeconds: 'd/M/yyyy (h:mm:ss a)',
}

let cachedMode = '24h'

function normalizeMode(raw) {
  return raw === '12h' ? '12h' : '24h'
}

export function getTimeDisplayMode() {
  return cachedMode
}

export function syncTimeDisplayModeFromRow(row) {
  const next = normalizeMode(row?.time_display_mode)
  if (next === cachedMode) return
  cachedMode = next
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TIME_DISPLAY_MODE_CHANGED, { detail: { mode: next } }))
  }
}

export function getTimeFormatTokens() {
  return cachedMode === '12h' ? { ...TOKENS_12H } : { ...TOKENS_24H }
}

function toDate(value) {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function formatTime(value, { withSeconds = false } = {}) {
  const d = toDate(value)
  if (!d) return '—'
  const tokens = getTimeFormatTokens()
  return format(d, withSeconds ? tokens.timeSeconds : tokens.time)
}

export function formatDateTime(value, {
  withSeconds = false,
  paren = false,
  dateStyle = 'd/M/yyyy',
} = {}) {
  const d = toDate(value)
  if (!d) return '—'
  const tokens = getTimeFormatTokens()
  if (paren) {
    const timePart = withSeconds ? tokens.timeSeconds : tokens.time
    return `${format(d, dateStyle)} (${format(d, timePart)})`
  }
  if (dateStyle !== 'd/M/yyyy') {
    const timePart = withSeconds ? tokens.timeSeconds : tokens.time
    return `${format(d, dateStyle)} ${format(d, timePart)}`
  }
  return format(d, withSeconds ? tokens.dateTimeSeconds : tokens.dateTime)
}

/** Ledger / IPD receipt lines: date with time in parentheses (matches print). */
export function formatReceiptDateTime(value) {
  const d = toDate(value)
  if (!d) return '—'
  const tokens = getTimeFormatTokens()
  return `${format(d, 'd/M/yyyy')} (${format(d, tokens.timeSeconds)})`
}

/** Build a date-fns pattern with the current time tokens substituted. */
export function withTimeTokens(pattern) {
  const tokens = getTimeFormatTokens()
  return String(pattern || '')
    .replace(/HH:mm:ss/g, tokens.timeSeconds)
    .replace(/HH:mm/g, tokens.time)
    .replace(/h:mm:ss a/g, tokens.timeSeconds)
    .replace(/h:mm a/g, tokens.time)
    .replace(/hh:mm a/g, tokens.time)
}

export function formatWithPattern(dateVal, fmtStr, { empty = '—' } = {}) {
  if (!dateVal) return empty
  const d = toDate(dateVal)
  if (!d) return empty
  try {
    return format(d, withTimeTokens(fmtStr))
  } catch {
    return empty
  }
}

export function useTimeDisplayMode() {
  const [mode, setMode] = useState(() => getTimeDisplayMode())

  useEffect(() => {
    const onChange = (e) => setMode(e.detail?.mode || getTimeDisplayMode())
    window.addEventListener(TIME_DISPLAY_MODE_CHANGED, onChange)
    return () => window.removeEventListener(TIME_DISPLAY_MODE_CHANGED, onChange)
  }, [])

  return mode
}
