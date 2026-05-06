import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { parseApiError } from './pharmacyCalculations'
import { useDebouncedValue } from './useDebouncedValue'

function normalizeList(res) {
  const d = res?.data
  if (!d) return []
  const raw = d.data ?? d.results ?? d
  return Array.isArray(raw) ? raw : []
}

function normalizeEntity(data) {
  return data?.data ?? data?.entity ?? data ?? null
}

/**
 * Search /pharmacy/suppliers/ and quick-create party for purchase / sales header.
 */
export function PurchaseSupplierPicker({ supplierId, supplierName, onChange, required }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 280)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', phone: '', address: '', gst_number: '' })
  const wrapRef = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const term = debouncedQ.trim()
    const url =
      term.length >= 1
        ? `/pharmacy/suppliers/?search=${encodeURIComponent(term)}`
        : `/pharmacy/suppliers/`
    api
      .get(url)
      .then((res) => {
        if (!cancelled) setResults(normalizeList(res))
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, open])

  useEffect(() => {
    if (open) setQ(supplierName || '')
  }, [open, supplierName])

  async function createSupplier() {
    if (!createForm.name.trim()) {
      toast.error('Party name is required')
      return
    }
    setCreating(true)
    try {
      const { data } = await api.post('/pharmacy/suppliers/', {
        name: createForm.name.trim(),
        phone: createForm.phone.trim(),
        address: createForm.address.trim(),
        gst_number: createForm.gst_number.trim(),
      })
      const row = normalizeEntity(data)
      const id = row?.id
      const name = row?.name || createForm.name.trim()
      if (!id) throw new Error('Invalid API response')
      onChange(id, name)
      setShowCreate(false)
      setOpen(false)
      setCreateForm({ name: '', phone: '', address: '', gst_number: '' })
      toast.success('Party created')
    } catch (e) {
      toast.error(parseApiError(e))
    } finally {
      setCreating(false)
    }
  }

  const selectedLabel =
    supplierName || results.find((r) => r.id === supplierId)?.name || (supplierId ? '—' : '')

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <div className="flex gap-0.5 items-stretch">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 text-left border border-slate-200 rounded px-1 py-0.5 text-[10px] truncate bg-white hover:bg-slate-50"
          title={supplierId ? selectedLabel : 'Search party'}
        >
          {supplierId ? selectedLabel || 'Selected' : `Party${required ? ' *' : ''}…`}
        </button>
        <button
          type="button"
          title="New party"
          onClick={() => {
            setCreateForm((f) => ({ ...f, name: q.trim() || f.name }))
            setShowCreate(true)
            setOpen(false)
          }}
          className="shrink-0 px-0.5 border border-emerald-200 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        >
          <Plus size={14} className="mx-auto" />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-0.5 w-[min(18rem,85vw)] max-h-48 overflow-hidden flex flex-col bg-white border border-slate-200 shadow-lg rounded">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name / phone / GST…"
            className="w-full border-b border-slate-100 px-1.5 py-1 text-[10px] outline-none shrink-0"
          />
          <div className="overflow-y-auto flex-1 min-h-0">
            {loading && <div className="p-1.5 text-[9px] text-slate-400">Searching…</div>}
            {!loading &&
              results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full text-left px-1.5 py-1 text-[10px] hover:bg-blue-50 truncate border-b border-slate-50 last:border-0"
                  onClick={() => {
                    onChange(s.id, s.name)
                    setOpen(false)
                  }}
                >
                  {s.name}
                  {s.phone ? <span className="text-slate-400 text-[9px] ml-1">{s.phone}</span> : null}
                </button>
              ))}
            {!loading && results.length === 0 && (
              <div className="p-1.5 text-[9px] text-slate-500">No matches. Use + to add.</div>
            )}
          </div>
        </div>
      )}
      {showCreate &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4"
            onClick={() => !creating && setShowCreate(false)}
            onKeyDown={(e) => e.key === 'Escape' && !creating && setShowCreate(false)}
            role="presentation"
          >
            <div
              className="bg-white rounded-lg shadow-xl p-3 w-full max-w-sm border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="New party"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-800">New party</span>
                <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => !creating && setShowCreate(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">Name *</span>
                  <input
                    autoFocus
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">Phone</span>
                  <input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">Address</span>
                  <textarea
                    value={createForm.address}
                    onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
                    rows={2}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">GST</span>
                  <input
                    value={createForm.gst_number}
                    onChange={(e) => setCreateForm((f) => ({ ...f, gst_number: e.target.value }))}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={createSupplier}
                className="mt-3 w-full bg-emerald-600 text-white text-xs font-semibold py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? 'Saving…' : 'Create & select'}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
