import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import CategoryRulesSection from './CategoryRulesSection'
import {
  buildChannelPatchPayload,
  emptyChannelForm,
  normalizeOutletFormsFromApi,
  normalizeOutletSettingsFromApi,
} from './outletSettingsUtils'

const OUTLET_FIELDS = [
  ['address', 'Address (multiline)', true],
  ['mobile', 'Mobile'],
  ['gst_number', 'GST number'],
  ['default_gst_percent', 'Default GST % (sales & purchase rows)'],
  ['dl_number', 'D.L. number'],
  ['email', 'Email'],
  ['website', 'Website'],
]

const EMPTY_FORMS = {
  business_name: '',
  b2b_enabled: false,
  b2c: emptyChannelForm(),
  b2b: emptyChannelForm(),
}

function isSettingsPatch(value) {
  if (!value || typeof value !== 'object') return false
  if (typeof value.preventDefault === 'function') return false
  return true
}

function formsEqual(a, b) {
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function OutletSettingsFields({ form, setForm, signatureFile, setSignatureFile, includeB2cOnly }) {
  return (
    <>
      <h3 className="text-xs font-bold text-slate-700 mb-2">Outlet &amp; invoice details</h3>
      <div className="space-y-2 max-w-xl">
        {OUTLET_FIELDS.map(([key, label, multiline]) =>
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
          ),
        )}
        {includeB2cOnly ? (
          <label className="block">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">
              Default sale discount % (new medicine — B to C inventory)
            </span>
            <input
              value={form.default_sale_discount_percent}
              onChange={(e) => setForm({ ...form, default_sale_discount_percent: e.target.value })}
              className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
        <label className="block">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Invoice Prefix</span>
          <input
            value={form.invoice_prefix}
            onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })}
            className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
            maxLength={20}
            placeholder="INV"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Next Invoice Number</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.invoice_next_number}
            onChange={(e) => setForm({ ...form, invoice_next_number: e.target.value })}
            className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
            placeholder="1"
          />
        </label>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        Example: {`${form.invoice_prefix || 'INV'}${Math.max(1, Number(form.invoice_next_number || 1) || 1)}`}
      </p>

      <div className="mt-4 max-w-xl">
        <span className="text-[10px] font-semibold text-slate-500 uppercase">Default bill type on Sales</span>
        <div className="mt-1 flex rounded border border-slate-200 overflow-hidden w-fit text-[11px]">
          <button
            type="button"
            onClick={() => setForm({ ...form, default_sale_gst_enabled: true })}
            className={`px-3 py-1 ${form.default_sale_gst_enabled ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
          >
            GST
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, default_sale_gst_enabled: false })}
            className={`px-3 py-1 border-l border-slate-200 ${!form.default_sale_gst_enabled ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
          >
            Non-GST
          </button>
        </div>
      </div>

      <div className="mt-4 max-w-xl">
        <span className="text-[10px] font-semibold text-slate-500 uppercase">Bill quantity display</span>
        <div className="mt-1 flex rounded border border-slate-200 overflow-hidden w-fit text-[11px]">
          <button
            type="button"
            onClick={() => setForm({ ...form, sale_bill_qty_display: 'base_units' })}
            className={`px-3 py-1 ${form.sale_bill_qty_display !== 'pack_and_loose' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
          >
            Units
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, sale_bill_qty_display: 'pack_and_loose' })}
            className={`px-3 py-1 border-l border-slate-200 ${form.sale_bill_qty_display === 'pack_and_loose' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
          >
            Strips &amp; loose
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          8 tablets, pack 4 →{' '}
          <strong>{form.sale_bill_qty_display === 'pack_and_loose' ? '2 str' : '8'}</strong>
        </p>
      </div>

      <div className="mt-6 max-w-xl space-y-2 border-t border-slate-200 pt-4">
        <h3 className="text-xs font-bold text-slate-700">Bank details (invoice footer)</h3>
        {[
          ['bank_name', 'Bank name'],
          ['bank_branch', 'Branch name'],
          ['bank_account_no', 'Account number'],
          ['bank_ifsc', 'IFSC code'],
        ].map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">{label}</span>
            <input
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Terms &amp; conditions (one line per row)</span>
          <textarea
            value={form.invoice_terms}
            onChange={(e) => setForm({ ...form, invoice_terms: e.target.value })}
            rows={4}
            placeholder="Leave blank for default terms on the bill"
            className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Authorised signature image</span>
          {form.signature_url ? (
            <img src={form.signature_url} alt="Signature" className="mt-1 max-h-16 object-contain border border-slate-200 rounded" />
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
            className="mt-1 w-full text-xs"
          />
        </label>
      </div>

      {includeB2cOnly ? (
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
              <span className="text-[10px] text-slate-500">B to C inventory low-stock alerts</span>
            </div>
          </label>
        </div>
      ) : null}
    </>
  )
}

const SettingsPanelInner = forwardRef(function SettingsPanelInner({ mode = 'b2c', onSaved, onDirtyChange }, ref) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [forms, setForms] = useState(EMPTY_FORMS)
  const [savedForms, setSavedForms] = useState(EMPTY_FORMS)
  const [signatureFile, setSignatureFile] = useState(null)
  const [applyToBoth, setApplyToBoth] = useState(false)

  const isB2bMode = mode === 'b2b'
  const channelKey = isB2bMode ? 'b2b' : 'b2c'

  const setChannelForm = useCallback(
    (updater) => {
      setForms((prev) => {
        const nextChannel = typeof updater === 'function' ? updater(prev[channelKey]) : updater
        return { ...prev, [channelKey]: nextChannel }
      })
    },
    [channelKey],
  )

  const isDirty = useMemo(
    () => Boolean(signatureFile) || !formsEqual(forms, savedForms),
    [forms, savedForms, signatureFile],
  )

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    let cancelled = false
    api
      .get('/pharmacy/settings/')
      .then((res) => {
        const raw = res.data
        const d = normalizeOutletSettingsFromApi(raw) || raw?.data || raw?.entity || raw
        if (!cancelled && d) {
          const normalized = normalizeOutletFormsFromApi(d)
          setForms(normalized)
          setSavedForms(normalized)
        }
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

  const save = useCallback(
    async (partial = null) => {
      const patch = isSettingsPatch(partial) ? partial : null
      const merged = patch
        ? {
            ...forms,
            ...patch,
            b2c: patch.b2c ? { ...forms.b2c, ...patch.b2c } : forms.b2c,
            b2b: patch.b2b ? { ...forms.b2b, ...patch.b2b } : forms.b2b,
          }
        : forms
      const activeChannel = channelKey
      const toggleOnly =
        patch && Object.keys(patch).length === 1 && patch.b2b_enabled !== undefined
      setSaving(true)
      try {
        const channelPayload = buildChannelPatchPayload(merged[activeChannel], {
          includeB2cOnly: activeChannel === 'b2c',
        })
        const body = toggleOnly
          ? { b2b_enabled: merged.b2b_enabled }
          : {
              business_name: merged.business_name,
              b2b_enabled: merged.b2b_enabled,
              mode: activeChannel,
              apply_to_both: applyToBoth,
              [activeChannel]: channelPayload,
            }
        let responseData = null
        if (signatureFile) {
          const fd = new FormData()
          fd.append('business_name', body.business_name || '')
          fd.append('b2b_enabled', String(!!body.b2b_enabled))
          fd.append('mode', body.mode)
          fd.append('apply_to_both', String(!!body.apply_to_both))
          fd.append(activeChannel, JSON.stringify(channelPayload))
          fd.append(`${activeChannel}_signature`, signatureFile)
          const res = await api.patch('/pharmacy/settings/', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          responseData = res.data
        } else {
          const res = await api.patch('/pharmacy/settings/', body)
          responseData = res.data
        }
        setSignatureFile(null)
        setApplyToBoth(false)
        const fromApi = normalizeOutletSettingsFromApi(responseData) || responseData?.data || responseData
        const normalized = fromApi ? normalizeOutletFormsFromApi(fromApi) : merged
        setForms(normalized)
        setSavedForms(normalized)
        toast.success('Settings saved')
        onSaved?.(fromApi || normalized)
        return true
      } catch {
        toast.error('Save failed')
        return false
      } finally {
        setSaving(false)
      }
    },
    [forms, signatureFile, channelKey, applyToBoth, onSaved],
  )

  const discardChanges = useCallback(() => {
    setForms(savedForms)
    setSignatureFile(null)
    setApplyToBoth(false)
  }, [savedForms])

  useImperativeHandle(
    ref,
    () => ({
      save,
      discardChanges,
      isDirty: () => isDirty,
    }),
    [save, discardChanges, isDirty],
  )

  if (loading) {
    return <div className="text-xs text-slate-500 p-4">Loading settings…</div>
  }

  const retailActive = !forms.b2b_enabled
  const wholesaleActive = forms.b2b_enabled

  return (
    <div className="h-full flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 max-w-4xl space-y-8">
        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-1">
            {isB2bMode ? 'B to B settings' : 'B to C settings'}
          </h2>
          <p className="text-[10px] text-slate-500 mb-3">
            {isB2bMode
              ? 'Wholesale / party sales letterhead and invoice defaults.'
              : 'Retail patient sales, inventory alerts, and customer display.'}
          </p>

          <label className="block max-w-xl mb-4 p-3 rounded-lg border border-slate-200 bg-slate-50/80">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">
              Business name (shared for B to B and B to C)
            </span>
            <input
              value={forms.business_name}
              onChange={(e) => setForms({ ...forms, business_name: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded px-2 py-1.5 text-sm font-semibold"
            />
          </label>

          {isB2bMode && retailActive && (
            <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50/80">
              <p className="text-[10px] text-slate-600 mb-2">B to C is active. Switch to party (B to B) sales?</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ b2b_enabled: true })}
                className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Enable B to B
              </button>
            </div>
          )}

          {!isB2bMode && wholesaleActive && (
            <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50/80">
              <p className="text-[10px] text-slate-600 mb-2">B to B is active. Switch back to patient (B to C) sales?</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ b2b_enabled: false })}
                className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                Enable B to C
              </button>
            </div>
          )}

          <OutletSettingsFields
            form={forms[channelKey]}
            setForm={setChannelForm}
            signatureFile={signatureFile}
            setSignatureFile={setSignatureFile}
            includeB2cOnly={!isB2bMode}
          />
        </section>

        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-1">Categories</h2>
          <p className="text-[10px] text-slate-500 mb-3">
            Shared — changes apply to all inventory and sales (B to B and B to C).
          </p>
          <CategoryRulesSection />
        </section>

        {!isB2bMode && (
          <section>
            <h2 className="text-sm font-bold text-slate-800 mb-3">Sales Display</h2>
            <p className="text-xs text-slate-500 mb-3">Customer-facing screen for the current bill (B to C).</p>
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
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={applyToBoth}
            onChange={(e) => setApplyToBoth(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>Apply these settings to both B to B and B to C</span>
        </label>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-[10px] text-slate-500">
            {isDirty ? (
              <span className="text-amber-700 font-semibold">Unsaved changes</span>
            ) : (
              <span>All changes saved</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => save()}
            disabled={saving}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isB2bMode ? 'Save B to B settings' : 'Save B to C settings'}
          </button>
        </div>
      </div>
    </div>
  )
})

export default memo(SettingsPanelInner)

export function UnsavedSettingsDialog({ open, saving, onDiscard, onSave, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={!saving ? onCancel : undefined} />
      <div className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Unsaved settings</h3>
          <p className="text-xs text-slate-500 mt-1">
            You changed pharmacy settings but have not saved yet. Save your changes or discard them before leaving?
          </p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
          >
            Stay on settings
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
