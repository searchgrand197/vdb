/** Nested outlet settings mock for pharmacy stress tests. */
export function mockPharmacyOutletSettings(overrides = {}) {
  const channel = {
    address: '',
    mobile: '',
    gst_number: '',
    dl_number: '',
    email: '',
    website: '',
    invoice_prefix: 'INV',
    invoice_next_number: 1,
    default_gst_percent: '5',
    default_sale_discount_percent: '0',
    default_sale_gst_enabled: false,
    sale_bill_qty_display: 'base_units',
    low_stock_threshold: 10,
    bank_name: '',
    bank_branch: '',
    bank_account_no: '',
    bank_ifsc: '',
    invoice_terms: '',
    signature_url: '',
  }
  return {
    business_name: 'Default Hospital',
    b2b_enabled: false,
    b2c: { ...channel },
    b2b: { ...channel, invoice_prefix: 'WHL' },
    ...overrides,
  }
}
