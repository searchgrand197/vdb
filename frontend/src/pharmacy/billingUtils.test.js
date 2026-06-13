import { describe, expect, it } from 'vitest'
import {
  computeBaseQtyFromPacksLoose,
  formatBillQtyBaseUnits,
  formatBillQtyBaseUnitsLines,
  formatBillQtyDisplay,
  formatBillQtyForOutlet,
  formatBillQtyForOutletLines,
  formatBillQtyStripsMode,
  formatBillQtyStripsModeLines,
  formatInvoiceTotalQtyBase,
  medicineBillAlias,
  medicineBillName,
  medicineNickName,
  normalizeDiscountPercentInput,
  parseQtyWithFree,
} from './billingUtils'

describe('parseQtyWithFree', () => {
  it('parses sold only', () => {
    expect(parseQtyWithFree('5')).toEqual({ sold: 5, free: 0 })
  })
  it('parses sold and free with spaces ignored', () => {
    expect(parseQtyWithFree('5 + 10')).toEqual({ sold: 5, free: 10 })
    expect(parseQtyWithFree('+2')).toEqual({ sold: 0, free: 2 })
    expect(parseQtyWithFree('0+2')).toEqual({ sold: 0, free: 2 })
  })
})

describe('computeBaseQtyFromPacksLoose', () => {
  it('computes sold and free base units', () => {
    expect(computeBaseQtyFromPacksLoose('4', '0+3', 4)).toEqual({ qty: 16, freeQty: 3 })
    expect(computeBaseQtyFromPacksLoose('0', '+2', 4)).toEqual({ qty: 0, freeQty: 2 })
  })
})

describe('formatBillQtyDisplay', () => {
  it('shows smallest units sold+free', () => {
    expect(formatBillQtyDisplay('4', '0+3', 4)).toBe('16+3')
  })
  it('shows simple sold + free in base units when pack size is 1', () => {
    expect(formatBillQtyDisplay('50', '+10', 1)).toBe('50+10')
  })
})

describe('formatInvoiceTotalQtyBase', () => {
  it('sums sold and free base units across lines', () => {
    const items = [
      { packs_display: '4', loose_display: '0+3', pack_size: 4, qty: 16, free_qty: 3 },
      { packs_display: '3', loose_display: '0+2', pack_size: 5, qty: 15, free_qty: 2 },
    ]
    expect(formatInvoiceTotalQtyBase(items)).toBe('31+5')
  })
})

describe('formatBillQtyBaseUnits', () => {
  it('formats without spaces around plus', () => {
    expect(formatBillQtyBaseUnits(27, 5)).toBe('27+5')
    expect(formatBillQtyBaseUnits(12, 0)).toBe('12')
  })
})

describe('formatBillQtyStripsMode', () => {
  it('decomposes loose-only entry into str shorthand', () => {
    expect(formatBillQtyStripsMode(8, 0, 4)).toBe('2 str')
  })
  it('shows str and remainder tabs separated by hyphen', () => {
    expect(formatBillQtyStripsMode(11, 0, 4)).toBe('2 str-3 tab')
  })
  it('appends free qty decomposed into str/tab', () => {
    expect(formatBillQtyStripsMode(8, 3, 4)).toBe('2 str+3 tab')
  })
  it('decomposes large scheme qty into strips and tabs', () => {
    expect(formatBillQtyStripsMode(113, 24, 10)).toBe('11 str-3 tab+2 str-4 tab')
  })
  it('falls back to base units when pack size is 1', () => {
    expect(formatBillQtyStripsMode(5, 0, 1)).toBe('5')
  })
})

describe('formatBillQtyStripsModeLines', () => {
  it('splits str-tab+str-tab at the plus sign', () => {
    expect(formatBillQtyStripsModeLines(113, 24, 10)).toEqual(['11 str-3 tab', '+2 str-4 tab'])
  })
  it('shows scheme-only when sold is zero', () => {
    expect(formatBillQtyStripsModeLines(0, 24, 10)).toEqual(['+2 str-4 tab'])
  })
})

describe('formatBillQtyForOutlet', () => {
  it('joins sold and scheme as str-tab+str-tab on one line', () => {
    expect(
      formatBillQtyForOutlet({
        mode: 'pack_and_loose',
        qty: 113,
        freeQty: 24,
        packSize: 10,
      }),
    ).toBe('11 str-3 tab+2 str-4 tab')
  })
})

describe('formatBillQtyBaseUnitsLines', () => {
  it('splits sold and scheme for invoice rows', () => {
    expect(formatBillQtyBaseUnitsLines(113, 24)).toEqual(['113', '+24'])
  })
})

describe('formatBillQtyForOutletLines', () => {
  it('uses strips lines when outlet mode is pack_and_loose', () => {
    expect(
      formatBillQtyForOutletLines({
        mode: 'pack_and_loose',
        qty: 113,
        freeQty: 24,
        packSize: 10,
      }),
    ).toEqual(['11 str-3 tab', '+2 str-4 tab'])
  })
})

describe('formatBillQtyForOutlet', () => {
  it('uses base units mode by default', () => {
    expect(
      formatBillQtyForOutlet({ packs: '0', loose: '8', packSize: 4 }),
    ).toBe('8')
  })
  it('uses strips mode when configured', () => {
    expect(
      formatBillQtyForOutlet({
        mode: 'pack_and_loose',
        packs: '0',
        loose: '8',
        packSize: 4,
      }),
    ).toBe('2 str')
  })
  it('decomposes qty-only reprint lines', () => {
    expect(
      formatBillQtyForOutlet({
        mode: 'pack_and_loose',
        qty: 8,
        packSize: 4,
      }),
    ).toBe('2 str')
  })
})

describe('medicine names', () => {
  const med = { name: 'Nick ABC', name_on_bill: 'Bill XYZ' }
  it('nick vs bill alias vs bill print name', () => {
    expect(medicineNickName(med)).toBe('Nick ABC')
    expect(medicineBillAlias(med)).toBe('Bill XYZ')
    expect(medicineBillName(med)).toBe('Bill XYZ')
  })
  it('hides alias when same as nick', () => {
    const m = { name: 'Same', name_on_bill: 'same' }
    expect(medicineBillAlias(m)).toBe('')
    expect(medicineBillName(m)).toBe('Same')
  })
})

describe('normalizeDiscountPercentInput', () => {
  it('empty becomes 0 immediately', () => {
    expect(normalizeDiscountPercentInput('', '10')).toBe('0')
    expect(normalizeDiscountPercentInput('', '1')).toBe('0')
  })
  it('strips leading zero when typing on 0', () => {
    expect(normalizeDiscountPercentInput('5', '0')).toBe('5')
    expect(normalizeDiscountPercentInput('05', '0')).toBe('5')
  })
})
