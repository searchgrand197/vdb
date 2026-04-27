import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'

function unwrap(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  return []
}

export default function AdminCrudPage({ module }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({})
  const [editing, setEditing] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(module.endpoint)
      setRows(unwrap(data))
    } catch (e) {
      toast.error(`Failed loading ${module.title}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setForm({})
    setEditing(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.endpoint])

  const onSave = async () => {
    try {
      if (editing?.id) {
        await api.patch(`${module.endpoint}${editing.id}/`, form)
        toast.success('Updated')
      } else {
        await api.post(module.endpoint, form)
        toast.success('Created')
      }
      setForm({})
      setEditing(null)
      load()
    } catch {
      toast.error('Save failed')
    }
  }

  const onEdit = (row) => {
    setEditing(row)
    const next = {}
    module.fields.forEach((k) => {
      next[k] = row[k]
    })
    setForm(next)
  }

  const onDelete = async (row) => {
    if (!window.confirm(`Delete ${module.title} record?`)) return
    try {
      await api.delete(`${module.endpoint}${row.id}/`)
      toast.success('Deleted')
      load()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={`Search ${module.title}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-sm font-semibold mb-2">{editing ? `Edit ${module.title}` : `Create ${module.title}`}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {module.fields.map((f) => (
            <input
              key={f}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={f}
              value={form[f] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button className="rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm" onClick={onSave}>Save</button>
          {editing && (
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setEditing(null); setForm({}) }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[56vh]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left">ID</th>
                {module.fields.slice(0, 6).map((f) => <th key={f} className="px-2 py-2 text-left">{f}</th>)}
                <th className="px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-2 py-3" colSpan={8}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-2 py-3" colSpan={8}>No records</td></tr>
              ) : filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{String(row.id || '').slice(0, 8)}</td>
                  {module.fields.slice(0, 6).map((f) => <td key={f} className="px-2 py-2">{String(row[f] ?? '')}</td>)}
                  <td className="px-2 py-2 space-x-2">
                    <button className="text-indigo-600" onClick={() => onEdit(row)}>Edit</button>
                    <button className="text-rose-600" onClick={() => onDelete(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
