import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { parseApiError } from './pharmacyCalculations'
import { useDebouncedValue } from './useDebouncedValue'

const EMPTY_FORM = { name: '', phone: '', address: '', gst_number: '', dl_number: '' }

function normalizeList(res) {
  const d = res?.data
  if (!d) return []
  const raw = d.data ?? d.results ?? d
  return Array.isArray(raw) ? raw : []
}

function normalizeEntity(data) {
  return data?.data ?? data?.entity ?? data ?? null
}

export default function PartiesView() {
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  // Add / Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchParties = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const url = q.trim()
        ? `/pharmacy/suppliers/?search=${encodeURIComponent(q.trim())}`
        : `/pharmacy/suppliers/`
      const res = await api.get(url)
      setParties(normalizeList(res))
    } catch {
      toast.error('Failed to load parties')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchParties(debouncedSearch)
  }, [debouncedSearch, fetchParties])

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(party) {
    setEditingId(party.id)
    setForm({
      name: party.name || '',
      phone: party.phone || '',
      address: party.address || '',
      gst_number: party.gst_number || '',
      dl_number: party.dl_number || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Party name is required')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const { data } = await api.patch(`/pharmacy/suppliers/${editingId}/`, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          gst_number: form.gst_number.trim(),
          dl_number: form.dl_number.trim(),
        })
        const updated = normalizeEntity(data)
        setParties((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...updated } : p)))
        toast.success('Party updated')
      } else {
        const { data } = await api.post('/pharmacy/suppliers/', {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          gst_number: form.gst_number.trim(),
          dl_number: form.dl_number.trim(),
        })
        const created = normalizeEntity(data)
        if (created?.id) setParties((prev) => [created, ...prev])
        toast.success('Party added')
      }
      setModalOpen(false)
    } catch (e) {
      toast.error(parseApiError(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/pharmacy/suppliers/${deleteTarget.id}/`)
      setParties((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      toast.success('Party deleted')
      setDeleteTarget(null)
    } catch (e) {
      toast.error(parseApiError(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0 text-slate-800">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or GST…"
              className="w-full border border-slate-200 rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="shrink-0 flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-700"
        >
          <Plus size={14} /> Add party
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading…</div>
        ) : parties.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm border border-dashed border-slate-200 rounded-lg bg-white">
            No parties found. Click <span className="font-semibold mx-1">+ Add party</span> to create one.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">GST</th>
                  <th className="px-3 py-2 text-left">D.L. No.</th>
                  <th className="px-3 py-2 text-left">Address</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600">{p.phone || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 font-mono">{p.gst_number || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 font-mono">{p.dl_number || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[12rem] truncate" title={p.address}>{p.address || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => openEdit(p)}
                          className="p-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setDeleteTarget(p)}
                          className="p-1 rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4"
            onClick={() => !saving && setModalOpen(false)}
            role="presentation"
          >
            <div
              className="bg-white rounded-lg shadow-xl p-4 w-full max-w-sm border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={editingId ? 'Edit party' : 'Add party'}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-slate-800">{editingId ? 'Edit party' : 'Add party'}</span>
                <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => !saving && setModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">Name *</span>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">Address</span>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    rows={2}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">GST Number</span>
                  <input
                    value={form.gst_number}
                    onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value }))}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase">D.L. Number</span>
                  <input
                    value={form.dl_number}
                    onChange={(e) => setForm((f) => ({ ...f, dl_number: e.target.value }))}
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="mt-4 w-full bg-blue-600 text-white text-xs font-semibold py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add party'}
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete confirm modal */}
      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4"
            onClick={() => !deleting && setDeleteTarget(null)}
            role="presentation"
          >
            <div
              className="bg-white rounded-lg shadow-xl p-4 w-full max-w-xs border border-slate-200 text-center"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <Trash2 size={28} className="text-rose-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800 mb-1">Delete party?</p>
              <p className="text-xs text-slate-500 mb-4">
                <span className="font-bold text-slate-700">{deleteTarget.name}</span> will be permanently removed.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 border border-slate-200 text-slate-700 text-xs font-semibold py-2 rounded hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-rose-600 text-white text-xs font-semibold py-2 rounded hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
