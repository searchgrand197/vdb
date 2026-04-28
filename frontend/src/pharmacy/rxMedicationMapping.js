import {
  DEFAULT_DOSAGE_PATTERNS,
  DEFAULT_TIMING_OPTIONS,
  calculateRxQty,
  timingLabel,
} from './rxConstants'

/**
 * Panel item shape:
 * { key, source: 'stock'|'manual', branchId?, medicine?, batch?, manualName?,
 *   pattern, days, qty, timing }
 */
export function rxItemsToMedicationRows(items, dosagePatternOptions = DEFAULT_DOSAGE_PATTERNS, timingOpts = DEFAULT_TIMING_OPTIONS) {
  if (!Array.isArray(items)) return []
  return items.map((it, i) => {
    const pattern = it.pattern || dosagePatternOptions[0]?.v || '1-0-1'
    const days = Math.max(1, Number(it.days) || 1)
    const timing = it.timing || 'AF'
    const tl = timingLabel(timing, timingOpts)

    if (it.source === 'manual') {
      const name = String(it.manualName || '').trim() || 'Medicine'
      const qty = it.qty != null && it.qty !== '' ? Number(it.qty) : calculateRxQty(pattern, days, dosagePatternOptions)
      return {
        drug_name: name.slice(0, 200),
        dose: pattern.slice(0, 80),
        route: '',
        frequency: `${pattern} · ${tl}`.slice(0, 80),
        duration: `${days} day(s)`.slice(0, 80),
        instructions: `Qty: ${qty} · Outside pharmacy formulary`.slice(0, 200),
        sort_order: i,
        rx_meta: {
          type: 'manual',
          pattern,
          days,
          qty,
          timing,
          name,
        },
      }
    }

    const m = it.medicine || {}
    const b = it.batch || {}
    const qty = it.qty != null && it.qty !== '' ? Number(it.qty) : calculateRxQty(pattern, days, dosagePatternOptions)
    const drugName = String(m.name || 'Medicine').slice(0, 200)
    return {
      drug_name: drugName,
      dose: pattern.slice(0, 80),
      route: 'PO',
      frequency: `${pattern} · ${tl}`.slice(0, 80),
      duration: `${days} day(s)`.slice(0, 80),
      instructions: `Qty: ${qty} · ${b.batch_no ? `Batch ${b.batch_no}` : 'Pharmacy stock'}`.slice(0, 200),
      sort_order: i,
      rx_meta: {
        type: 'stock',
        pattern,
        days,
        qty,
        timing,
        branch_id: it.branchId,
        medicine: { id: m.id, name: m.name, sku: m.sku },
        batch: {
          id: b.id,
          batch_no: b.batch_no,
          stock: b.stock,
          sale_rate: b.sale_rate,
        },
      },
    }
  })
}

export function medicationRowsToRxItems(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((r, idx) => {
    const meta = r.rx_meta && typeof r.rx_meta === 'object' ? r.rx_meta : {}
    const key = r.id || `rx-${idx}-${r.sort_order ?? 0}`

    if (meta.type === 'stock' && meta.medicine && meta.batch) {
      return {
        key,
        source: 'stock',
        branchId: meta.branch_id,
        medicine: meta.medicine,
        batch: meta.batch,
        pattern: meta.pattern || '1-0-1',
        days: meta.days != null ? meta.days : 7,
        qty: meta.qty != null ? meta.qty : 1,
        timing: meta.timing || 'AF',
      }
    }

    if (meta.type === 'manual') {
      return {
        key,
        source: 'manual',
        manualName: meta.name || r.drug_name || '',
        pattern: meta.pattern || r.dose || '1-0-1',
        days: meta.days != null ? meta.days : 7,
        qty: meta.qty != null ? meta.qty : 1,
        timing: meta.timing || 'AF',
      }
    }

    return {
      key,
      source: 'manual',
      manualName: r.drug_name || '',
      pattern: '1-0-1',
      days: 7,
      qty: 1,
      timing: 'AF',
      legacy: true,
    }
  })
}
