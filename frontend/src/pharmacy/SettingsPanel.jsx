import React, { memo, useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import CategoryRulesSection from './CategoryRulesSection'

function SettingsPanelInner({ onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    business_name: '',
    address: '',
    mobile: '',
    gst_number: '',
    dl_number: '',
    email: '',
    website: '',
    default_gst_percent: '5',
    default_sale_discount_percent: '0',
    b2b_enabled: false,
    low_stock_threshold: '10',
  })

  useEffect(() => {
    let cancelled = false
    api
      .get('/pharmacy/settings/')
      .then((res) => {
        const raw = res.data
        const d = raw && typeof raw === 'object' && 'business_name' in raw ? raw : raw?.data ?? raw?.entity
        if (!cancelled && d)
          setForm((f) => ({
            ...f,
            business_name: d.business_name || '',
            address: d.address || '',
            mobile: d.mobile || '',
            gst_number: d.gst_number || '',
            dl_number: d.dl_number || '',
            email: d.email || '',
            website: d.website || '',
            default_gst_percent:
              d.default_gst_percent != null && d.default_gst_percent !== ''
                ? String(d.default_gst_percent)
                : '5',
            default_sale_discount_percent:
              d.default_sale_discount_percent != null && d.default_sale_discount_percent !== ''
                ? String(d.default_sale_discount_percent)
                : '0',
            b2b_enabled: !!d.b2b_enabled,
            low_stock_threshold:
              d.low_stock_threshold != null ? String(d.low_stock_threshold) : '10',
          }))
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load settings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setSaving(true)
    try {
      await api.patch('/pharmacy/settings/', form)
      toast.success('Settings saved')
      onSaved?.(form)
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-xs text-slate-500 p-4">Loading settings…</div>
  }

  const fields = [
    ['business_name', 'Business name'],
    ['address', 'Address (multiline)', true],
    ['mobile', 'Mobile'],
    ['gst_number', 'GST number'],
    ['default_gst_percent', 'Default GST % (sales & purchase rows)'],
    ['default_sale_discount_percent', 'Default sale discount % (new medicine)'],
    ['dl_number', 'D.L. number'],
    ['email', 'Email'],
    ['website', 'Website'],
  ]

  return (
    <div className="h-full overflow-y-auto p-4 max-w-4xl space-y-8">
      <section>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Pharmacy outlet & invoice header</h2>
      <div className="space-y-2 max-w-xl">
        {fields.map(([key, label, multiline]) =>
          multiline ? (
            <label key={key} className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">{label}</span>
              <textarea
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                rows={3}
                className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </label>
          ) : (
            <label key={key} className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </label>
          )
        )}
      </div>
      <div className="mt-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.b2b_enabled}
            onChange={(e) => setForm({ ...form, b2b_enabled: e.target.checked })}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-xs font-semibold text-slate-700">Enable B2B Sales</span>
        </label>
        <p className="mt-0.5 text-[10px] text-slate-500 ml-6">
          When enabled, the Sales tab will show a party picker instead of a patient search, allowing you to sell to business customers.
        </p>
      </div>
      <div className="mt-4 max-w-xs">
        <label className="block">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Low Stock Threshold (units)</span>
          <div className="flex items-center gap-2 mt-0.5">
            <input
              type="number"
              min="0"
              step="1"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              className="w-28 border border-slate-200 rounded px-2 py-1 text-xs"
            />
            <span className="text-[10px] text-slate-500">Medicines below this stock are flagged as low stock</span>
          </div>
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded"
      >
        {saving ? 'Saving…' : 'Save settings'}
      </button>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Categories</h2>
        <CategoryRulesSection />
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Sales Display</h2>
        <p className="text-xs text-slate-500 mb-3">
          Open this link on a customer-facing screen to show the current bill in real time.
        </p>
        <div className="flex items-center gap-2 max-w-xl">
          <input
            readOnly
            value={`${window.location.origin}/pharmacy-display`}
            className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50 text-slate-700 select-all"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() =>
              navigator.clipboard
                .writeText(`${window.location.origin}/pharmacy-display`)
                .then(() => toast.success('Link copied'))
                .catch(() => toast.error('Copy failed'))
            }
            className="shrink-0 border border-slate-200 rounded px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => window.open('/pharmacy-display', '_blank')}
            className="shrink-0 bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            Open
          </button>
        </div>
      </section>
    </div>
  )
}

export default memo(SettingsPanelInner)
