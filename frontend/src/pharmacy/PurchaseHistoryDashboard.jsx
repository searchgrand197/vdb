import React, { memo, useCallback, useEffect, useState } from 'react'
import { Calendar, Eye, Loader2, Pencil, RefreshCw, Search } from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { parseApiError } from './pharmacyCalculations'

const LIMIT = 20

function statusStyles(status) {
  if (status === 'expired') return { bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-800', label: 'Expired batch' }
  if (status === 'partial_return') return { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-900', label: 'Partial return' }
  return { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-900', label: 'Completed' }
}

function safeFmt(d) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'dd MMM yyyy')
  } catch {
    return d
  }
}

function PurchaseHistoryDashboardInner() {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ total: 0, has_more: false, offset: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [gst, setGst] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    api
      .get('/pharmacy/suppliers/?limit=500')
      .then((res) => setSuppliers(res.data?.data || res.data?.results || []))
      .catch(() => setSuppliers([]))
  }, [])

  const fetchPage = useCallback(
    async (offset, append) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(offset),
          gst,
        })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (supplierId) params.set('supplier_id', supplierId)
        if (dateFrom) params.set('date_from', dateFrom)
        if (dateTo) params.set('date_to', dateTo)
        const res = await api.get(`/pharmacy/purchase-history/?${params}`)
        const raw = res.data
        const list = raw?.data ?? raw?.entity ?? raw?.results ?? []
        const m = raw?.meta ?? {}
        if (append) {
          setItems((prev) => [...prev, ...list])
        } else {
          setItems(list)
        }
        setMeta({
          total: m.total ?? list.length,
          has_more: !!m.has_more,
          offset: offset + list.length,
        })
      } catch (e) {
        toast.error(parseApiError(e))
        if (!append) setItems([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [debouncedSearch, supplierId, gst, dateFrom, dateTo],
  )

  useEffect(() => {
    fetchPage(0, false)
  }, [fetchPage])

  async function openDetail(id) {
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await api.get(`/pharmacy/purchase-history/${id}/`)
      const d = res.data?.data ?? res.data?.entity ?? res.data
      setDetail(d)
    } catch (e) {
      toast.error(parseApiError(e))
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0 text-slate-800">
      <div className="shrink-0 flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
        <label className="flex flex-col min-w-[10rem] flex-1 max-w-md">
          <span className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Search</span>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Party, medicine, batch…"
              className="w-full border border-slate-200 rounded pl-8 pr-2 py-1.5 text-xs"
            />
          </div>
        </label>
        <label className="flex flex-col w-[9rem]">
          <span className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Party</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="border border-slate-200 rounded px-1 py-1.5 text-xs"
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col w-[6.5rem]">
          <span className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">GST</span>
          <select value={gst} onChange={(e) => setGst(e.target.value)} className="border border-slate-200 rounded px-1 py-1.5 text-xs">
            <option value="all">All</option>
            <option value="gst">GST</option>
            <option value="non">Non-GST</option>
          </select>
        </label>
        <label className="flex flex-col w-[8.5rem]">
          <span className="text-[9px] font-bold text-slate-500 uppercase mb-0.5 flex items-center gap-1">
            <Calendar size={10} /> From
          </span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-slate-200 rounded px-1 py-1 text-xs" />
        </label>
        <label className="flex flex-col w-[8.5rem]">
          <span className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-slate-200 rounded px-1 py-1 text-xs" />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
            <Loader2 className="animate-spin" size={18} /> Loading purchase history…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-200 rounded-lg bg-white">
            No purchase challans found.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-3">
              {items.map((row) => {
                const st = statusStyles(row.status)
                const gstBadge =
                  row.gst_type === 'GST' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                return (
                  <article
                    key={row.id}
                    className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                  >
                    <div className={`h-1 w-full ${st.bar}`} />
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 leading-tight line-clamp-2">{row.supplier_name}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">#{row.challan_no}</p>
                        <p className="text-[10px] text-slate-600">{safeFmt(row.date)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${st.badge}`}>{st.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${gstBadge}`}>
                          {row.gst_type === 'GST' ? 'GST bill' : 'Non-GST bill'}
                        </span>
                      </div>
                      <dl className="text-[11px] space-y-1 text-slate-600 border-t border-slate-100 pt-2 mt-auto">
                        <div className="flex justify-between gap-2">
                          <dt>Items</dt>
                          <dd className="font-semibold tabular-nums text-slate-900">{row.total_items}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Qty</dt>
                          <dd className="text-right text-[10px] leading-snug text-slate-800">{row.total_qty_display}</dd>
                        </div>
                        <div className="flex justify-between gap-2 items-center">
                          <dt>Amount</dt>
                          <dd className="flex items-center gap-1 font-bold text-slate-900">
                            <span className="text-slate-500 text-[10px]">₹</span>
                            <span className="tabular-nums">{Number(row.total_amount || 0).toFixed(2)}</span>
                          </dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => openDetail(row.id)}
                          className="flex-1 min-w-[5rem] flex items-center justify-center gap-1 bg-blue-600 text-white text-[10px] font-bold py-1.5 rounded"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => toast('Edit challan — use New challan to post adjustments (coming soon).')}
                          className="flex-1 min-w-[5rem] flex items-center justify-center gap-1 border border-slate-200 text-slate-600 text-[10px] font-semibold py-1.5 rounded hover:bg-slate-50"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toast('Purchase return / P-R expiry — link from stock module (coming soon).')}
                          className="flex-1 min-w-[5rem] flex items-center justify-center gap-1 border border-amber-200 text-amber-900 text-[10px] font-semibold py-1.5 rounded hover:bg-amber-50"
                        >
                          <RefreshCw size={12} /> Return
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            {meta.has_more && (
              <div className="flex justify-center pb-4">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchPage(items.length, true)}
                  className="text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => !detailLoading && setDetail(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Purchase challan</h2>
                {detail && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    {detail.challan_no} · {safeFmt(detail.date)} · {detail.supplier_name}
                  </p>
                )}
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2" onClick={() => setDetail(null)}>
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {detailLoading && (
                <div className="flex justify-center py-12 text-slate-500 gap-2">
                  <Loader2 className="animate-spin" size={20} /> Loading…
                </div>
              )}
              {detail && !detailLoading && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-4">
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Items</div>
                      <div className="font-bold tabular-nums">{detail.total_items}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2 col-span-2">
                      <div className="text-slate-500">Total qty</div>
                      <div className="font-semibold">{detail.total_qty_display}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Total ₹</div>
                      <div className="font-bold tabular-nums">₹{Number(detail.total_amount).toFixed(2)}</div>
                    </div>
                  </div>
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase">
                        <th className="p-2 border border-slate-200">Medicine</th>
                        <th className="p-2 border border-slate-200">Batch</th>
                        <th className="p-2 border border-slate-200">Exp</th>
                        <th className="p-2 border border-slate-200 text-right">Rate</th>
                        <th className="p-2 border border-slate-200 text-right">GST</th>
                        <th className="p-2 border border-slate-200 text-right">Final</th>
                        <th className="p-2 border border-slate-200">Last buy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines?.map((ln) => (
                        <tr key={ln.id} className={ln.expired ? 'bg-rose-50' : ln.expiring_within_90_days ? 'bg-amber-50/80' : ''}>
                          <td className="p-2 border border-slate-200 font-medium">{ln.medicine_name}</td>
                          <td className="p-2 border border-slate-200 font-mono">{ln.batch_no}</td>
                          <td className="p-2 border border-slate-200">{ln.expiry_date || '—'}</td>
                          <td className="p-2 border border-slate-200 text-right tabular-nums">{Number(ln.purchase_rate).toFixed(2)}</td>
                          <td className="p-2 border border-slate-200 text-right tabular-nums">{Number(ln.gst_amount).toFixed(2)}</td>
                          <td className="p-2 border border-slate-200 text-right font-semibold tabular-nums">{Number(ln.final_amount).toFixed(2)}</td>
                          <td className="p-2 border border-slate-200 text-[9px] text-slate-600">
                            {ln.last_purchase_rate != null ? (
                              <>
                                <div>₹{Number(ln.last_purchase_rate).toFixed(2)}</div>
                                {ln.previous_supplier_name && <div className="text-slate-400 truncate max-w-[7rem]">{ln.previous_supplier_name}</div>}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.return_movements?.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-bold text-slate-800 mb-2">Return / stock movements</h3>
                      <ul className="text-[10px] space-y-1 text-slate-600">
                        {detail.return_movements.map((m) => (
                          <li key={m.id} className="font-mono">
                            {m.created_at?.slice(0, 16)} · batch {m.batch_id?.slice(0, 8)}… · {m.reason} · {m.qty_change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const PurchaseHistoryDashboard = memo(PurchaseHistoryDashboardInner)
export default PurchaseHistoryDashboard
