/** Resolve nested pharmacy outlet settings for a sales channel. */

export function normalizeOutletSettingsFromApi(d) {
  if (!d || typeof d !== 'object') return null
  const root = d.business_name != null && d.b2c && d.b2b ? d : d.data ?? d.entity
  if (!root || typeof root !== 'object') return null
  if (!root.b2c || !root.b2b) return null
  return root
}

export function emptyChannelForm() {
  return {
    address: '',
    mobile: '',
    gst_number: '',
    dl_number: '',
    email: '',
    website: '',
    invoice_prefix: 'INV',
    invoice_next_number: '1',
    default_gst_percent: '5',
    default_sale_discount_percent: '0',
    default_sale_gst_enabled: false,
    sale_bill_qty_display: 'base_units',
    low_stock_threshold: '10',
    bank_name: '',
    bank_branch: '',
    bank_account_no: '',
    bank_ifsc: '',
    invoice_terms: '',
    signature_url: '',
  }
}

function normalizeChannelFromApi(ch, { includeB2cOnly = false } = {}) {
  const base = emptyChannelForm()
  if (!ch || typeof ch !== 'object') return base
  const out = {
    ...base,
    address: ch.address || '',
    mobile: ch.mobile || '',
    gst_number: ch.gst_number || '',
    dl_number: ch.dl_number || '',
    email: ch.email || '',
    website: ch.website || '',
    invoice_prefix: String(ch.invoice_prefix || 'INV'),
    invoice_next_number:
      ch.invoice_next_number != null && ch.invoice_next_number !== ''
        ? String(ch.invoice_next_number)
        : '1',
    default_gst_percent:
      ch.default_gst_percent != null && ch.default_gst_percent !== ''
        ? String(ch.default_gst_percent)
        : '5',
    default_sale_gst_enabled: !!ch.default_sale_gst_enabled,
    sale_bill_qty_display:
      ch.sale_bill_qty_display === 'pack_and_loose' ? 'pack_and_loose' : 'base_units',
    bank_name: ch.bank_name || '',
    bank_branch: ch.bank_branch || '',
    bank_account_no: ch.bank_account_no || '',
    bank_ifsc: ch.bank_ifsc || '',
    invoice_terms: ch.invoice_terms || '',
    signature_url: ch.signature_url || '',
  }
  if (includeB2cOnly) {
    out.default_sale_discount_percent =
      ch.default_sale_discount_percent != null && ch.default_sale_discount_percent !== ''
        ? String(ch.default_sale_discount_percent)
        : '0'
    out.low_stock_threshold =
      ch.low_stock_threshold != null ? String(ch.low_stock_threshold) : '10'
  }
  return out
}

export function normalizeOutletFormsFromApi(d) {
  const root = normalizeOutletSettingsFromApi(d) || d
  return {
    business_name: root?.business_name || '',
    b2b_enabled: !!root?.b2b_enabled,
    b2c: normalizeChannelFromApi(root?.b2c, { includeB2cOnly: true }),
    b2b: normalizeChannelFromApi(root?.b2b),
  }
}

/** Flat outlet object for billing, print, and purchase (legacy field names). */
export function resolveOutletForChannel(outlet, channel = 'b2c') {
  if (!outlet || typeof outlet !== 'object') return {}
  const ch = channel === 'b2b' ? 'b2b' : 'b2c'
  const prof = outlet[ch] && typeof outlet[ch] === 'object' ? outlet[ch] : outlet
  return {
    business_name: outlet.business_name || prof.business_name || '',
    b2b_enabled: outlet.b2b_enabled,
    address: prof.address || '',
    mobile: prof.mobile || '',
    gst_number: prof.gst_number || '',
    dl_number: prof.dl_number || '',
    email: prof.email || '',
    website: prof.website || '',
    invoice_prefix: prof.invoice_prefix || 'INV',
    invoice_next_number: prof.invoice_next_number ?? 1,
    default_gst_percent: prof.default_gst_percent ?? '5',
    default_sale_discount_percent: prof.default_sale_discount_percent ?? '0',
    default_sale_gst_enabled: !!prof.default_sale_gst_enabled,
    sale_bill_qty_display: prof.sale_bill_qty_display || 'base_units',
    low_stock_threshold: prof.low_stock_threshold ?? 10,
    bank_name: prof.bank_name || '',
    bank_branch: prof.bank_branch || '',
    bank_account_no: prof.bank_account_no || '',
    bank_ifsc: prof.bank_ifsc || '',
    invoice_terms: prof.invoice_terms || '',
    signature_url: prof.signature_url || '',
  }
}

export function invoiceOutletChannel(invoice) {
  if (!invoice) return 'b2c'
  if (invoice.party || invoice.party_id || invoice.party_details) return 'b2b'
  return 'b2c'
}

export function buildChannelPatchPayload(channelForm, { includeB2cOnly = false } = {}) {
  const payload = {
    address: channelForm.address,
    mobile: channelForm.mobile,
    gst_number: channelForm.gst_number,
    dl_number: channelForm.dl_number,
    email: channelForm.email,
    website: channelForm.website,
    invoice_prefix: String(channelForm.invoice_prefix || 'INV').trim() || 'INV',
    invoice_next_number: Math.max(1, Number(channelForm.invoice_next_number || 1) || 1),
    default_gst_percent: channelForm.default_gst_percent,
    default_sale_gst_enabled: !!channelForm.default_sale_gst_enabled,
    sale_bill_qty_display: channelForm.sale_bill_qty_display || 'base_units',
    bank_name: channelForm.bank_name,
    bank_branch: channelForm.bank_branch,
    bank_account_no: channelForm.bank_account_no,
    bank_ifsc: channelForm.bank_ifsc,
    invoice_terms: channelForm.invoice_terms,
  }
  if (includeB2cOnly) {
    payload.default_sale_discount_percent = channelForm.default_sale_discount_percent
    payload.low_stock_threshold = Math.max(0, Number(channelForm.low_stock_threshold || 0) || 0)
  }
  return payload
}
