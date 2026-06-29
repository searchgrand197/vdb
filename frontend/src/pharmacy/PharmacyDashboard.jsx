import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Package, Users, Wallet,
  IndianRupee, RefreshCw, Calendar, ToggleLeft, ToggleRight,
  AlertCircle, Search, Printer,
} from 'lucide-react'

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

function rupee(val) {
  const n = Number(val) || 0
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function rupeeFull(val) {
  return `₹${(Number(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pctBadge(growth) {
  const g = Number(growth) || 0
  const up = g >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
      up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
    }`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}{g.toFixed(1)}%
    </span>
  )
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Package size={32} className="mb-2 opacity-50" />
      <p className="text-xs">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      <AlertCircle size={28} className="mb-2 text-rose-400" />
      <p className="text-xs mb-3">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
          <RefreshCw size={10} /> Retry
        </button>
      )}
    </div>
  )
}

function MiniLineChart({ data, dataKey, color = '#3b82f6', height = 40 }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function CustomTooltip({ active, payload, label, prefix = '₹' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-[11px]">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {prefix}{Number(p.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  )
}

const SummaryCard = React.memo(function SummaryCard({ icon: Icon, iconBg, title, value, subtitle, badge, chart }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={16} className="text-white" />
        </div>
        {badge}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-xl font-extrabold text-slate-900 leading-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {chart && <div className="mt-1">{chart}</div>}
    </div>
  )
})

function PrintPreviewModal({ title, html, onClose }) {
  const iframeRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  function triggerPrint() {
    const w = iframeRef.current?.contentWindow
    if (!w) return
    w.focus(); w.print()
  }
  return createPortal(
    <div
      className="fixed inset-0 z-[1500] bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center"
      role="dialog" aria-modal="true"
    >
      <div className="w-full max-w-[1200px] max-h-[94vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900 truncate min-w-0">{title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={triggerPrint}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">Print</button>
            <button type="button" onClick={onClose}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">Close</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden bg-gray-100 p-2 sm:p-3">
          <iframe ref={iframeRef} title={title} srcDoc={html}
            className="w-full h-full min-h-[70vh] border-0 bg-white rounded-lg shadow-inner" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

const todayDefault = () => format(new Date(), 'yyyy-MM-dd')

const PharmacyDashboard = React.memo(function PharmacyDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardTab, setDashboardTab] = useState('overview')
  const [gstEnabled, setGstEnabled] = useState(true)
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')
  const [appliedDateFrom, setAppliedDateFrom] = useState('')
  const [appliedDateTo, setAppliedDateTo] = useState('')
  const [draftTodayFrom, setDraftTodayFrom] = useState(todayDefault)
  const [draftTodayTo, setDraftTodayTo] = useState(todayDefault)
  const [appliedTodayFrom, setAppliedTodayFrom] = useState(todayDefault)
  const [appliedTodayTo, setAppliedTodayTo] = useState(todayDefault)
  const [salesView, setSalesView] = useState('patients')
  const [refreshing, setRefreshing] = useState(false)
  const [medSearch, setMedSearch] = useState('')
  const [printPreview, setPrintPreview] = useState(null)
  const [printScope, setPrintScope] = useState('all')
  const [pharmProfile, setPharmProfile] = useState({})

  const intervalDraftDirty = draftDateFrom !== appliedDateFrom || draftDateTo !== appliedDateTo
  const todayDraftDirty = draftTodayFrom !== appliedTodayFrom || draftTodayTo !== appliedTodayTo

  const fetchDashboard = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (gstEnabled) params.set('gst', '1')
      else params.set('gst', '0')
      if (appliedDateFrom) params.set('date_from', appliedDateFrom)
      if (appliedDateTo) params.set('date_to', appliedDateTo)
      if (appliedTodayFrom) params.set('today_date_from', appliedTodayFrom)
      if (appliedTodayTo) params.set('today_date_to', appliedTodayTo)
      const res = await api.get(`/pharmacy/dashboard/?${params}`)
      setData(res.data?.data || res.data)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to load dashboard'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [gstEnabled, appliedDateFrom, appliedDateTo, appliedTodayFrom, appliedTodayTo])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  useEffect(() => {
    api.get('/pharmacy/settings/').then(res => {
      const d = res.data?.data || res.data || {}
      const b2c = d.b2c || {}
      setPharmProfile({
        name: d.business_name || '',
        address: b2c.address || '',
        phone: b2c.mobile || '',
        email: b2c.email || '',
        gst: b2c.gst_number || '',
        dl: b2c.dl_number || '',
      })
    }).catch(() => {})
  }, [])

  useEffect(() => { setSalesView('patients'); setMedSearch('') }, [appliedTodayFrom, appliedTodayTo])

  function applyIntervalRange() {
    setAppliedDateFrom(draftDateFrom)
    setAppliedDateTo(draftDateTo)
  }

  function applyTodayRange() {
    setAppliedTodayFrom(draftTodayFrom)
    setAppliedTodayTo(draftTodayTo)
  }

  const sales = data?.sales || {}
  const purchase = data?.purchase || {}
  const stock = data?.stock || {}
  const customers = data?.customers || {}
  const cash = data?.cash || {}
  const todaySales = data?.today_sales || {}
  const todayTotalForTab = data?.today_total_for_tab ?? 0

  const customerPieData = useMemo(() => {
    if (!customers.new && !customers.repeat) return []
    return [
      { name: 'New', value: customers.new || 0 },
      { name: 'Repeat', value: customers.repeat || 0 },
    ].filter(d => d.value > 0)
  }, [customers.new, customers.repeat])

  if (loading) {
    return (
      <div className="h-full overflow-y-auto space-y-4 p-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChartSkeleton /><ChartSkeleton />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={() => fetchDashboard()} />
  }

  if (!data) {
    return <EmptyState message="No dashboard data available" />
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-slate-900">Pharmacy Dashboard</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 border border-slate-200 rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setDashboardTab('overview')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                dashboardTab === 'overview' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setDashboardTab('today')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                dashboardTab === 'today' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Today Total {rupeeFull(todayTotalForTab)}
            </button>
          </div>
          <button
            onClick={() => setGstEnabled(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
              gstEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            {gstEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            GST {gstEnabled ? 'ON' : 'OFF'}
          </button>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-slate-400" />
            <input
              type="date"
              value={draftDateFrom}
              onChange={e => setDraftDateFrom(e.target.value)}
              className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
            />
            <span className="text-[10px] text-slate-400">to</span>
            <input
              type="date"
              value={draftDateTo}
              onChange={e => setDraftDateTo(e.target.value)}
              className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
            />
            <button
              type="button"
              onClick={applyIntervalRange}
              disabled={!intervalDraftDirty || refreshing}
              className="px-2 py-0.5 rounded-lg border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </div>
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {dashboardTab === 'overview' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              icon={IndianRupee}
              iconBg="bg-blue-600"
              title="Net Sales"
              value={rupee(sales.total)}
              badge={sales.growth != null ? pctBadge(sales.growth) : null}
              chart={<MiniLineChart data={sales.trend} dataKey="amount" color="#3b82f6" />}
            />
            <SummaryCard
              icon={Package}
              iconBg="bg-violet-600"
              title="Stock Value"
              value={rupee(stock.sale_value)}
              subtitle={`Purchase: ${rupee(stock.purchase_value)} · MRP: ${rupee(stock.mrp_value)}`}
            />
            <SummaryCard
              icon={Users}
              iconBg="bg-emerald-600"
              title="Customers"
              value={customers.total || 0}
              subtitle={`New: ${customers.new || 0} · Repeat: ${customers.repeat || 0}`}
              badge={customers.avg_order_value ? (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  Avg {rupee(customers.avg_order_value)}
                </span>
              ) : null}
            />
            <SummaryCard
              icon={Wallet}
              iconBg="bg-amber-500"
              title="Cash-in-Hand"
              value={rupee(cash.total)}
              subtitle={`Cash: ${rupee(cash.cash)} · Online: ${rupee(cash.online)} · Cheque: ${rupee(cash.cheque)}`}
            />
          </div>
        </>
      ) : (
        <>
          {/* Date-range sale split + margin */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-[11px] font-bold text-slate-700">Sales Breakdown</h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Calendar size={12} className="text-slate-400" />
                <input
                  type="date"
                  value={draftTodayFrom}
                  onChange={e => setDraftTodayFrom(e.target.value)}
                  className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                />
                <span className="text-[10px] text-slate-400">to</span>
                <input
                  type="date"
                  value={draftTodayTo}
                  onChange={e => setDraftTodayTo(e.target.value)}
                  className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                />
                <button
                  type="button"
                  onClick={applyTodayRange}
                  disabled={!todayDraftDirty || refreshing}
                  className="px-2 py-0.5 rounded-lg border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Go
                </button>
                <select
                  value={printScope}
                  onChange={e => setPrintScope(e.target.value)}
                  className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-700 bg-white"
                >
                  <option value="all">All Data</option>
                  <option value="invoices">Invoices Only</option>
                  <option value="medicines">Medicines Only</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const periodLabel = appliedTodayFrom === appliedTodayTo
                      ? appliedTodayFrom
                      : `${appliedTodayFrom} to ${appliedTodayTo}`
                    const printedAt = new Date().toLocaleString('en-IN')
                    const fmt2 = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    const details = todaySales.details || []
                    const meds = todaySales.medicine_details || []
                    const totRev = meds.reduce((s, m) => s + (m.total_revenue || 0), 0)
                    const totMar = meds.reduce((s, m) => s + (m.total_margin || 0), 0)
                    const totQty = meds.reduce((s, m) => s + (m.total_qty || 0), 0)

                    const pharmName = pharmProfile.name || 'Pharmacy'
                    const pharmAddr = pharmProfile.address || ''
                    const pharmPhone = pharmProfile.phone || ''
                    const pharmEmail = pharmProfile.email || ''
                    const pharmGst = pharmProfile.gst || ''
                    const pharmDl = pharmProfile.dl || ''

                    const wantInvoices = printScope === 'all' || printScope === 'invoices'
                    const wantMeds = printScope === 'all' || printScope === 'medicines'

                    const billRowsHtml = details.length
                      ? details.map((r, i) => `
                        <tr>
                          <td class="c">${i + 1}</td>
                          <td>${r.invoice_no || '—'}</td>
                          <td>${r.patient_name || '—'}</td>
                          <td class="c">${(r.payment_method || 'other').toUpperCase()}</td>
                          <td class="r">${fmt2(r.grand_total)}</td>
                          <td class="r em">${fmt2(r.margin)}</td>
                          <td class="r">${fmt2(r.paid_amount)}</td>
                          <td class="r am">${fmt2(r.due_amount)}</td>
                        </tr>`).join('')
                      : '<tr><td colspan="8" class="empty">No bills in this period</td></tr>'

                    const medRowsHtml = meds.length
                      ? meds.map((m, i) => {
                          const up = m.total_qty > 0 ? m.total_revenue / m.total_qty : 0
                          const low = (m.left_stock ?? 0) <= 10
                          return `
                          <tr>
                            <td class="c">${i + 1}</td>
                            <td>${m.name || '—'}</td>
                            <td class="r">${Number(m.total_qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                            <td class="r${low ? ' low' : ''}">${Number(m.left_stock ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${low ? ' ⚠' : ''}</td>
                            <td class="r">${fmt2(up)}</td>
                            <td class="r">${fmt2(m.total_revenue)}</td>
                            <td class="r em">${fmt2(m.total_margin)}</td>
                          </tr>`
                        }).join('')
                      : '<tr><td colspan="7" class="empty">No medicine sales in this period</td></tr>'

                    const summaryRows = [
                      ['Cash', todaySales.cash, todaySales.cash_margin],
                      ['UPI', todaySales.upi, todaySales.upi_margin],
                      ['Other', todaySales.other, todaySales.other_margin],
                      ['Credit', todaySales.credit, todaySales.credit_margin],
                      ['Total', todaySales.total, todaySales.total_margin],
                    ].map(([label, amt, mar]) =>
                      `<tr><td class="lbl">${label}</td><td>${fmt2(amt)}</td><td class="em">${fmt2(mar)}</td></tr>`
                    ).join('')

                    const invoiceSection = wantInvoices ? `
                      <h2 class="sec">Bill Details (${details.length})</h2>
                      <table class="tbl">
                        <thead><tr>
                          <th class="c">#</th><th>Invoice</th><th>Patient</th><th class="c">Method</th>
                          <th class="r">Total</th><th class="r">Margin</th><th class="r">Paid</th><th class="r">Due</th>
                        </tr></thead>
                        <tbody>${billRowsHtml}</tbody>
                        <tfoot><tr>
                          <td colspan="4" class="r">Total</td>
                          <td class="r">${fmt2(todaySales.total)}</td>
                          <td class="r em">${fmt2(todaySales.total_margin)}</td>
                          <td class="r">${fmt2(details.reduce((s, r) => s + (r.paid_amount || 0), 0))}</td>
                          <td class="r am">${fmt2(details.reduce((s, r) => s + (r.due_amount || 0), 0))}</td>
                        </tr></tfoot>
                      </table>` : ''

                    const medicineSection = wantMeds ? `
                      <h2 class="sec">Medicine Sales (${meds.length})</h2>
                      <table class="tbl">
                        <thead><tr>
                          <th class="c">#</th><th>Medicine</th><th class="r">Units Sold</th>
                          <th class="r">Left Stock</th><th class="r">Unit Price</th>
                          <th class="r">Revenue</th><th class="r">Margin</th>
                        </tr></thead>
                        <tbody>${medRowsHtml}</tbody>
                        <tfoot><tr>
                          <td colspan="2"><strong>Total</strong></td>
                          <td class="r">${Number(totQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td></td><td></td>
                          <td class="r">${fmt2(totRev)}</td>
                          <td class="r em">${fmt2(totMar)}</td>
                        </tr></tfoot>
                      </table>` : ''

                    const scopeLabel = printScope === 'invoices' ? 'Invoices' : printScope === 'medicines' ? 'Medicines' : 'All Data'

                    const html = `<!DOCTYPE html><html><head>
                      <meta charset="utf-8"/>
                      <title>Sales Report (${scopeLabel}) — ${pharmName}</title>
                      <style>
                        @page { size: A4 portrait; margin: 14mm 12mm 12mm 12mm; @top-right { content: "Page " counter(page) " of " counter(pages); font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; } }
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; line-height: 1.35; }
                        .hdr { text-align: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1.5px solid #000; }
                        .hdr h1 { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
                        .hdr p { font-size: 9px; margin-top: 1px; }
                        .info { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px; }
                        .info td { border: 1px solid #000; padding: 4px 6px; }
                        .info .lbl { width: 28%; font-weight: bold; background: #f5f5f5; }
                        h2.sec { font-size: 11px; font-weight: bold; margin: 14px 0 6px; }
                        table.tbl { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 16px; }
                        table.tbl thead { display: table-header-group; }
                        table.tbl th, table.tbl td { border: 1px solid #000; padding: 4px 5px; text-align: left; }
                        table.tbl th { font-weight: bold; }
                        table.tbl thead th { background-color: #d1d5db !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        table.tbl th.r, table.tbl td.r { text-align: right; }
                        table.tbl th.c, table.tbl td.c { text-align: center; }
                        table.tbl tfoot td { font-weight: bold; }
                        table.tbl td.empty { text-align: center; font-style: italic; padding: 10px; }
                        table.sum { border-collapse: collapse; font-size: 9px; margin-bottom: 14px; }
                        table.sum th, table.sum td { border: 1px solid #000; padding: 4px 8px; }
                        table.sum th { font-weight: bold; background: #f5f5f5; }
                        .em { color: #065f46; }
                        .am { color: #92400e; }
                        .low { color: #991b1b; }
                        .foot { margin-top: 12px; font-size: 8px; color: #444; text-align: center; }
                      </style>
                    </head><body>
                      <div class="hdr">
                        <h1>${pharmName}</h1>
                        ${pharmAddr ? `<p>${pharmAddr}</p>` : ''}
                        ${pharmPhone || pharmEmail ? `<p>${pharmPhone ? `Tel: ${pharmPhone}` : ''}${pharmPhone && pharmEmail ? ' · ' : ''}${pharmEmail || ''}</p>` : ''}
                        ${pharmGst || pharmDl ? `<p>${pharmGst ? `GST: ${pharmGst}` : ''}${pharmGst && pharmDl ? ' · ' : ''}${pharmDl ? `DL: ${pharmDl}` : ''}</p>` : ''}
                        <p style="margin-top:6px;font-weight:bold">Pharmacy Sales Report — ${scopeLabel}</p>
                      </div>

                      <table class="info">
                        <tr><td class="lbl">Period</td><td>${periodLabel}</td><td class="lbl">Printed</td><td>${printedAt}</td></tr>
                        <tr><td class="lbl">Scope</td><td>${scopeLabel}</td><td class="lbl">Total invoices</td><td>${details.length}</td></tr>
                        <tr><td class="lbl">Total Sales</td><td>${fmt2(todaySales.total)}</td><td class="lbl">Total Margin</td><td>${fmt2(todaySales.total_margin)}</td></tr>
                        <tr>
                          <td class="lbl">By Mode</td>
                          <td colspan="3">Cash ${fmt2(todaySales.cash)} · UPI ${fmt2(todaySales.upi)} · Other ${fmt2(todaySales.other)} · Credit ${fmt2(todaySales.credit)}</td>
                        </tr>
                      </table>

                      <h2 class="sec">Payment Summary</h2>
                      <table class="sum">
                        <thead><tr><th>Method</th><th>Amount</th><th>Margin</th></tr></thead>
                        <tbody>${summaryRows}</tbody>
                      </table>

                      ${invoiceSection}
                      ${medicineSection}

                      <p class="foot">Printed ${printedAt} · ${pharmName}</p>
                    </body></html>`
                    setPrintPreview({ title: `Sales Report (${scopeLabel}) — ${periodLabel}`, html })
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-800 hover:bg-indigo-100"
                >
                  <Printer size={11} /> Print
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Cash', value: todaySales.cash, margin: todaySales.cash_margin, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'UPI', value: todaySales.upi, margin: todaySales.upi_margin, color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'Other', value: todaySales.other, margin: todaySales.other_margin, color: 'text-violet-700', bg: 'bg-violet-50' },
                { label: 'Credit', value: todaySales.credit, margin: todaySales.credit_margin, color: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'Total', value: todaySales.total, margin: todaySales.total_margin, color: 'text-slate-900', bg: 'bg-slate-100' },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} rounded-lg p-3 text-center`}>
                  <p className="text-[10px] font-semibold text-slate-500">{item.label}</p>
                  <p className={`text-base font-extrabold ${item.color} mt-1`}>{rupeeFull(item.value)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Margin {rupeeFull(item.margin)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-[11px] font-bold text-slate-700">
                {salesView === 'patients' ? 'Bill Details (Selected Range)' : 'Medicine Sales (Selected Range)'}
              </h3>
              <div className="flex items-center gap-2">
                {salesView === 'medicines' && (
                  <div className="relative w-40 sm:w-48">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search medicine"
                      value={medSearch}
                      onChange={e => setMedSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 text-[10px] border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                )}
                <div className="flex items-center gap-1 p-1 border border-slate-200 rounded-lg bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setSalesView('patients')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                      salesView === 'patients' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Patients
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesView('medicines')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                      salesView === 'medicines' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Medicines
                  </button>
                </div>
              </div>
            </div>

            {salesView === 'patients' ? (
              !todaySales.details?.length ? (
                <EmptyState message="No bills found for selected date range" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Invoice</th>
                        <th className="px-3 py-2">Patient</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Margin</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {todaySales.details.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-blue-700">#{r.invoice_no}</td>
                          <td className="px-3 py-2 text-slate-700">{r.patient_name || '—'}</td>
                          <td className="px-3 py-2 uppercase font-semibold text-slate-600">{r.payment_method || 'other'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{rupeeFull(r.grand_total)}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{rupeeFull(r.margin)}</td>
                          <td className="px-3 py-2 text-right">{rupeeFull(r.paid_amount)}</td>
                          <td className="px-3 py-2 text-right text-amber-700 font-semibold">{rupeeFull(r.due_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              !todaySales.medicine_details?.length ? (
                <EmptyState message="No medicine sales found for selected date range" />
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    {(() => {
                      const allMeds = todaySales.medicine_details
                      const meds = medSearch.trim()
                        ? allMeds.filter(m => m.name.toLowerCase().includes(medSearch.trim().toLowerCase()))
                        : allMeds
                      const totQty = meds.reduce((s, m) => s + (m.total_qty || 0), 0)
                      const totRev = meds.reduce((s, m) => s + (m.total_revenue || 0), 0)
                      const totMar = meds.reduce((s, m) => s + (m.total_margin || 0), 0)
                      if (!meds.length) {
                        return <EmptyState message={`No medicines match "${medSearch}"`} />
                      }
                      return (
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-100 text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-2">#</th>
                              <th className="px-3 py-2">Medicine</th>
                              <th className="px-3 py-2 text-right">Units Sold</th>
                              <th className="px-3 py-2 text-right">Left Stock</th>
                              <th className="px-3 py-2 text-right">Unit Price</th>
                              <th className="px-3 py-2 text-right">Total Revenue</th>
                              <th className="px-3 py-2 text-right">Margin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {meds.map((m, idx) => {
                              const unitPrice = m.total_qty > 0 ? m.total_revenue / m.total_qty : 0
                              const lowStock = m.left_stock <= 10
                              return (
                                <tr key={m.medicine_id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 text-slate-400 font-medium">{idx + 1}</td>
                                  <td className="px-3 py-2 font-semibold text-slate-800">{m.name}</td>
                                  <td className="px-3 py-2 text-right text-slate-700 font-medium">{Number(m.total_qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                  <td className={`px-3 py-2 text-right font-bold ${lowStock ? 'text-rose-600' : 'text-slate-700'}`}>
                                    {Number(m.left_stock ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    {lowStock && (
                                      <span className="ml-1 text-[9px] bg-rose-100 text-rose-600 px-1 py-0.5 rounded-full font-bold">Low</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-600">{rupeeFull(unitPrice)}</td>
                                  <td className="px-3 py-2 text-right font-semibold">{rupeeFull(m.total_revenue)}</td>
                                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{rupeeFull(m.total_margin)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                            <tr>
                              <td className="px-3 py-2 font-extrabold text-slate-700" colSpan={2}>Total</td>
                              <td className="px-3 py-2 text-right font-extrabold text-slate-800">{Number(totQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2 text-right font-extrabold text-slate-900">{rupeeFull(totRev)}</td>
                              <td className="px-3 py-2 text-right font-extrabold text-emerald-700">{rupeeFull(totMar)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )
                    })()}
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
      {printPreview && (
        <PrintPreviewModal
          title={printPreview.title}
          html={printPreview.html}
          onClose={() => setPrintPreview(null)}
        />
      )}

      {dashboardTab === 'overview' ? (
        <>
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Sales Trend */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-[11px] font-bold text-slate-700 mb-3">Net Sales Trend</h3>
          {sales.trend?.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sales.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={v => v?.slice(5) || v}
                    axisLine={false} tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="amount" name="Sales" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No sales data for this period" />
          )}
        </div>

        {/* Purchase Trend */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-[11px] font-bold text-slate-700 mb-3">Net Purchase Trend</h3>
          {purchase.trend?.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={purchase.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={v => v?.slice(5) || v}
                    axisLine={false} tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="amount" name="Purchase" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No purchase data for this period" />
          )}
        </div>

        {/* Customer Distribution */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-[11px] font-bold text-slate-700 mb-3">Customer Distribution</h3>
          {customerPieData.length ? (
            <div className="h-48 flex flex-col items-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={customerPieData}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={60}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {customerPieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => v.toLocaleString('en-IN')} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-1">
                {customerPieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState message="No customer data" />
          )}
        </div>
      </div>

      {/* Stock Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-[11px] font-bold text-slate-700 mb-3">Stock Value Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Purchase Value', value: stock.purchase_value, color: 'text-violet-700', bg: 'bg-violet-50' },
            { label: 'MRP Value', value: stock.mrp_value, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Sale Value', value: stock.sale_value, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ].map(item => (
            <div key={item.label} className={`${item.bg} rounded-lg p-3 text-center`}>
              <p className="text-[10px] font-semibold text-slate-500">{item.label}</p>
              <p className={`text-lg font-extrabold ${item.color} mt-1`}>{rupeeFull(item.value)}</p>
            </div>
          ))}
        </div>
      </div>
        </>
      ) : null}
    </div>
  )
})

export default PharmacyDashboard
