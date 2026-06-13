export function getBedDisplayLabel(bed, mode = 'bed_code') {
  if (!bed) return ''
  if (mode === 'bed_number') {
    const n = String(bed.bed_number ?? '').trim()
    return n || bed.bed_code || ''
  }
  return bed.bed_code || ''
}
