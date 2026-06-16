/** Marg-style billing helpers (expiry, pack/loose → base qty, free qty via +). */

export function expiryMeta(isoDate) {
  if (!isoDate) return { status: 'ok', days: null }
  const exp = new Date(isoDate)
  if (Number.isNaN(exp.getTime())) return { status: 'ok', days: null }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  const diffDays = Math.round((exp.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return { status: 'expired', days: diffDays }
  if (diffDays <= 60) return { status: 'expiring', days: diffDays }
  return { status: 'ok', days: diffDays }
}

export function expiryBadgeClass(status) {
  if (status === 'expired') return 'bg-rose-100 text-rose-800 border-rose-200'
  if (status === 'expiring') return 'bg-amber-100 text-amber-900 border-amber-200'
  return ''
}

/** Allow digits and one decimal point in qty fragments. */
function parseQtyFragment(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return 0
  const cleaned = t.replace(/[^\d.]/g, '')
  if (!cleaned || cleaned === '.') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Parse pack/loose text with optional free after '+'.
 * Spaces are ignored. "+2" and "0+2" both mean 0 sold, 2 free.
 * @returns {{ sold: number, free: number }}
 */
export function parseQtyWithFree(raw) {
  const compact = String(raw ?? '').replace(/\s/g, '')
  if (!compact) return { sold: 0, free: 0 }
  const plusIdx = compact.indexOf('+')
  if (plusIdx < 0) {
    return { sold: parseQtyFragment(compact), free: 0 }
  }
  const left = compact.slice(0, plusIdx)
  const right = compact.slice(plusIdx + 1)
  return {
    sold: parseQtyFragment(left),
    free: parseQtyFragment(right),
  }
}

/** Sanitize user input: digits, dot, single + */
export function sanitizePackLooseInput(raw) {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/[^0-9.+]/g, '')
    .replace(/(\+.*)\+/g, '$1')
}

/**
 * Sold base units = (sold packs × pack_size) + sold loose.
 * Free units are returned separately (not taxed).
 */
export function computeBaseQtyFromPacksLoose(packs, loose, packSize) {
  const ps = Math.max(1, Number(packSize) || 1)
  const p = parseQtyWithFree(packs)
  const l = parseQtyWithFree(loose)
  const soldBase = p.sold * ps + l.sold
  const freeBase = p.free * ps + l.free
  return {
    qty: soldBase,
    freeQty: freeBase,
  }
}

/** Legacy numeric-only base qty (sold only). */
export function computeSoldBaseQty(packs, loose, packSize) {
  return computeBaseQtyFromPacksLoose(packs, loose, packSize).qty
}

function formatBaseUnitNumber(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return v % 1 === 0 ? String(v) : String(v)
}

/** Invoice units column: sold and free in smallest (base) units, e.g. 16+3 or 27+5. */
export function formatBillQtyBaseUnits(soldBase, freeBase) {
  const s = Math.max(0, Number(soldBase) || 0)
  const f = Math.max(0, Number(freeBase) || 0)
  if (f <= 0) return formatBaseUnitNumber(s)
  return `${formatBaseUnitNumber(s)}+${formatBaseUnitNumber(f)}`
}

/** Bill line qty from pack/loose entry → base units display. */
export function formatBillQtyDisplay(packs, loose, packSize) {
  const { qty, freeQty } = computeBaseQtyFromPacksLoose(packs, loose, packSize)
  return formatBillQtyBaseUnits(qty, freeQty)
}

/** 3-letter qty suffix from dosage form / unit name (e.g. tab, cap). */
export function qtySuffixFromMedicine(medicine) {
  const form = String(medicine?.form || '').toLowerCase()
  const unit = String(medicine?.unit_name || medicine?.unit?.name || '').toLowerCase()
  const s = `${form} ${unit}`.trim()
  if (!s) return 'tab'
  if (/\btab|tablet|tabl/.test(s)) return 'tab'
  if (/\bcap|capsule/.test(s)) return 'cap'
  if (/\bml\b|syrup|susp|liquid|drops?/.test(s)) return 'ml'
  if (/\binj|vial|amp/.test(s)) return 'inj'
  if (/\bpcs|piece|unit\b/.test(s)) return 'pcs'
  const compact = s.replace(/[^a-z]/g, '')
  if (compact.length >= 3) return compact.slice(0, 3)
  return (compact + 'tab').slice(0, 3)
}

/** Pack shorthand on bills (e.g. strip → str). */
export function packQtyShortcut(packLabel = 'strip') {
  const raw = String(packLabel || 'strip').trim().toLowerCase()
  if (!raw || raw === 'strip' || raw === 'str') return 'str'
  if (raw.length <= 3) return raw
  return raw.slice(0, 3)
}

function decomposeQtyToStripsLine(q, packSize, baseSuffix = 'tab', packLabel = 'strip') {
  const ps = Math.max(1, Number(packSize) || 1)
  const qty = Math.max(0, Number(q) || 0)
  const baseLbl = (baseSuffix || 'tab').toLowerCase()
  const packLbl = packQtyShortcut(packLabel)

  if (ps <= 1) {
    return qty % 1 === 0 ? String(qty) : String(Number(qty.toFixed(2)))
  }

  const strips = Math.floor(qty / ps)
  const remainder = qty % ps
  if (strips <= 0 && remainder <= 0) return `0 ${baseLbl}`
  if (strips > 0 && remainder > 0) {
    const rem = remainder % 1 === 0 ? remainder : Number(remainder.toFixed(2))
    return `${strips} ${packLbl}-${rem} ${baseLbl}`
  }
  if (strips > 0) return `${strips} ${packLbl}`
  const rem = remainder % 1 === 0 ? remainder : Number(remainder.toFixed(2))
  return `${rem} ${baseLbl}`
}

/** Bill qty as str-tab[+str-tab] on one line (e.g. 11 loose @10 + 24 free → "11 str-3 tab+2 str-4 tab"). */
export function formatBillQtyStripsMode(soldBase, freeBase, packSize, baseSuffix = 'tab', packLabel = 'strip') {
  const ps = Math.max(1, Number(packSize) || 1)
  const sold = Math.max(0, Number(soldBase) || 0)
  const free = Math.max(0, Number(freeBase) || 0)

  if (ps <= 1) {
    return formatBillQtyBaseUnits(sold, free)
  }

  const baseLbl = (baseSuffix || 'tab').toLowerCase()
  const soldPart = sold > 0 ? decomposeQtyToStripsLine(sold, ps, baseSuffix, packLabel) : ''
  const schemePart = free > 0 ? decomposeQtyToStripsLine(free, ps, baseSuffix, packLabel) : ''

  if (soldPart && schemePart) return `${soldPart}+${schemePart}`
  if (schemePart) return `+${schemePart}`
  if (soldPart) return soldPart
  return `0 ${baseLbl}`
}

/** Split strips-mode qty at + for callers that need sold vs scheme segments. */
export function formatBillQtyStripsModeLines(soldBase, freeBase, packSize, baseSuffix = 'tab', packLabel = 'strip') {
  const ps = Math.max(1, Number(packSize) || 1)
  const sold = Math.max(0, Number(soldBase) || 0)
  const free = Math.max(0, Number(freeBase) || 0)

  if (ps <= 1) {
    return formatBillQtyBaseUnitsLines(sold, free)
  }

  const text = formatBillQtyStripsMode(sold, free, ps, baseSuffix, packLabel)
  const plusIdx = text.indexOf('+')
  if (plusIdx < 0) return [text]
  if (plusIdx === 0) return [text]
  return [text.slice(0, plusIdx), text.slice(plusIdx)]
}

/** Sold and scheme (+) on separate lines for base-unit display. */
export function formatBillQtyBaseUnitsLines(soldBase, freeBase) {
  const s = Math.max(0, Number(soldBase) || 0)
  const f = Math.max(0, Number(freeBase) || 0)
  const lines = []
  if (s > 0) lines.push(formatBaseUnitNumber(s))
  if (f > 0) lines.push(`+${formatBaseUnitNumber(f)}`)
  if (lines.length === 0) return ['0']
  return lines
}

/**
 * Single entry for bill qty column — respects outlet display mode.
 * @param {object} p
 * @param {'base_units'|'pack_and_loose'} [p.mode]
 */
export function formatBillQtyForOutlet({
  mode = 'base_units',
  packs = null,
  loose = null,
  qty = 0,
  freeQty = 0,
  packSize = 1,
  baseSuffix = 'tab',
  packLabel = 'strip',
}) {
  const displayMode = mode === 'pack_and_loose' ? 'pack_and_loose' : 'base_units'
  let sold
  let free
  if (packs != null || loose != null) {
    const parsed = computeBaseQtyFromPacksLoose(packs ?? '', loose ?? '', packSize)
    sold = parsed.qty
    free = parsed.freeQty
  } else {
    sold = Number(qty) || 0
    free = Number(freeQty) || 0
  }
  if (displayMode === 'base_units') {
    return formatBillQtyBaseUnits(sold, free)
  }
  return formatBillQtyStripsMode(sold, free, packSize, baseSuffix, packLabel)
}

/** Qty column segments — sold and optional +scheme (single-line join = formatBillQtyForOutlet). */
export function formatBillQtyForOutletLines({
  mode = 'base_units',
  packs = null,
  loose = null,
  qty = 0,
  freeQty = 0,
  packSize = 1,
  baseSuffix = 'tab',
  packLabel = 'strip',
}) {
  const displayMode = mode === 'pack_and_loose' ? 'pack_and_loose' : 'base_units'
  let sold
  let free
  if (packs != null || loose != null) {
    const parsed = computeBaseQtyFromPacksLoose(packs ?? '', loose ?? '', packSize)
    sold = parsed.qty
    free = parsed.freeQty
  } else {
    sold = Number(qty) || 0
    free = Number(freeQty) || 0
  }
  if (displayMode === 'base_units') {
    return formatBillQtyBaseUnitsLines(sold, free)
  }
  return formatBillQtyStripsModeLines(sold, free, packSize, baseSuffix, packLabel)
}

function invoiceItemMedicine(it) {
  if (it?.medicine && typeof it.medicine === 'object') return it.medicine
  return it?.medicine_print || null
}

/** Pack size for bill qty (strip size) — mirrors PharmacyInvoicePrint stripSizeFromItem. */
export function packSizeFromInvoiceItem(it) {
  const forced = Number(it?.strip_size_for_print)
  if (Number.isFinite(forced) && forced > 0) return forced
  const fromField = Number(it?.pack_size)
  if (Number.isFinite(fromField) && fromField > 0) return fromField
  const med = invoiceItemMedicine(it)
  const convStrip =
    Number(med?.unit_conversions?.strip) ||
    Number(med?.unit_conversions?.STRIP) ||
    Number(it?.unit_conversions?.strip) ||
    Number(it?.unit_conversions?.STRIP)
  if (Number.isFinite(convStrip) && convStrip > 0) return convStrip
  const packInfo = String(med?.pack_info || it?.pack_info || it?.pack || '')
  const m = packInfo.match(/x\s*(\d+(?:\.\d+)?)/i)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return 1
}

function invoiceItemBaseQtyParts(it) {
  const packSize = packSizeFromInvoiceItem(it)
  if (it?.packs_display != null || it?.loose_display != null) {
    const ps = Math.max(1, packSize)
    const parsed = computeBaseQtyFromPacksLoose(it.packs_display, it.loose_display, ps)
    return { sold: parsed.qty, free: parsed.freeQty, packSize: ps }
  }
  return {
    sold: Number(it?.qty) || 0,
    free: Number(it?.free_qty) || 0,
    packSize: Math.max(1, packSize),
  }
}

/** Footer total for units column: sum sold base + sum free base. */
export function formatInvoiceTotalQtyBase(items) {
  const list = Array.isArray(items) ? items : []
  let sold = 0
  let free = 0
  for (const it of list) {
    const parts = invoiceItemBaseQtyParts(it)
    sold += parts.sold
    free += parts.free
  }
  return formatBillQtyBaseUnits(sold, free)
}

/**
 * Footer total qty — respects outlet sale_bill_qty_display.
 * pack_and_loose uses str/tab when all contributing lines share one pack_size > 1.
 */
export function formatInvoiceTotalQtyForOutlet(items, mode = 'base_units') {
  const list = Array.isArray(items) ? items : []
  let sold = 0
  let free = 0
  const packSizes = new Set()
  let firstItemWithQty = null

  for (const it of list) {
    const parts = invoiceItemBaseQtyParts(it)
    if (parts.sold <= 0 && parts.free <= 0) continue
    sold += parts.sold
    free += parts.free
    packSizes.add(parts.packSize)
    if (!firstItemWithQty) firstItemWithQty = it
  }

  if (mode !== 'pack_and_loose') {
    return formatBillQtyBaseUnits(sold, free)
  }

  if (packSizes.size === 1) {
    const packSize = [...packSizes][0]
    if (packSize > 1) {
      const med = invoiceItemMedicine(firstItemWithQty) || firstItemWithQty
      const baseSuffix = qtySuffixFromMedicine(med)
      return formatBillQtyStripsMode(sold, free, packSize, baseSuffix, 'strip')
    }
  }

  return formatBillQtyBaseUnits(sold, free)
}

/** Internal / inventory nickname (primary in system UI). */
export function medicineNickName(medicine) {
  if (!medicine || typeof medicine !== 'object') return ''
  return String(medicine.name ?? '').trim()
}

/** Optional bill print name when different from nickname. */
export function medicineBillAlias(medicine) {
  if (!medicine || typeof medicine !== 'object') return ''
  const bill = String(medicine.name_on_bill ?? '').trim()
  const nick = medicineNickName(medicine)
  if (!bill || bill.toLowerCase() === nick.toLowerCase()) return ''
  return bill
}

/** Printed invoice & customer display: name on bill first, else nickname. */
export function medicineBillName(medicine) {
  return medicineBillAlias(medicine) || medicineNickName(medicine)
}

/**
 * Normalize discount % while typing: empty → 0 immediately; no leading zeros (05 → 5).
 */
export function normalizeDiscountPercentInput(nextRaw, prevRaw = '') {
  let v = String(nextRaw ?? '').replace(/[^\d.]/g, '')
  if (v === '') return '0'
  if (v.length > 1 && v.startsWith('0') && v[1] !== '.') {
    v = v.replace(/^0+/, '') || '0'
  }
  const prev = String(prevRaw ?? '').trim()
  if (prev === '0' && v.length === 2 && v.startsWith('0') && /\d/.test(v[1])) {
    v = v[1]
  }
  return v
}
