import React, { useState, useEffect, useRef } from 'react'
import { X, Search, Plus, Trash2, Store, CheckCircle, Loader2, Pill, ArrowRight } from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { useDebouncedValue } from '../pharmacy/useDebouncedValue'
import { pickDefaultPharmacyBranchId } from '../pharmacy/rxConstants'

export default function DraftPrescriptionModal({ patient, admissionId, onClose, onSave }) {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)

  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/auth/pharmacies/')
      .then(res => {
        const list = res.data?.data || res.data?.results || []
        setBranches(list)
        if (list.length > 0) setBranchId(pickDefaultPharmacyBranchId(list))
      })
      .catch(() => toast.error('Failed to load pharmacy branches'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!branchId || debouncedSearch.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    // Use dedicated doctor-stock-search endpoint — takes hospital_id as query param,
    // no X-Pharmacy-Branch header needed, works from any role.
    api.get('/pharmacy/doctor-stock-search/', {
      params: { hospital_id: branchId, q: debouncedSearch },
    })
      .then(res => {
        const raw = res.data?.data || res.data
        setSearchResults(Array.isArray(raw) ? raw : [])
      })
      .catch(() => {
        setSearchResults([])
        toast.error('Search failed — check pharmacy branch selection')
      })
      .finally(() => setSearching(false))
  }, [debouncedSearch, branchId])

  const handleAddItem = (pick) => {
    if (items.some(i => String(i.batch.id) === String(pick.batch.id))) {
      toast.error('Medicine already added')
      return
    }
    setItems(prev => [...prev, { ...pick, qty: 1, days: 1, timing: 'AF' }])
    setSearch('')
    setSearchResults([])
    searchRef.current?.focus()
  }

  const updateField = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const TIMING_OPTIONS = [
    { value: 'AF', label: 'After Food' },
    { value: 'BF', label: 'Before Food' },
    { value: 'EM', label: 'Empty Stomach' },
    { value: 'MW', label: 'With Milk/Water' },
    { value: 'BD', label: 'Twice Daily' },
    { value: 'TID', label: 'Three Times' },
    { value: 'QID', label: 'Four Times' },
    { value: 'HS', label: 'At Bedtime' },
    { value: 'SOS', label: 'As Needed (SOS)' },
  ]

  const handleSave = async () => {
    if (items.length === 0) return toast.error('Add at least one medicine')
    const finalItems = items.map(i => ({ ...i, qty: Number(i.qty) || 0 })).filter(i => i.qty > 0)
    if (finalItems.length === 0) return toast.error('Quantities must be greater than 0')

    setSaving(true)
    try {
      const selectedBranchName = branches.find(b => String(b.id) === String(branchId))?.name || branchId
      const rxLines = finalItems.map(i => {
        const timing = TIMING_OPTIONS.find(t => t.value === i.timing)?.label || i.timing
        return `${i.medicine.name} x${i.qty} | ${timing} | ${i.days} day${Number(i.days) > 1 ? 's' : ''}`
      })
      const remarks = `Doctor Prescription (Branch: ${selectedBranchName}):\n${rxLines.join('\n')}`

      // Single atomic request — creates invoice + all items in one DB transaction.
      // We pass X-Pharmacy-Branch explicitly so the backend middleware scopes the
      // invoice to the correct pharmacy branch (doctors don't have role=pharmacy
      // in localStorage, so the global interceptor won't attach this header).
      await api.post(
        '/pharmacy/invoices/create-draft/',
        {
          patient: patient.id,
          ipd_admission: admissionId || null,
          remarks,
          items: finalItems.map(item => ({
            medicine: item.medicine.id,
            batch: item.batch.id,
            qty: item.qty,
            mrp: item.batch.mrp,
            rate: item.batch.sale_rate,
            amount: (Number(item.qty) * Number(item.batch.sale_rate)).toFixed(2),
          })),
        },
        { headers: { 'X-Pharmacy-Branch': branchId } }
      )

      toast.success(`✅ Draft sent to ${selectedBranchName} with ${finalItems.length} medicine(s)!`)
      onSave()
    } catch (e) {
      const detail = e?.response?.data?.detail
        || e?.response?.data?.non_field_errors?.[0]
        || e?.message
        || 'Failed to save draft'
      toast.error(detail, { duration: 6000 })
    } finally {
      setSaving(false)
    }
  }


  const selectedBranch = branches.find(b => String(b.id) === String(branchId))

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-3">
      <div
        className="bg-white w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        style={{ maxWidth: '860px', maxHeight: '90vh' }}
      >

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
              <Pill size={18} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Draft Pharmacy Prescription</h3>
              <p className="text-[11px] text-slate-500">For: <span className="font-semibold text-slate-700">{patient?.name || 'Patient'}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Branch Selector */}
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3 shrink-0">
          <Store size={15} className="text-slate-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0">Branch:</span>
          {loading ? (
            <div className="h-7 bg-slate-200 animate-pulse rounded-lg flex-1 max-w-xs" />
          ) : (
            <select
              value={branchId}
              onChange={e => { setBranchId(e.target.value); setItems([]); setSearch(''); setSearchResults([]) }}
              className="h-7 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 max-w-xs"
            >
              {branches.length === 0 && <option value="">No branches available</option>}
              {branches.map(b => <option key={b.id} value={b.id}>{b.label || b.name}</option>)}
            </select>
          )}
          {selectedBranch && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
              {selectedBranch.label || selectedBranch.name}
            </span>
          )}
        </div>

        {/* Two-column body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* LEFT: Search panel */}
          <div className="flex flex-col w-1/2 border-r border-slate-100 min-h-0">
            <div className="p-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  disabled={!branchId}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search medicine by name..."
                  autoFocus
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:bg-slate-50 placeholder:text-slate-400"
                />
                {searching && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" />
                )}
              </div>
              {search.length > 0 && search.length < 2 && (
                <p className="text-[10px] text-slate-400 mt-1 pl-1">Type at least 2 characters to search...</p>
              )}
            </div>

            {/* Results list (not a dropdown, always visible below search) */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {search.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400">
                  <Search size={36} className="mb-3 opacity-30" />
                  <p className="text-[12px] font-medium">Search medicines from stock</p>
                  <p className="text-[11px] mt-1 text-slate-400">Type a medicine name above</p>
                </div>
              ) : searching ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  <span className="text-[12px]">Searching pharmacy stock...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Pill size={30} className="mb-2 opacity-30" />
                  <p className="text-[12px] font-medium">No medicines found</p>
                  <p className="text-[10px] mt-1">Try a different name or check branch</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {searchResults.map((pick, i) => {
                    const alreadyAdded = items.some(it => String(it.batch.id) === String(pick.batch.id))
                    return (
                      <button
                        key={i}
                        onClick={() => !alreadyAdded && handleAddItem(pick)}
                        disabled={alreadyAdded}
                        className={`w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors ${
                          alreadyAdded
                            ? 'opacity-50 cursor-not-allowed bg-slate-50'
                            : 'hover:bg-emerald-50 cursor-pointer'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Pill size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-slate-900 truncate">{pick.medicine.name}</div>
                          <div className="flex gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              {pick.batch.batch_no}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              Number(pick.batch.stock) > 10
                                ? 'bg-green-100 text-green-700'
                                : Number(pick.batch.stock) > 0
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}>
                              Stock: {pick.batch.stock}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[12px] font-bold text-emerald-700">₹{Number(pick.batch.sale_rate).toFixed(2)}</div>
                          {alreadyAdded ? (
                            <span className="text-[9px] text-slate-400">Added</span>
                          ) : (
                            <div className="flex items-center gap-0.5 text-[9px] text-emerald-600 font-semibold mt-0.5">
                              <Plus size={9} /> Add
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Added items */}
          <div className="flex flex-col w-1/2 min-h-0">
            <div className="px-3 py-2.5 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Prescription</span>
                {items.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                )}
              </div>
              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <ArrowRight size={24} className="opacity-40" />
                  </div>
                  <p className="text-[12px] font-medium">No medicines added</p>
                  <p className="text-[11px] mt-1 text-slate-400">Search & click to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-emerald-300 transition-colors overflow-hidden"
                    >
                      {/* Medicine name + delete */}
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                        <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Pill size={11} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-slate-900 truncate">{item.medicine.name}</div>
                          <div className="text-[9px] text-slate-400 font-mono">₹{Number(item.batch.sale_rate).toFixed(2)}/unit</div>
                        </div>
                        <button
                          onClick={() => removeItem(idx)}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>

                      {/* Qty / Days / Timing row */}
                      <div className="grid grid-cols-3 gap-0 border-t border-slate-100 divide-x divide-slate-100">
                        {/* Qty */}
                        <div className="flex flex-col items-center px-2 py-1.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Qty</span>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => updateField(idx, 'qty', e.target.value)}
                            className="w-full h-6 rounded border border-slate-200 text-[11px] font-bold text-center outline-none focus:border-emerald-500 bg-white"
                          />
                        </div>

                        {/* Days */}
                        <div className="flex flex-col items-center px-2 py-1.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Days</span>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={item.days}
                            onChange={e => updateField(idx, 'days', e.target.value)}
                            className="w-full h-6 rounded border border-slate-200 text-[11px] font-bold text-center outline-none focus:border-blue-500 bg-white"
                          />
                        </div>

                        {/* Timing */}
                        <div className="flex flex-col items-center px-1 py-1.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Timing</span>
                          <select
                            value={item.timing}
                            onChange={e => updateField(idx, 'timing', e.target.value)}
                            className="w-full h-6 rounded border border-slate-200 text-[9px] font-bold outline-none focus:border-purple-500 bg-white text-center cursor-pointer"
                          >
                            {TIMING_OPTIONS.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Summary tag */}
                      <div className="px-3 pb-2 pt-0.5">
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
                          {item.qty} unit × {item.days} day{Number(item.days) > 1 ? 's' : ''} · {TIMING_OPTIONS.find(t => t.value === item.timing)?.label || item.timing}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            {items.length > 0
              ? `${items.length} medicine(s) · Total: ₹${items.reduce((s, i) => s + (Number(i.qty) || 0) * Number(i.batch.sale_rate), 0).toFixed(2)}`
              : 'No medicines added yet'
            }
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-[12px] font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || items.length === 0}
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Send to Pharmacy
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
