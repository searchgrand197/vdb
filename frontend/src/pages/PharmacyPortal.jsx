import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShoppingBag,
  Search,
  Plus,
  LogOut,
  X,
  Settings,
  FileText,
  UserPlus,
  Package,
  Truck,
  Eye,
  PencilLine,
  SlidersHorizontal,
  Trash2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Tags,
} from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import ErpBillingView from '../pharmacy/ErpBillingView'
import PharmacyInvoicePrint from '../pharmacy/PharmacyInvoicePrint'
import SettingsPanel from '../pharmacy/SettingsPanel'
import PurchaseChallanPanel from '../pharmacy/PurchaseChallanPanel'
import PurchaseHistoryDashboard from '../pharmacy/PurchaseHistoryDashboard'
import PharmacyDashboard from '../pharmacy/PharmacyDashboard'
import PharmacyCategoriesView from '../pharmacy/PharmacyCategoriesView'
import { parseApiError } from '../pharmacy/pharmacyCalculations'
import {
  resolveCategoryRules,
  packFieldLabel,
  baseFieldLabel,
  conversionHintLines,
} from '../pharmacy/categoryRulePresets'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    console.error('ErrorBoundary', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#ffebee', color: '#c62828' }}>
          <h2>Something went wrong in {this.props.componentName || 'a component'}.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

function safeFormat(dateVal, fmtStr) {
  if (!dateVal) return '--/--'
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return '--/--'
    return format(d, fmtStr)
  } catch {
    return '--/--'
  }
}

export default function PharmacyPortal() {
  const [view, setView] = useState('dashboard')
  const [medicines, setMedicines] = useState([])
  const [batches, setBatches] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [printingInvoice, setPrintingInvoice] = useState(null)
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [outletSettings, setOutletSettings] = useState(null)
  const [billingPatient, setBillingPatient] = useState(null)
  const [purchaseSubView, setPurchaseSubView] = useState('entry')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1200)

  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [mResp, bResp, iResp, sResp] = await Promise.all([
        api.get('/medicines/?limit=1000'),
        api.get('/batches/?limit=1000'),
        api.get('/pharmacy/invoices/?limit=100'),
        api.get('/pharmacy/settings/').catch(() => ({ data: null })),
      ])
      setMedicines(mResp.data?.data || mResp.data?.results || [])
      setBatches(bResp.data?.data || bResp.data?.results || [])
      setInvoices(iResp.data?.data || iResp.data?.results || [])
      const rawS = sResp.data
      const sd =
        rawS && typeof rawS === 'object' && 'business_name' in rawS ? rawS : rawS?.data ?? rawS?.entity
      if (sd) setOutletSettings(sd)
    } catch {
      toast.error('Failed to load pharmacy data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    const onResize = () => {
      setSidebarCollapsed(window.innerWidth < 1200)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function handleLogout() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('role')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  const brand = outletSettings?.business_name?.trim() || 'Pharmacy'

  return (
    <div className="h-screen w-screen flex bg-slate-50 text-slate-900 font-sans overflow-hidden text-[14px]">
      <aside className={`bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-60'}`}>
        <div className="px-3 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
              Rx
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-slate-800 truncate leading-tight">{brand}</h1>
              <p className="text-[10px] text-slate-500">ERP</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-2 flex flex-col gap-0.5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'billing', label: 'Sales', icon: ShoppingBag },
            { id: 'purchase', label: 'Purchase', icon: Truck },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'categories', label: 'Categories', icon: Tags },
            { id: 'history', label: 'Register', icon: FileText },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setView(item.id)
                if (item.id !== 'purchase') setPurchaseSubView('entry')
              }}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-l-4 ${
                view === item.id
                  ? 'bg-blue-50 text-blue-700 border-blue-600'
                  : 'text-slate-600 border-transparent hover:bg-slate-50'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-600 hover:text-rose-600 text-xs font-medium"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-11 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <span className="text-xs font-medium text-slate-500">Terminal · Pharmacy desk</span>
          </div>
          <span className="text-xs text-slate-400">v3.2</span>
        </header>

        <main className="flex-1 overflow-hidden p-3 min-h-0">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : (
            <>
              <ErrorBoundary componentName="PharmacyDashboard">
                {view === 'dashboard' && <PharmacyDashboard />}
              </ErrorBoundary>
              <ErrorBoundary componentName="ErpBillingView">
                {view === 'billing' && (
                  <ErpBillingView
                    medicines={medicines}
                    batches={batches}
                    setInvoices={setInvoices}
                    setPrintingInvoice={setPrintingInvoice}
                    setShowAddMedicine={setShowAddMedicine}
                    setShowAddPatient={setShowAddPatient}
                    fetchInitialData={fetchInitialData}
                    selectedPt={billingPatient}
                    setSelectedPt={setBillingPatient}
                    outletSettings={outletSettings}
                  />
                )}
              </ErrorBoundary>
              {view === 'purchase' && (
                <div className="h-full flex flex-col gap-2 min-h-0">
                  <div className="shrink-0 flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => setPurchaseSubView('entry')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold ${
                        purchaseSubView === 'entry' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      New challan
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchaseSubView('history')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold ${
                        purchaseSubView === 'history' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Purchase history
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {purchaseSubView === 'entry' ? (
                      <PurchaseChallanPanel onPosted={fetchInitialData} outletSettings={outletSettings} />
                    ) : (
                      <PurchaseHistoryDashboard />
                    )}
                  </div>
                </div>
              )}
              <ErrorBoundary componentName="InventoryView">
                {view === 'inventory' && (
                  <InventoryView
                    medicines={medicines}
                    batches={batches}
                    setShowAddMedicine={setShowAddMedicine}
                    fetchInitialData={fetchInitialData}
                  />
                )}
              </ErrorBoundary>
              <ErrorBoundary componentName="PharmacyCategoriesView">
                {view === 'categories' && <PharmacyCategoriesView />}
              </ErrorBoundary>
              <ErrorBoundary componentName="HistoryView">
                {view === 'history' && <HistoryView invoices={invoices} setPrintingInvoice={setPrintingInvoice} />}
              </ErrorBoundary>
              {view === 'settings' && (
                <SettingsPanel
                  onSaved={(f) => setOutletSettings((prev) => ({ ...prev, ...f }))}
                />
              )}
            </>
          )}
        </main>
      </div>

      {printingInvoice && (
        <PharmacyInvoicePrint
          invoice={printingInvoice}
          outlet={outletSettings}
          onClose={() => setPrintingInvoice(null)}
        />
      )}
      {showAddMedicine && (
        <AddMedicineModal
          onClose={() => setShowAddMedicine(false)}
          onRefresh={fetchInitialData}
          defaultGstPercent={outletSettings?.default_gst_percent}
          defaultSaleDiscountPercent={outletSettings?.default_sale_discount_percent}
        />
      )}
      {showAddPatient && (
        <AddPatientModal
          onClose={() => setShowAddPatient(false)}
          onAdd={(pt) => {
            const p = pt?.data || pt
            setBillingPatient(p)
            setShowAddPatient(false)
            toast.success('Patient selected for billing')
          }}
        />
      )}
    </div>
  )
}

const INV_ALLOW_NEG_KEY = 'pharmacy_inventory_allow_negative_stock'

function expiryRowClass(expiryDate) {
  if (!expiryDate) return 'text-slate-500'
  const d = new Date(expiryDate)
  if (Number.isNaN(d.getTime())) return 'text-slate-500'
  const days = (d.getTime() - Date.now()) / 86400000
  if (days < 0) return 'text-rose-600 font-semibold'
  if (days <= 90) return 'text-amber-700 font-medium'
  return 'text-slate-600'
}

function isLowStockRow(qty, stripSize) {
  const q = Number(qty) || 0
  const sp = Number(stripSize) || 0
  if (q <= 0) return true
  if (sp > 1) return q < sp * 2
  return q < 15
}

/** Prefer box > carton > strip; label matches JSON key (e.g. strip, box). */
function preferredPackFromConversions(conversions = {}) {
  const c = conversions && typeof conversions === 'object' ? conversions : {}
  const tiers = [
    ['box', 'BOX'],
    ['carton', 'CARTON'],
    ['strip', 'STRIP'],
  ]
  for (const [low, up] of tiers) {
    const n = Number(c[low] ?? c[up]) || 0
    if (n > 0) {
      const labelKey = c[low] != null && c[low] !== '' ? low : up
      return { perPack: n, label: String(labelKey).toLowerCase() }
    }
  }
  return { perPack: 0, label: 'pack' }
}

/**
 * Human-readable stock: pack + remainder only when there is a real multi-pack (>1 base per pack).
 * If pack size is 1 (e.g. 1x1), show base count only — avoids misleading "50 strips" when strip = 1 tablet.
 */
function formatPackAndBaseStock(baseQty, perPack, packLabel, baseLabel) {
  const q = Number(baseQty) || 0
  const pp = Number(perPack) || 0
  const bl = (baseLabel || 'unit').toLowerCase()
  const pl = (packLabel || 'pack').toLowerCase()
  if (q <= 0) return `0 ${bl}`
  if (!(pp > 1)) {
    const n = q % 1 === 0 ? q : Number(q.toFixed(2))
    return `${n} ${bl}`
  }
  const packs = Math.floor(q / pp)
  const rem = Math.round((q - packs * pp) * 100) / 100
  const parts = []
  if (packs > 0) parts.push(`${packs} ${pl}${packs === 1 ? '' : 's'}`)
  if (rem > 0) parts.push(`${rem % 1 === 0 ? rem : Number(rem.toFixed(2))} ${bl}`)
  return parts.length ? parts.join(' + ') : `0 ${bl}`
}

/**
 * Labels for inventory qty display — same source as Add Medicine opening stock
 * (`resolveCategoryRules` → base_unit_label / retail_pack_label), falling back to `medicine.unit_name`.
 */
function inventoryQtyLabels(medicine, categoryRows = []) {
  const rules = resolveCategoryRules(medicine?.form, categoryRows)
  const fromCat = String(rules.base_unit_label || '').trim()
  const baseLabel = (fromCat || String(medicine?.unit_name || 'unit').trim() || 'unit').toLowerCase()
  const conv = medicine?.unit_conversions || {}
  const packPref = preferredPackFromConversions(conv)
  const retail = String(rules.retail_pack_label || '').trim().toLowerCase()
  const packLabel =
    retail && ['strip', 'box', 'carton'].includes(packPref.label) ? retail : packPref.label
  return { baseLabel, packLabel, perPack: packPref.perPack }
}

function normalizeStockLedgerList(res) {
  const raw = res?.data
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  const inner = raw.data ?? raw.entity ?? raw
  if (Array.isArray(inner)) return inner
  if (Array.isArray(inner?.results)) return inner.results
  return []
}

function sortLedgerChronological(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime()
    const tb = new Date(b.created_at || 0).getTime()
    return ta - tb
  })
}

/** Human label for a stock ledger row (inventory UI). */
function formatStockLedgerLabel(r) {
  const rt = String(r.reference_type || '').toLowerCase()
  if (rt === 'opening_stock') return 'Initial stock'
  if (r.reason === 'stock_in' && rt === 'pharmacy_purchase_challan') return 'Purchase (stock in)'
  if (r.reason === 'stock_in') return 'Stock in'
  if (r.reason === 'return_in') return 'Return in'
  if (r.reason === 'dispense_out') return 'Dispense out'
  if (r.reason === 'adjust') {
    return r.reference_id ? `Adjustment · ${r.reference_id}` : 'Adjustment'
  }
  return r.reason || '—'
}

function InventoryView({ medicines, batches, setShowAddMedicine, fetchInitialData }) {
  const [q, setQ] = useState('')
  const [allowNegative, setAllowNegative] = useState(() => localStorage.getItem(INV_ALLOW_NEG_KEY) === '1')
  const [detailBatch, setDetailBatch] = useState(null)
  const [rateBatch, setRateBatch] = useState(null)
  const [adjustBatch, setAdjustBatch] = useState(null)
  const [deletingBatchId, setDeletingBatchId] = useState(null)
  const [medicineCategoryRows, setMedicineCategoryRows] = useState([])

  useEffect(() => {
    let cancelled = false
    api
      .get('/medicine-categories/?limit=500')
      .then((res) => {
        if (cancelled) return
        const rows = res.data?.data || res.data?.results || []
        setMedicineCategoryRows(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setMedicineCategoryRows([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(INV_ALLOW_NEG_KEY, allowNegative ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [allowNegative])

  const qLower = q.toLowerCase()
  const medicineById = new Map(medicines.map((m) => [String(m.id), m]))
  const medIdsWithBatch = new Set(batches.map((b) => String(b.medicine)))

  const filtered = batches
    .filter((b) => {
      const med = medicineById.get(String(b.medicine))
      const name = med?.name?.toLowerCase() ?? ''
      const bn = (b.batch_no ?? '').toLowerCase()
      return name.includes(qLower) || bn.includes(qLower)
    })
    .sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime()
      const tb = new Date(b?.created_at || 0).getTime()
      return tb - ta
    })

  // Only show catalogue rows with no batch when searching — otherwise deleting the last
  // batch would leave the product stuck in the table as "No batch" with no way to clear it visually.
  const medicinesWithoutBatch = medicines.filter((m) => {
    if (medIdsWithBatch.has(String(m.id))) return false
    if (!qLower) return false
    return (
      (m.name || '').toLowerCase().includes(qLower) ||
      (m.sku || '').toLowerCase().includes(qLower)
    )
  })

  const totalRows = filtered.length + medicinesWithoutBatch.length

  async function handleDeleteBatch(batch, med) {
    const medName = med?.name || 'this item'
    const ok = window.confirm(
      `Delete inventory batch ${batch.batch_no || ''} for ${medName}?\n\nThis removes the batch record from inventory.`,
    )
    if (!ok) return
    setDeletingBatchId(String(batch.id))
    try {
      await api.delete(`/batches/${batch.id}/`)
      toast.success('Inventory batch deleted')
      fetchInitialData?.()
    } catch (e) {
      toast.error(parseApiError(e) || 'Could not delete inventory batch')
    } finally {
      setDeletingBatchId(null)
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Inventory</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {totalRows} items
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={allowNegative}
              onChange={(e) => setAllowNegative(e.target.checked)}
            />
            Allow negative stock (adjust)
          </label>
          <button
            type="button"
            onClick={() => setShowAddMedicine(true)}
            className="border border-blue-200 bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-[11px] font-semibold hover:bg-blue-100"
          >
            + Medicine
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white border border-slate-200 rounded overflow-hidden flex flex-col min-h-0 min-w-0">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/70 shrink-0">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / batch (includes products with no batch)"
            className="flex-1 bg-transparent text-[12px] font-medium outline-none min-w-0"
          />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <table className="w-full text-left text-[11px] table-fixed border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 font-bold text-slate-600 uppercase">
              <tr>
                <th className="px-2 py-1.5 w-[18%]">Product</th>
                <th className="px-2 py-1.5 w-[10%]">Batch</th>
                <th className="px-2 py-1.5 w-[8%]">Expiry</th>
                <th className="px-2 py-1.5 w-[16%]">Stock</th>
                <th className="px-2 py-1.5 w-[7%] text-right">MRP</th>
                <th className="px-2 py-1.5 w-[7%] text-right">Sale</th>
                <th className="px-2 py-1.5 w-[7%] text-right">Pur.</th>
                <th className="px-2 py-1.5 w-[14%] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((b) => {
                const med = medicineById.get(String(b.medicine))
                const { baseLabel, packLabel, perPack } = inventoryQtyLabels(med, medicineCategoryRows)
                const qty = Number(b.quantity ?? 0)
                const stockLabel = formatPackAndBaseStock(qty, perPack, packLabel, baseLabel)
                const low = isLowStockRow(qty, perPack)
                const expCls = expiryRowClass(b.expiry_date)
                return (
                  <tr
                    key={b.id}
                    className={`hover:bg-slate-50 ${low ? 'bg-amber-50/50' : ''} ${qty < 0 ? 'bg-rose-50/70' : ''}`}
                  >
                    <td className="px-2 py-1 align-top min-w-0">
                      <div className="font-semibold text-slate-900 truncate" title={med?.name}>
                        {med?.name ?? '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{med?.pack_info}</div>
                    </td>
                    <td className="px-2 py-1 align-top min-w-0">
                      <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded inline-block max-w-full truncate" title={b.batch_no}>
                        {b.batch_no}
                      </span>
                    </td>
                    <td className={`px-2 py-1 align-top tabular-nums ${expCls}`}>{safeFormat(b.expiry_date, 'MM/yy')}</td>
                    <td className="px-2 py-1 align-top text-emerald-800 font-medium leading-tight break-words">
                      <div>{stockLabel}</div>
                      {perPack > 1 && (
                        <div className="text-[9px] text-slate-400 font-mono tabular-nums">
                          {qty % 1 === 0 ? qty : qty.toFixed(2)} {baseLabel} (base)
                        </div>
                      )}
                      {qty < 0 && <div className="text-[9px] text-rose-600 font-semibold">Below zero</div>}
                      {low && qty >= 0 && <div className="text-[9px] text-amber-700">Low stock</div>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-700">₹{Number(b.mrp ?? 0).toFixed(2)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-blue-700 font-semibold">₹{Number(b.sale_rate ?? 0).toFixed(2)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-500">₹{Number(b.unit_cost ?? 0).toFixed(2)}</td>
                    <td className="px-1 py-1 align-top">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <button
                          type="button"
                          title="View details"
                          onClick={() => setDetailBatch({ batch: b, medicine: med })}
                          className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          title="Edit rate"
                          onClick={() => setRateBatch({ batch: b, medicine: med })}
                          className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <PencilLine size={12} />
                        </button>
                        <button
                          type="button"
                          title="Adjust stock"
                          onClick={() => setAdjustBatch({ batch: b, medicine: med })}
                          className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <SlidersHorizontal size={12} />
                        </button>
                        <button
                          type="button"
                          title="Delete inventory"
                          disabled={deletingBatchId === String(b.id)}
                          onClick={() => handleDeleteBatch(b, med)}
                          className="p-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {medicinesWithoutBatch.map((m) => (
                <tr key={`no-batch-${m.id}`} className="bg-sky-50/30 hover:bg-sky-50/60">
                  <td className="px-2 py-1 align-top min-w-0">
                    <div className="font-semibold text-slate-900 truncate" title={m.name}>
                      {m.name || '—'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{m.pack_info}</div>
                  </td>
                  <td className="px-2 py-1 align-top text-[10px]">
                    <span className="inline-block rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 font-semibold">
                      No batch
                    </span>
                  </td>
                  <td className="px-2 py-1 align-top text-slate-400">--/--</td>
                  <td className="px-2 py-1 align-top text-slate-500">Add batch to start stock</td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-700">₹{Number(m.default_mrp ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-500">₹0.00</td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-500">₹0.00</td>
                  <td className="px-1 py-1 align-top">
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => toast('Create purchase/batch entry for this medicine')}
                        className="px-2 py-1 rounded border border-blue-200 bg-white text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Add Batch
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && medicinesWithoutBatch.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-[11px] text-slate-500">
                    No inventory records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailBatch && (
        <InventoryBatchDetailModal
          batch={detailBatch.batch}
          medicine={detailBatch.medicine}
          medicineCategoryRows={medicineCategoryRows}
          onClose={() => setDetailBatch(null)}
        />
      )}
      {rateBatch && (
        <InventoryEditRateModal
          batch={rateBatch.batch}
          medicine={rateBatch.medicine}
          onClose={() => setRateBatch(null)}
          onSaved={() => {
            setRateBatch(null)
            fetchInitialData?.()
          }}
        />
      )}
      {adjustBatch && (
        <InventoryAdjustStockModal
          batch={adjustBatch.batch}
          medicine={adjustBatch.medicine}
          medicineCategoryRows={medicineCategoryRows}
          allowNegative={allowNegative}
          onClose={() => setAdjustBatch(null)}
          onSaved={() => {
            setAdjustBatch(null)
            fetchInitialData?.()
          }}
        />
      )}
    </div>
  )
}

function InventoryBatchDetailModal({ batch, medicine, medicineCategoryRows = [], onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get(`/stock-ledgers/?batch=${batch.id}&limit=80`)
      .then((res) => {
        const list = sortLedgerChronological(normalizeStockLedgerList(res))
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [batch.id])

  const { baseLabel, packLabel, perPack } = inventoryQtyLabels(medicine, medicineCategoryRows)
  const qty = Number(batch.quantity ?? 0)

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Batch details"
      >
        <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-xs font-bold text-slate-800">Batch details</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="p-3 overflow-y-auto text-[10px] space-y-2">
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
            <dt className="text-slate-500">Medicine</dt>
            <dd className="font-semibold text-slate-900">{medicine?.name ?? '—'}</dd>
            <dt className="text-slate-500">Batch</dt>
            <dd className="font-mono">{batch.batch_no}</dd>
            <dt className="text-slate-500">Expiry</dt>
            <dd className={expiryRowClass(batch.expiry_date)}>{safeFormat(batch.expiry_date, 'dd MMM yyyy')}</dd>
            <dt className="text-slate-500">Stock</dt>
            <dd>
              {formatPackAndBaseStock(qty, perPack, packLabel, baseLabel)}
              {perPack > 1 && (
                <span className="text-slate-400 ml-1 font-mono">
                  ({qty % 1 === 0 ? qty : qty.toFixed(2)} {baseLabel})
                </span>
              )}
            </dd>
            <dt className="text-slate-500">MRP</dt>
            <dd className="tabular-nums">₹{Number(batch.mrp ?? 0).toFixed(2)}</dd>
            <dt className="text-slate-500">Sale rate</dt>
            <dd className="tabular-nums">₹{Number(batch.sale_rate ?? 0).toFixed(2)}</dd>
            <dt className="text-slate-500">Purchase (cost)</dt>
            <dd className="tabular-nums text-slate-600">₹{Number(batch.unit_cost ?? 0).toFixed(2)}</dd>
          </dl>
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Stock log (recent)</div>
            {loading && <div className="text-slate-400">Loading…</div>}
            {!loading && rows.length === 0 && <div className="text-slate-400">No ledger rows.</div>}
            {!loading && rows.length > 0 && (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 border-b border-slate-50 pb-0.5">
                    <span className="text-slate-600 truncate">
                      <span className="font-semibold text-slate-700">{formatStockLedgerLabel(r)}</span>
                      {r.created_at && (
                        <span className="text-slate-400 font-normal ml-1">
                          · {safeFormat(r.created_at, 'dd MMM yy HH:mm')}
                        </span>
                      )}
                    </span>
                    <span className={`font-mono shrink-0 ${Number(r.qty_change) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {Number(r.qty_change) > 0 ? '+' : ''}
                      {r.qty_change}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="px-3 py-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="w-full py-1.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function InventoryEditRateModal({ batch, medicine, onClose, onSaved }) {
  const [mrp, setMrp] = useState(String(batch.mrp ?? ''))
  const [sale, setSale] = useState(String(batch.sale_rate ?? ''))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api.patch(`/batches/${batch.id}/`, {
        mrp: Number(mrp) || 0,
        sale_rate: Number(sale) || 0,
      })
      toast.success('Rates updated')
      onSaved?.()
    } catch (e) {
      toast.error(parseApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm border border-slate-200 p-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit rates"
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-bold text-slate-800">Edit rate</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <p className="text-[9px] text-slate-500 mb-2 truncate" title={medicine?.name}>
          {medicine?.name} · <span className="font-mono">{batch.batch_no}</span>
        </p>
        <p className="text-[9px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-1.5 py-1 mb-2">
          Only MRP and sale rate can be changed. Stock, batch, expiry, and purchase cost come from purchase / system.
        </p>
        <label className="block mb-2">
          <span className="text-[9px] font-semibold text-slate-600">MRP (₹)</span>
          <input
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
            className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs tabular-nums"
            inputMode="decimal"
          />
        </label>
        <label className="block mb-3">
          <span className="text-[9px] font-semibold text-slate-600">Sale rate (₹)</span>
          <input
            value={sale}
            onChange={(e) => setSale(e.target.value)}
            className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs tabular-nums"
            inputMode="decimal"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-1.5 rounded border border-slate-200 text-[10px] font-semibold">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="flex-1 py-1.5 rounded bg-blue-600 text-white text-[10px] font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InventoryAdjustStockModal({ batch, medicine, medicineCategoryRows = [], allowNegative, onClose, onSaved }) {
  const [adjustQty, setAdjustQty] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [ledgerRows, setLedgerRows] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLedgerLoading(true)
    api
      .get(`/stock-ledgers/?batch=${batch.id}&limit=80`)
      .then((res) => {
        const list = sortLedgerChronological(normalizeStockLedgerList(res))
        if (!cancelled) setLedgerRows(list)
      })
      .catch(() => {
        if (!cancelled) setLedgerRows([])
      })
      .finally(() => {
        if (!cancelled) setLedgerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [batch.id])

  const current = Number(batch.quantity ?? 0)
  const { baseLabel: stockBaseLabel } = inventoryQtyLabels(medicine, medicineCategoryRows)
  const adj = adjustQty === '' || adjustQty === '-' ? 0 : Number(adjustQty)
  const projected = current + (Number.isFinite(adj) ? adj : 0)
  const invalidAdj = !Number.isFinite(adj) || adj === 0

  async function save() {
    if (!reason.trim()) {
      toast.error('Enter a reason for the adjustment')
      return
    }
    if (invalidAdj) {
      toast.error('Enter a non-zero adjustment (+ or −)')
      return
    }
    if (projected < 0 && !allowNegative) {
      toast.error('Would result in negative stock. Enable “Allow negative stock” or reduce the deduction.')
      return
    }
    setSaving(true)
    try {
      await api.post('/stock-ledgers/', {
        medicine: batch.medicine,
        batch: batch.id,
        reason: 'adjust',
        qty_change: String(adj),
        reference_type: 'inventory_adjust',
        reference_id: reason.trim().slice(0, 100),
        allow_negative_stock: allowNegative,
      })
      toast.success('Stock adjustment saved')
      try {
        const res = await api.get(`/stock-ledgers/?batch=${batch.id}&limit=80`)
        setLedgerRows(sortLedgerChronological(normalizeStockLedgerList(res)))
      } catch {
        /* ignore */
      }
      onSaved?.()
    } catch (e) {
      toast.error(parseApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm border border-slate-200 p-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Adjust stock"
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-bold text-slate-800">Adjust stock</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2 text-[10px]">
          <div>
            <span className="text-slate-500">Medicine</span>
            <div className="font-semibold text-slate-900 truncate">{medicine?.name ?? '—'}</div>
          </div>
          <div>
            <span className="text-slate-500">Batch</span>
            <div className="font-mono">{batch.batch_no}</div>
          </div>
          <div>
            <span className="text-slate-500">Current stock</span>
            <div className="font-mono font-semibold text-emerald-800">
              {current % 1 === 0 ? current : current.toFixed(3)} <span className="font-sans font-medium">{stockBaseLabel}</span>
            </div>
          </div>
          <div className="rounded border border-slate-100 bg-slate-50/80 px-2 py-1.5">
            <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Stock history</div>
            {ledgerLoading && <div className="text-slate-400 text-[10px]">Loading…</div>}
            {!ledgerLoading && ledgerRows.length === 0 && (
              <div className="text-slate-400 text-[10px]">No movements yet.</div>
            )}
            {!ledgerLoading && ledgerRows.length > 0 && (
              <ul className="space-y-1 max-h-32 overflow-y-auto text-[10px]">
                {ledgerRows.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 border-b border-slate-100/80 pb-0.5 last:border-0">
                    <span className="text-slate-600 min-w-0 truncate">
                      <span
                        className={
                          String(r.reference_type || '').toLowerCase() === 'opening_stock'
                            ? 'font-semibold text-indigo-800'
                            : 'font-medium text-slate-800'
                        }
                      >
                        {formatStockLedgerLabel(r)}
                      </span>
                      {r.created_at && (
                        <span className="text-slate-400 font-normal"> · {safeFormat(r.created_at, 'dd MMM yy HH:mm')}</span>
                      )}
                    </span>
                    <span
                      className={`font-mono shrink-0 ${Number(r.qty_change) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}
                    >
                      {Number(r.qty_change) > 0 ? '+' : ''}
                      {r.qty_change}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="block">
            <span className="text-[9px] font-semibold text-slate-600">
              Adjust qty (+ in / − out) · {stockBaseLabel}
            </span>
            <input
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono"
              placeholder="e.g. -5 or 10"
              inputMode="decimal"
            />
          </label>
          <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
            <span className="text-slate-500">New stock</span>
            <div className={`font-mono font-semibold ${projected < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {Number.isFinite(projected) ? (projected % 1 === 0 ? projected : projected.toFixed(3)) : '—'}{' '}
              <span className="font-sans font-medium">{stockBaseLabel}</span>
            </div>
            {projected < 0 && !allowNegative && (
              <div className="text-[9px] text-rose-600 mt-0.5">Blocked: negative not allowed (see toolbar toggle).</div>
            )}
            {projected < 0 && allowNegative && (
              <div className="text-[9px] text-amber-700 mt-0.5">Warning: stock will be negative.</div>
            )}
          </div>
          <label className="block">
            <span className="text-[9px] font-semibold text-slate-600">Reason *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs resize-none"
              placeholder="e.g. Physical count variance, breakage…"
            />
          </label>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onClose} className="flex-1 py-1.5 rounded border border-slate-200 text-[10px] font-semibold">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="flex-1 py-1.5 rounded bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save adjustment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryView({ invoices: _invoices, setPrintingInvoice }) {
  const PAGE_SIZE = 15
  const [subView, setSubView] = useState('register')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [editInv, setEditInv] = useState(null)
  const [pendingRows, setPendingRows] = useState([])
  const [pendingMeta, setPendingMeta] = useState({ total_pending_amount: '0.00', total_patients: 0 })
  const [pendingLoading, setPendingLoading] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/pharmacy/invoices/', {
        params: { limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: q || undefined },
      })
      setRows(data?.data || data?.results || [])
      setTotal(Number(data?.count || data?.meta?.total || 0))
    } catch {
      toast.error('Failed to load sale register')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    if (subView === 'register') fetchRows()
  }, [fetchRows, subView])

  const fetchPendingRows = useCallback(async () => {
    setPendingLoading(true)
    try {
      const { data } = await api.get('/pharmacy/invoices/pending-credits/', {
        params: { search: q || undefined },
      })
      setPendingRows(data?.data || [])
      setPendingMeta({
        total_pending_amount: data?.meta?.total_pending_amount || '0.00',
        total_patients: Number(data?.meta?.total_patients || 0),
      })
    } catch {
      toast.error('Failed to load pending credit list')
      setPendingRows([])
      setPendingMeta({ total_pending_amount: '0.00', total_patients: 0 })
    } finally {
      setPendingLoading(false)
    }
  }, [q])

  useEffect(() => {
    if (subView === 'pending') fetchPendingRows()
  }, [fetchPendingRows, subView])

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden min-h-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Pharmacy register</h2>
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setSubView('register')
                setPage(0)
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                subView === 'register' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Sale register
            </button>
            <button
              type="button"
              onClick={() => setSubView('pending')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                subView === 'pending' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Pending credit
            </button>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={q}
            onChange={(e) => {
              setPage(0)
              setQ(e.target.value)
            }}
            placeholder={subView === 'pending' ? 'Search patient / UHID / invoice' : 'Search invoice / patient'}
            className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 py-1.5 text-xs outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {subView === 'register' ? (
        <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-y-auto min-h-0 shadow-sm">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-gradient-to-b from-slate-100 to-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Due</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No invoices found</td></tr>
              ) : rows.map((inv) => {
                const totalAmt = Number(inv.grand_total || 0)
                const paidAmt = Number(inv.paid_amount || 0)
                const dueAmt = Math.max(0, Number(inv.due_amount ?? totalAmt - paidAmt))
                return (
                  <tr key={inv.id} className="hover:bg-indigo-50/30">
                    <td className="px-3 py-2 text-blue-700 font-mono text-[10px]">#{inv.invoice_no}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {inv.patient_details?.first_name} {inv.patient_details?.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400">{safeFormat(inv.created_at, 'dd MMM yy HH:mm')}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] uppercase font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {inv.payment_method || 'cash'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">₹{paidAmt.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-700">₹{dueAmt.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold">₹{totalAmt.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPrintingInvoice(inv)}
                          className="px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-semibold"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditInv(inv)}
                          className="px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-y-auto min-h-0 shadow-sm p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">Patients with pending pharmacy credit</div>
            <div className="text-sm font-bold text-rose-700">
              Total pending: ₹{Number(pendingMeta.total_pending_amount || 0).toFixed(2)}
            </div>
          </div>
          {pendingLoading ? (
            <div className="px-3 py-8 text-center text-slate-400 text-sm">Loading pending credits…</div>
          ) : pendingRows.length === 0 ? (
            <div className="px-3 py-8 text-center text-slate-400 text-sm">No pending credit bills found</div>
          ) : (
            <div className="space-y-3">
              {pendingRows.map((pt) => (
                <div key={pt.patient_id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{pt.patient_name}</div>
                      <div className="text-[10px] text-slate-500">
                        UHID: {pt.uhid || '—'}{pt.phone ? ` · ${pt.phone}` : ''} · Bills: {pt.bill_count}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-amber-700">
                      ₹{Number(pt.total_pending_amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-white text-[10px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-right">Paid</th>
                          <th className="px-3 py-2 text-right">Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(pt.bills || []).map((bill) => (
                          <tr key={bill.id}>
                            <td className="px-3 py-2 font-mono text-blue-700">#{bill.invoice_no}</td>
                            <td className="px-3 py-2 text-slate-600">{safeFormat(bill.date, 'dd MMM yyyy')}</td>
                            <td className="px-3 py-2 text-right">₹{Number(bill.grand_total || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">₹{Number(bill.paid_amount || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-amber-700">
                              ₹{Number(bill.due_amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subView === 'register' ? (
        <div className="shrink-0 flex items-center justify-between text-xs text-slate-600">
          <span>
            {total === 0 ? 'No records' : `Showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 text-xs text-slate-600">
          {pendingMeta.total_patients || 0} patient(s) with pending credit
        </div>
      )}

      {editInv ? (
        <EditSaleInvoiceModal
          invoice={editInv}
          onClose={() => setEditInv(null)}
          onSaved={() => {
            setEditInv(null)
            fetchRows()
          }}
        />
      ) : null}
    </div>
  )
}

function EditSaleInvoiceModal({ invoice, onClose, onSaved }) {
  const patientInfo = invoice?.patient_details || {}
  const initialName = [patientInfo.first_name, patientInfo.last_name].filter(Boolean).join(' ').trim()
  const [paymentMethod, setPaymentMethod] = useState(invoice.payment_method || 'cash')
  const [paidAmount, setPaidAmount] = useState(String(invoice.paid_amount ?? invoice.grand_total ?? '0'))
  const [remarks, setRemarks] = useState(invoice.remarks || '')
  const [settlementType, setSettlementType] = useState(() => {
    const due = Number(invoice.due_amount ?? (Number(invoice.grand_total || 0) - Number(invoice.paid_amount || 0)))
    return due > 0 ? 'due' : 'paid'
  })
  const [patientName, setPatientName] = useState(initialName)
  const [patientPhone, setPatientPhone] = useState(patientInfo.phone || '')
  const [patientGender, setPatientGender] = useState(patientInfo.gender || 'male')
  const [patientAge, setPatientAge] = useState(patientInfo.age != null ? String(patientInfo.age) : '')
  const [guardianName, setGuardianName] = useState(patientInfo.guardian_name || '')
  const [addressLine1, setAddressLine1] = useState(patientInfo.address_line1 || '')
  const [city, setCity] = useState(patientInfo.city || '')
  const [state, setState] = useState(patientInfo.state || '')
  const [medicines, setMedicines] = useState([])
  const [batches, setBatches] = useState([])
  const [items, setItems] = useState(() =>
    Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items.map((it) => ({
          medicine: String(it.medicine || ''),
          batch: String(it.batch || ''),
          qty: String(it.qty ?? '1'),
          mrp: String(it.mrp ?? '0'),
          rate: String(it.rate ?? '0'),
          cgst_rate: String(it.cgst_rate ?? '0'),
          sgst_rate: String(it.sgst_rate ?? '0'),
        }))
      : [{ medicine: '', batch: '', qty: '1', mrp: '0', rate: '0', cgst_rate: '0', sgst_rate: '0' }],
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/medicines/?limit=2000').catch(() => ({ data: [] })),
      api.get('/batches/?limit=4000').catch(() => ({ data: [] })),
    ]).then(([mRes, bRes]) => {
      if (cancelled) return
      setMedicines(mRes.data?.data || mRes.data?.results || [])
      setBatches(bRes.data?.data || bRes.data?.results || [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const totals = useMemo(() => {
    let subtotal = 0
    let cgst = 0
    let sgst = 0
    items.forEach((row) => {
      const qty = Number(row.qty || 0)
      const rate = Number(row.rate || 0)
      const cg = Number(row.cgst_rate || 0)
      const sg = Number(row.sgst_rate || 0)
      const base = qty * rate
      subtotal += base
      cgst += (base * cg) / 100
      sgst += (base * sg) / 100
    })
    const grandTotal = subtotal + cgst + sgst
    const paid = paymentMethod === 'credit' ? 0 : Number(paidAmount || 0)
    const due = Math.max(0, grandTotal - Math.max(0, paid))
    return { subtotal, cgst, sgst, grandTotal, due }
  }, [items, paymentMethod, paidAmount])

  useEffect(() => {
    if (settlementType === 'due') {
      setPaymentMethod('credit')
      setPaidAmount('0')
    } else {
      if (paymentMethod === 'credit') {
        setPaymentMethod('cash')
      }
      // For "Paid", always use the latest recalculated edited bill total.
      setPaidAmount(String((totals?.grandTotal || 0).toFixed(2)))
    }
  }, [settlementType, paymentMethod, totals?.grandTotal])

  function updateItem(index, patch) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addItem() {
    setItems((prev) => [...prev, { medicine: '', batch: '', qty: '1', mrp: '0', rate: '0', cgst_rate: '0', sgst_rate: '0' }])
  }

  function removeItem(index) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function handleMedicineChange(index, medicineId) {
    const med = medicines.find((m) => String(m.id) === String(medicineId))
    const medBatches = batches
      .filter((b) => String(b.medicine) === String(medicineId))
      .sort((a, b) => new Date(a.expiry_date || 0).getTime() - new Date(b.expiry_date || 0).getTime())
    const firstBatch = medBatches[0] || null
    const gst = Number(med?.gst_percent || 0)
    const half = gst > 0 ? (gst / 2) : 0
    updateItem(index, {
      medicine: medicineId,
      batch: firstBatch ? String(firstBatch.id) : '',
      mrp: firstBatch ? String(firstBatch.mrp ?? 0) : '0',
      rate: firstBatch ? String(firstBatch.sale_rate ?? firstBatch.mrp ?? 0) : '0',
      cgst_rate: String(half),
      sgst_rate: String(half),
    })
  }

  function handleBatchChange(index, batchId) {
    const selectedBatch = batches.find((b) => String(b.id) === String(batchId))
    if (!selectedBatch) {
      updateItem(index, { batch: '' })
      return
    }
    const med = medicines.find((m) => String(m.id) === String(selectedBatch.medicine))
    const gst = Number(med?.gst_percent || 0)
    const half = gst > 0 ? (gst / 2) : 0
    updateItem(index, {
      batch: String(batchId),
      mrp: String(selectedBatch.mrp ?? 0),
      rate: String(selectedBatch.sale_rate ?? selectedBatch.mrp ?? 0),
      cgst_rate: String(half),
      sgst_rate: String(half),
    })
  }

  async function save() {
    const validItems = items
      .map((row) => ({
        medicine: row.medicine,
        batch: row.batch,
        qty: Number(row.qty || 0),
        mrp: Number(row.mrp || 0),
        rate: Number(row.rate || 0),
        cgst_rate: Number(row.cgst_rate || 0),
        sgst_rate: Number(row.sgst_rate || 0),
      }))
      .filter((row) => row.medicine && row.batch && row.qty > 0)
    if (validItems.length === 0) {
      toast.error('Add at least one valid medicine row')
      return
    }

    const fullName = String(patientName || '').trim()
    const parts = fullName.split(/\s+/).filter(Boolean)
    if (parts.length === 0) {
      toast.error('Patient name is required')
      return
    }

    setSaving(true)
    try {
      await api.patch(`/pharmacy/invoices/${invoice.id}/update-full/`, {
        patient: {
          first_name: parts[0],
          last_name: parts.slice(1).join(' '),
          phone: patientPhone || '',
          gender: patientGender || 'male',
          age: patientAge === '' ? null : Number(patientAge),
          guardian_name: guardianName || '',
          address_line1: addressLine1 || '',
          city: city || '',
          state: state || '',
        },
        invoice: {
          payment_method: settlementType === 'due' ? 'credit' : paymentMethod,
          paid_amount: settlementType === 'due' ? 0 : Number(totals.grandTotal || 0),
          remarks,
          total_discount: Number(invoice.total_discount || 0),
        },
        items: validItems,
      })
      toast.success('Invoice updated')
      onSaved?.()
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to update invoice'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">Edit sale invoice</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Patient name</span>
              <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Phone</span>
              <input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Gender</span>
              <select value={patientGender} onChange={(e) => setPatientGender(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Age</span>
              <input type="number" min="0" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Guardian</span>
              <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Address</span>
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">City</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">State</span>
              <input value={state} onChange={(e) => setState(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-2 py-2 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">Medicines</span>
              <button type="button" onClick={addItem} className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-semibold">+ Add row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-white text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-2 py-1 text-left">Medicine</th>
                    <th className="px-2 py-1 text-left">Batch</th>
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1 text-right">MRP</th>
                    <th className="px-2 py-1 text-right">Rate</th>
                    <th className="px-2 py-1 text-right">CGST%</th>
                    <th className="px-2 py-1 text-right">SGST%</th>
                    <th className="px-2 py-1 text-right">Line</th>
                    <th className="px-2 py-1 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => {
                    const medBatches = batches.filter((b) => String(b.medicine) === String(row.medicine))
                    const line = (Number(row.qty || 0) * Number(row.rate || 0)) * (1 + (Number(row.cgst_rate || 0) + Number(row.sgst_rate || 0)) / 100)
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1 min-w-[190px]">
                          <select value={row.medicine} onChange={(e) => handleMedicineChange(idx, e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1 bg-white">
                            <option value="">Select</option>
                            {medicines.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 min-w-[160px]">
                          <select value={row.batch} onChange={(e) => handleBatchChange(idx, e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1 bg-white">
                            <option value="">Select</option>
                            {medBatches.map((b) => <option key={b.id} value={String(b.id)}>{b.batch_no}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="number" min="0.01" step="0.01" value={row.qty} onChange={(e) => updateItem(idx, { qty: e.target.value })} className="w-20 rounded border border-slate-200 px-2 py-1 text-right" /></td>
                        <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={row.mrp} onChange={(e) => updateItem(idx, { mrp: e.target.value })} className="w-20 rounded border border-slate-200 px-2 py-1 text-right" /></td>
                        <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={row.rate} onChange={(e) => updateItem(idx, { rate: e.target.value })} className="w-20 rounded border border-slate-200 px-2 py-1 text-right" /></td>
                        <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={row.cgst_rate} onChange={(e) => updateItem(idx, { cgst_rate: e.target.value })} className="w-16 rounded border border-slate-200 px-2 py-1 text-right" /></td>
                        <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={row.sgst_rate} onChange={(e) => updateItem(idx, { sgst_rate: e.target.value })} className="w-16 rounded border border-slate-200 px-2 py-1 text-right" /></td>
                        <td className="px-2 py-1 text-right font-semibold">₹{Number.isFinite(line) ? line.toFixed(2) : '0.00'}</td>
                        <td className="px-2 py-1 text-right">
                          <button type="button" onClick={() => removeItem(idx)} className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-semibold">Del</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Settlement</span>
              <select
                value={settlementType}
                onChange={(e) => setSettlementType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
              >
                <option value="paid">Paid</option>
                <option value="due">Due</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Payment method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={settlementType === 'due'}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
              >
                {['cash', 'upi', 'other', 'bank_transfer', 'credit'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Paid amount</span>
              <input
                type="number"
                value={settlementType === 'due' ? '0' : Number(totals.grandTotal || 0).toFixed(2)}
                readOnly
                disabled
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Remarks</span>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="rounded border border-slate-200 p-2"><div className="text-slate-500">Subtotal</div><div className="font-bold">₹{totals.subtotal.toFixed(2)}</div></div>
            <div className="rounded border border-slate-200 p-2"><div className="text-slate-500">CGST</div><div className="font-bold">₹{totals.cgst.toFixed(2)}</div></div>
            <div className="rounded border border-slate-200 p-2"><div className="text-slate-500">SGST</div><div className="font-bold">₹{totals.sgst.toFixed(2)}</div></div>
            <div className="rounded border border-slate-200 p-2"><div className="text-slate-500">Grand total</div><div className="font-bold">₹{totals.grandTotal.toFixed(2)}</div></div>
            <div className="rounded border border-slate-200 p-2"><div className="text-slate-500">Due</div><div className="font-bold text-amber-700">₹{totals.due.toFixed(2)}</div></div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function resolveNewMedicineDefaultGst(defaultGstPercent) {
  const s = defaultGstPercent != null && String(defaultGstPercent).trim() !== '' ? String(defaultGstPercent).trim() : ''
  if (s === '') return '5'
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? String(n) : '5'
}

function resolveNewMedicineDefaultDiscount(defaultDiscountPercent) {
  const s =
    defaultDiscountPercent != null && String(defaultDiscountPercent).trim() !== ''
      ? String(defaultDiscountPercent).trim()
      : ''
  if (s === '') return '0'
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? String(n) : '0'
}

const DEFAULT_PRODUCT_FORMS = [
  'Tablet', 'Syrup', 'Capsule', 'Injection', 'Cream', 'Powder', 'Drops', 'Surgicals', 'Liquid', 'Gel',
  'Suspension', 'Lotion', 'Soap', 'Oil', 'Ointment', 'Kit', 'Bandage', 'Device', 'Spray', 'Shampoo',
  'Sachet', 'Packet', 'Bottle', 'Solution', 'Unit', 'Infusion', 'Box', 'Elixir', 'Paste', 'Balm',
  'Strip', 'Vaccine', 'Suppository', 'Patch', 'Jar', 'Tonic', 'Vial', 'Ampules', 'Pen',
]

function uniqText(values) {
  const seen = new Set()
  const out = []
  values.forEach((v) => {
    const raw = (v || '').trim()
    if (!raw) return
    const key = raw.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(raw)
  })
  return out
}

/** Unit-level MRP, sale rate, cost, and discount % for Add Medicine (matches pack vs unit input mode). */
function discountPercentFromMrpAndRate(mrp, rate) {
  const m = Number(mrp) || 0
  const rt = Number(rate) || 0
  if (!(m > 0)) return 0
  const raw = ((m - rt) / m) * 100
  if (!Number.isFinite(raw)) return 0
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100))
}

function computeUnitPricingForAddMedicine(data, unitsPerPack) {
  const up = unitsPerPack > 0 ? unitsPerPack : 1
  const enteredMrp = Number(data.mrp) || 0
  const unitMrpRaw = data.mrp_input_type === 'pack' && up > 1 ? enteredMrp / up : enteredMrp
  const unitMrp = Math.round(unitMrpRaw * 100) / 100

  const saleStr = String(data.selling_price ?? '').trim()
  let unitSale
  if (saleStr === '') {
    unitSale = unitMrp
  } else {
    const enteredSale = Number(data.selling_price) || 0
    const raw = data.mrp_input_type === 'pack' && up > 1 ? enteredSale / up : enteredSale
    unitSale = Math.round(raw * 100) / 100
  }

  const costStr = String(data.cost_price ?? '').trim()
  let unitCost
  if (costStr === '') {
    unitCost = 0
  } else {
    const enteredCost = Number(data.cost_price) || 0
    const raw = data.mrp_input_type === 'pack' && up > 1 ? enteredCost / up : enteredCost
    unitCost = Math.round(raw * 100) / 100
  }

  const discountPct = unitMrp > 0 ? Math.round(((unitMrp - unitSale) / unitMrp) * 10000) / 100 : null

  return { unitMrp, unitSale, unitCost, discountPct }
}

function formatMoneyInput(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return n.toFixed(2)
}

function normalizeNonNegativeNumberInput(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return ''
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return null
  return text
}

function formatStockNumber(value) {
  if (!Number.isFinite(value)) return ''
  if (value % 1 === 0) return String(value)
  return String(Math.round(value * 1000) / 1000)
}

function AddMedicineModal({ onClose, onRefresh, defaultGstPercent, defaultSaleDiscountPercent }) {
  const fallbackGstStr = resolveNewMedicineDefaultGst(defaultGstPercent)
  const fallbackDiscountStr = resolveNewMedicineDefaultDiscount(defaultSaleDiscountPercent)
  const [data, setData] = useState({
    name: '',
    company_name: '',
    form: '',
    composition: '',
    mrp: '',
    selling_price: '',
    discount_percent: fallbackDiscountStr,
    cost_price: '',
    mrp_input_type: 'unit',
    price_tax_mode: 'exclusive',
    units_per_pack: '',
    gst_percent: fallbackGstStr,
    no_gst: false,
    add_batch: true,
    batch_mode: 'new',
    existing_batch_id: '',
    batch_no: '',
    expiry_date: '',
    opening_stock_qty: '',
    opening_stock_pack_qty: '',
  })
  const [units, setUnits] = useState([])
  const [forms, setForms] = useState([])
  const [batchOptions, setBatchOptions] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [showFormOptions, setShowFormOptions] = useState(false)
  const [creatingForm, setCreatingForm] = useState(false)
  const [openingStockEditedBy, setOpeningStockEditedBy] = useState('units')
  const [medicineCategoryRows, setMedicineCategoryRows] = useState([])
  const [pricingEditedBy, setPricingEditedBy] = useState(
    Number(fallbackDiscountStr || 0) > 0 ? 'discount' : 'selling',
  )

  const unitPricingPreview = useMemo(() => {
    const unitsPerPack =
      data.mrp_input_type === 'unit'
        ? 1
        : Math.max(0, Number(data.units_per_pack) || 0)
    if (data.mrp_input_type === 'pack' && !(unitsPerPack > 0)) return null
    return computeUnitPricingForAddMedicine(data, unitsPerPack)
  }, [data])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/units/?limit=100').catch(() => ({ data: [] })),
      api.get('/medicine-categories/?limit=500').catch(() => ({ data: [] })),
      api.get('/medicines/?limit=2000').catch(() => ({ data: [] })),
      api.get('/batches/?limit=1000').catch(() => ({ data: [] })),
    ])
      .then(([uRes, cRes, mRes, bRes]) => {
        if (cancelled) return
        const unitsList = uRes.data?.data || uRes.data?.results || []
        setUnits(Array.isArray(unitsList) ? unitsList : [])

        const catRows = cRes.data?.data || cRes.data?.results || []
        const catList = Array.isArray(catRows) ? catRows : []
        setMedicineCategoryRows(catList)
        const catNames = catList.map((r) => r.name)

        const medRows = mRes.data?.data || mRes.data?.results || []
        const medForms = Array.isArray(medRows) ? medRows.map((m) => m.form) : []

        setForms(uniqText([...catNames, ...medForms, ...DEFAULT_PRODUCT_FORMS]))
        const bRows = bRes.data?.data || bRes.data?.results || []
        setBatchOptions(Array.isArray(bRows) ? bRows : [])
      })
      .catch(() => {
        if (cancelled) return
        setUnits([])
        setMedicineCategoryRows([])
        setForms(DEFAULT_PRODUCT_FORMS)
        setBatchOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pricingLocked = !!(data.add_batch && data.batch_mode === 'existing' && data.existing_batch_id)
  const openingUnitsPerPack = Math.max(0, Number(data.units_per_pack) || 0)
  const activeCategoryRules = useMemo(
    () => resolveCategoryRules(data.form, medicineCategoryRows),
    [data.form, medicineCategoryRows],
  )
  const conversionHints = useMemo(
    () => conversionHintLines(activeCategoryRules, data.units_per_pack, data.mrp_input_type),
    [activeCategoryRules, data.units_per_pack, data.mrp_input_type],
  )

  useEffect(() => {
    if (!data.add_batch || data.batch_mode !== 'existing' || !data.existing_batch_id) return
    const b = batchOptions.find((x) => String(x.id) === String(data.existing_batch_id))
    if (!b) return
    const uMrp = Number(b.mrp) || 0
    const uSale = Number(b.sale_rate) || 0
    const uCost = Number(b.unit_cost) || 0
    const up =
      data.mrp_input_type === 'unit'
        ? 1
        : Math.max(1, Number(data.units_per_pack) || 1)
    const mult = data.mrp_input_type === 'pack' && up > 1 ? up : 1
    setData((d) => ({
      ...d,
      mrp: formatMoneyInput(uMrp * mult),
      selling_price: formatMoneyInput(uSale * mult),
      discount_percent: discountPercentFromMrpAndRate(uMrp, uSale).toFixed(2),
      cost_price: formatMoneyInput(uCost * mult),
    }))
    setPricingEditedBy('selling')
  }, [data.add_batch, data.batch_mode, data.existing_batch_id, batchOptions, data.mrp_input_type, data.units_per_pack])

  useEffect(() => {
    if (pricingLocked) return
    if (pricingEditedBy !== 'discount') return
    const enteredMrp = Number(data.mrp)
    if (!(Number.isFinite(enteredMrp) && enteredMrp > 0)) return
    const discountRaw = String(data.discount_percent ?? '').trim()
    if (discountRaw === '' || discountRaw === '.' || discountRaw === '-') return
    const discountPct = Math.min(100, Math.max(0, Number(discountRaw) || 0))
    const saleEntered = enteredMrp * (1 - discountPct / 100)
    const saleNormalized = Math.round(saleEntered * 100) / 100
    const saleText = String(data.selling_price ?? '').trim()
    const currentSale = saleText === '' || saleText === '.' || saleText === '-' ? null : Number(saleText)
    if (currentSale != null && Number.isFinite(currentSale) && Math.abs(currentSale - saleNormalized) < 0.005) return
    setData((d) => ({ ...d, selling_price: formatMoneyInput(saleNormalized) }))
  }, [data.discount_percent, data.mrp, pricingEditedBy, pricingLocked])

  useEffect(() => {
    if (pricingLocked) return
    if (pricingEditedBy !== 'selling') return
    const unitsPerPack =
      data.mrp_input_type === 'unit'
        ? 1
        : Math.max(0, Number(data.units_per_pack) || 0)
    if (data.mrp_input_type === 'pack' && !(unitsPerPack > 0)) return
    const preview = computeUnitPricingForAddMedicine(data, unitsPerPack)
    if (!(preview?.unitMrp > 0)) return
    const nextDiscount = preview.discountPct != null ? preview.discountPct.toFixed(2) : '0.00'
    if (String(data.discount_percent ?? '') === nextDiscount) return
    setData((d) => ({ ...d, discount_percent: nextDiscount }))
  }, [data.mrp, data.selling_price, data.mrp_input_type, data.units_per_pack, pricingEditedBy, pricingLocked])

  useEffect(() => {
    if (!data.add_batch) return
    if (data.mrp_input_type !== 'pack') {
      if (data.opening_stock_pack_qty !== '') {
        setData((d) => ({ ...d, opening_stock_pack_qty: '' }))
      }
      return
    }
    if (!(openingUnitsPerPack > 0)) {
      if (data.opening_stock_pack_qty !== '') {
        setData((d) => ({ ...d, opening_stock_pack_qty: '' }))
      }
      return
    }
    if (openingStockEditedBy === 'pack') {
      const packs = Number(data.opening_stock_pack_qty)
      if (data.opening_stock_pack_qty !== '' && Number.isFinite(packs) && packs >= 0) {
        const unitsValue = packs * openingUnitsPerPack
        const normalizedUnits = formatStockNumber(unitsValue)
        if (normalizedUnits !== data.opening_stock_qty) {
          setData((d) => ({ ...d, opening_stock_qty: normalizedUnits }))
        }
      }
      return
    }
    const unitsValue = Number(data.opening_stock_qty)
    if (data.opening_stock_qty !== '' && Number.isFinite(unitsValue) && unitsValue >= 0) {
      const packs = unitsValue / openingUnitsPerPack
      const normalizedPacks = formatStockNumber(packs)
      if (normalizedPacks !== data.opening_stock_pack_qty) {
        setData((d) => ({ ...d, opening_stock_pack_qty: normalizedPacks }))
      }
    }
  }, [
    data.add_batch,
    data.mrp_input_type,
    data.opening_stock_pack_qty,
    data.opening_stock_qty,
    openingStockEditedBy,
    openingUnitsPerPack,
  ])

  function handleOpeningStockUnitsChange(rawValue) {
    const normalized = normalizeNonNegativeNumberInput(rawValue)
    if (normalized === null) return
    setOpeningStockEditedBy('units')
    if (normalized === '') {
      setData((d) => ({ ...d, opening_stock_qty: '', opening_stock_pack_qty: '' }))
      return
    }
    const unitsValue = Number(normalized)
    if (data.mrp_input_type === 'pack' && openingUnitsPerPack > 0) {
      const packValue = formatStockNumber(unitsValue / openingUnitsPerPack)
      setData((d) => ({ ...d, opening_stock_qty: normalized, opening_stock_pack_qty: packValue }))
    } else {
      setData((d) => ({ ...d, opening_stock_qty: normalized, opening_stock_pack_qty: '' }))
    }
  }

  function handleOpeningStockPackChange(rawValue) {
    const normalized = normalizeNonNegativeNumberInput(rawValue)
    if (normalized === null) return
    setOpeningStockEditedBy('pack')
    if (normalized === '') {
      setData((d) => ({ ...d, opening_stock_pack_qty: '', opening_stock_qty: '' }))
      return
    }
    if (!(openingUnitsPerPack > 0)) {
      setData((d) => ({ ...d, opening_stock_pack_qty: normalized }))
      return
    }
    const packsValue = Number(normalized)
    const unitsValue = formatStockNumber(packsValue * openingUnitsPerPack)
    setData((d) => ({ ...d, opening_stock_pack_qty: normalized, opening_stock_qty: unitsValue }))
  }

  async function handleAdd() {
    if (!data.name.trim()) return toast.error('Product name is required')
    if (!data.form.trim()) return toast.error('Product form is required')
    if (!(Number(data.mrp) > 0)) return toast.error('MRP is required')
    const unitsPerPack =
      data.mrp_input_type === 'unit'
        ? 1
        : Math.max(0, Number(data.units_per_pack) || 0)
    if (!(unitsPerPack > 0)) return toast.error('Units per pack is required')
    if (data.add_batch && data.batch_mode === 'new' && !data.batch_no.trim()) return toast.error('Batch number is required')
    if (data.add_batch && data.batch_mode === 'new' && !data.expiry_date) return toast.error('Expiry date is required')
    if (data.add_batch && data.batch_mode === 'existing' && !data.existing_batch_id) {
      return toast.error('Select an existing batch')
    }
    const openStockRaw = String(data.opening_stock_qty ?? '').trim()
    if (data.add_batch && openStockRaw !== '') {
      const oq = Number(openStockRaw)
      if (!Number.isFinite(oq) || oq < 0) {
        return toast.error('Opening stock must be zero or a positive number')
      }
    }
    const { unitMrp, unitSale, unitCost } = computeUnitPricingForAddMedicine(data, unitsPerPack)
    if (!(unitMrp > 0)) {
      return toast.error('Derived unit MRP must be greater than zero')
    }
    if (!(unitSale > 0)) {
      return toast.error('Selling price must be greater than zero')
    }
    if (unitCost < 0) {
      return toast.error('Cost cannot be negative')
    }
    const unitId = units[0]?.id
    setSubmitting(true)
    try {
      let gstNum
      if (data.no_gst) {
        gstNum = 0
      } else {
        const t = String(data.gst_percent ?? '').trim()
        gstNum = t === '' ? Number(fallbackGstStr) : Number(t)
        if (!Number.isFinite(gstNum) || gstNum < 0) {
          toast.error('GST % must be zero or a valid number')
          setSubmitting(false)
          return
        }
      }
      const createdSku = `SKU-${Date.now()}`
      const medRes = await api.post('/medicines/', {
        sku: createdSku,
        name: data.name.trim(),
        company_name: data.company_name.trim(),
        form: data.form.trim(),
        composition: data.composition.trim(),
        strength: data.composition.trim(),
        pack_info: `1x${unitsPerPack}`,
        default_mrp: unitMrp.toFixed(2),
        unit_conversions: { strip: unitsPerPack },
        gst_percent: String(gstNum),
        ...(unitId ? { unit: unitId } : {}),
      })
      const createdMedicine = medRes?.data?.data || medRes?.data?.entity || medRes?.data
      let createdMedicineId = createdMedicine?.id
      if (!createdMedicineId) {
        const lookupRes = await api.get(`/medicines/?search=${encodeURIComponent(createdSku)}&limit=5`)
        const lookupRows = lookupRes?.data?.data || lookupRes?.data?.results || []
        const matched = Array.isArray(lookupRows)
          ? lookupRows.find((m) => String(m?.sku || '').trim() === createdSku)
          : null
        createdMedicineId = matched?.id
      }
      if (!createdMedicineId) {
        throw new Error('Medicine saved, but could not resolve created id for batch creation')
      }
      if (data.add_batch) {
        const existing = batchOptions.find((b) => String(b.id) === String(data.existing_batch_id))
        const batchNo = data.batch_mode === 'existing' ? (existing?.batch_no || '').trim() : data.batch_no.trim()
        const expiryDate = data.batch_mode === 'existing' ? existing?.expiry_date : data.expiry_date
        const batchUnitCost =
          data.batch_mode === 'existing' ? String(existing?.unit_cost ?? '0') : unitCost.toFixed(2)
        const batchMrp = data.batch_mode === 'existing' ? String(existing?.mrp ?? unitMrp.toFixed(2)) : unitMrp.toFixed(2)
        const batchSaleRate =
          data.batch_mode === 'existing' ? String(existing?.sale_rate ?? unitMrp.toFixed(2)) : unitSale.toFixed(2)
        const batchRes = await api.post('/batches/', {
          medicine: createdMedicineId,
          batch_no: batchNo,
          expiry_date: expiryDate,
          unit_cost: batchUnitCost,
          mrp: batchMrp,
          sale_rate: batchSaleRate,
        })
        const batchPayload = batchRes?.data?.data ?? batchRes?.data?.entity ?? batchRes?.data
        const newBatchId = batchPayload?.id ?? batchRes?.data?.id
        const openStockRaw = String(data.opening_stock_qty ?? '').trim()
        const openQty = openStockRaw === '' ? 0 : Number(openStockRaw)
        let openingStockRecorded = false
        if (newBatchId && Number.isFinite(openQty) && openQty > 0) {
          try {
            await api.post('/stock-ledgers/', {
              medicine: createdMedicineId,
              batch: newBatchId,
              reason: 'stock_in',
              qty_change: String(openQty),
              reference_type: 'opening_stock',
              reference_id: 'create_product',
            })
            openingStockRecorded = true
          } catch (stockErr) {
            toast.error(
              parseApiError(stockErr) || 'Product saved, but opening stock could not be recorded. Adjust stock from Inventory.',
            )
          }
        } else if (openQty > 0 && !newBatchId) {
          toast.error('Batch was created but the response did not include an id; add stock from Inventory.')
        }
        const wantedOpening = Number.isFinite(openQty) && openQty > 0
        if (wantedOpening && openingStockRecorded) {
          toast.success('Medicine, batch, and opening stock saved')
        } else {
          toast.success('Medicine and batch created')
        }
      } else {
        toast.success('Medicine created (not visible in Inventory until a batch is added)')
      }
      onRefresh()
      onClose()
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        (typeof e?.response?.data === 'string' ? e.response.data : '') ||
        e?.message
      toast.error(detail || 'Could not create medicine')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredForms = forms.filter((f) =>
    f.toLowerCase().includes((data.form || '').toLowerCase().trim()),
  )
  const trimmedForm = (data.form || '').trim()
  const formExists = forms.some((f) => f.toLowerCase() === trimmedForm.toLowerCase())

  async function handleCreateForm() {
    const name = (data.form || '').trim()
    if (!name) {
      toast.error('Type a category name first')
      return
    }
    if (forms.some((f) => f.toLowerCase() === name.toLowerCase())) {
      toast('Category already exists')
      return
    }
    setCreatingForm(true)
    try {
      await api.post('/medicine-categories/', { name, is_active: true })
      setForms((prev) => uniqText([name, ...prev]))
      setData((d) => ({ ...d, form: name }))
      setShowFormOptions(false)
      toast.success('Category added')
    } catch {
      toast.error('Could not add category')
    } finally {
      setCreatingForm(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-2 md:p-3">
      <div className="bg-white w-[94vw] md:w-[min(72rem,96vw)] max-w-6xl max-h-[90vh] flex flex-col rounded-xl shadow-xl border border-slate-200 overflow-hidden origin-center scale-[0.88] md:scale-[0.92] lg:scale-[0.95]">
        <div className="p-2 shrink-0 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-[15px] font-bold text-slate-900">Create New Product</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        <div className="p-2 overflow-y-auto min-h-0 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 md:items-start">
            <section className="space-y-1 min-w-0 md:border-r md:border-slate-200 md:pr-3">
              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Product info</p>
              <div className="grid grid-cols-1 gap-1.5">
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Product Name*</span>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    placeholder="Type product name"
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Company Name</span>
                  <input
                    type="text"
                    value={data.company_name}
                    onChange={(e) => setData({ ...data, company_name: e.target.value })}
                    placeholder="Optional"
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Product Form*</span>
                  <div className="relative mt-1">
                    <input
                      value={data.form}
                      onFocus={() => setShowFormOptions(true)}
                      onBlur={() => setTimeout(() => setShowFormOptions(false), 120)}
                      onChange={(e) => {
                        setData({ ...data, form: e.target.value })
                        setShowFormOptions(true)
                      }}
                      placeholder="Search category..."
                      className="w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 bg-white"
                    />
                    {showFormOptions && (
                      <div className="absolute z-30 mt-1 w-full max-h-36 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
                        {filteredForms.length > 0 ? (
                          filteredForms.slice(0, 60).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setData((d) => ({ ...d, form: f }))
                                setShowFormOptions(false)
                              }}
                              className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50"
                            >
                              {f}
                            </button>
                          ))
                        ) : (
                          <div className="px-2 py-2 text-xs text-slate-500">No matching category</div>
                        )}
                        {!formExists && trimmedForm && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleCreateForm}
                            disabled={creatingForm}
                            className="w-full text-left px-2 py-1.5 text-xs font-semibold text-blue-700 border-t border-slate-100 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {creatingForm ? 'Adding category...' : `+ Add "${trimmedForm}" category`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Composition</span>
                  <input
                    type="text"
                    value={data.composition}
                    onChange={(e) => setData({ ...data, composition: e.target.value })}
                    placeholder="Optional"
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-1 min-w-0 border-t border-slate-100 pt-3 mt-1 md:mt-0 md:pt-0 md:border-t-0 md:border-r md:border-slate-200 md:pr-3">
              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Pricing</p>
              {pricingLocked && (
                <p className="text-[9px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1">
                  MRP, selling price, and cost are taken from the selected batch and cannot be edited. You can still
                  switch <strong>1 unit</strong> vs <strong>Full pack</strong> and set <strong>Units / pack</strong> for
                  how amounts are shown; opening stock and tax in <strong>Stock and Tax info</strong> stay editable.
                </p>
              )}
              <div className="grid grid-cols-1 gap-1.5">
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Price Input Type</span>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        setOpeningStockEditedBy('units')
                        setData((d) => ({ ...d, mrp_input_type: 'unit', units_per_pack: '1' }))
                      }}
                      className={`border rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        data.mrp_input_type === 'unit'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      1 unit
                    </button>
                    <button
                      type="button"
                      onClick={() => setData((d) => ({ ...d, mrp_input_type: 'pack' }))}
                      className={`border rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        data.mrp_input_type === 'pack'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      Full pack
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">
                    MRP* {data.mrp_input_type === 'pack' ? '(per pack)' : '(per unit)'}
                  </span>
                  <input
                    type="number"
                    value={data.mrp}
                    onChange={(e) => setData({ ...data, mrp: e.target.value })}
                    placeholder="0.00"
                    disabled={pricingLocked}
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Units / Pack*</span>
                  <input
                    type="number"
                    value={data.units_per_pack}
                    onChange={(e) => setData({ ...data, units_per_pack: e.target.value })}
                    placeholder={data.mrp_input_type === 'unit' ? '1 (fixed)' : 'e.g. 10'}
                    disabled={data.mrp_input_type === 'unit'}
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {data.form?.trim() && conversionHints.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[9px] text-indigo-800 font-medium list-disc pl-3.5">
                      {conversionHints.map((line, idx) => (
                        <li key={`${idx}-${line}`}>{line}</li>
                      ))}
                    </ul>
                  )}
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">
                    Selling price {data.mrp_input_type === 'pack' ? '(per pack)' : '(per unit)'}
                  </span>
                  <input
                    type="number"
                    value={data.selling_price}
                    onChange={(e) => {
                      setPricingEditedBy('selling')
                      setData({ ...data, selling_price: e.target.value })
                    }}
                    placeholder="Leave empty to use MRP"
                    disabled={pricingLocked}
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">
                    Cost price {data.mrp_input_type === 'pack' ? '(per pack)' : '(per unit)'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={data.cost_price}
                    onChange={(e) => setData({ ...data, cost_price: e.target.value })}
                    placeholder="Optional — purchase rate"
                    disabled={pricingLocked}
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Discount %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={data.discount_percent}
                    onChange={(e) => {
                      setPricingEditedBy('discount')
                      setData({ ...data, discount_percent: e.target.value })
                    }}
                    placeholder="0"
                    disabled={pricingLocked}
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                  />
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    Enter selling price to auto-calc discount, or enter discount to auto-calc selling price.
                  </p>
                </label>
              </div>
            </section>

            <section className="space-y-1 min-w-0 border-t border-slate-100 pt-3 mt-1 md:mt-0 md:pt-0 md:border-t-0">
              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Stock and Tax info</p>
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Batch</p>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!data.add_batch}
                  onChange={(e) => setData((d) => ({ ...d, add_batch: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <span className="text-[10px] text-slate-700 font-medium">Add opening batch now</span>
              </label>
              {data.add_batch && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5 w-full max-w-[320px]">
                    <button
                      type="button"
                      onClick={() => setData((d) => ({ ...d, batch_mode: 'new', existing_batch_id: '' }))}
                      className={`border rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        data.batch_mode === 'new'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      Create new batch
                    </button>
                    <button
                      type="button"
                      onClick={() => setData((d) => ({ ...d, batch_mode: 'existing' }))}
                      className={`border rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        data.batch_mode === 'existing'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      Use existing batch
                    </button>
                  </div>
                  {data.batch_mode === 'new' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      <label className="block">
                        <span className="text-[10px] font-semibold text-slate-700">Batch No*</span>
                        <input
                          type="text"
                          value={data.batch_no}
                          onChange={(e) => setData({ ...data, batch_no: e.target.value })}
                          placeholder="e.g. BATCH-001"
                          className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-semibold text-slate-700">Expiry Date*</span>
                        <input
                          type="date"
                          value={data.expiry_date}
                          onChange={(e) => setData({ ...data, expiry_date: e.target.value })}
                          className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-700">Select Existing Batch*</span>
                      <select
                        value={data.existing_batch_id}
                        onChange={(e) => setData((d) => ({ ...d, existing_batch_id: e.target.value }))}
                        className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="">Choose batch...</option>
                        {batchOptions.map((b) => {
                          const q = b.quantity != null ? Number(b.quantity) : null
                          const qStr =
                            q != null && Number.isFinite(q) ? (q % 1 === 0 ? String(q) : q.toFixed(3)) : '—'
                          return (
                            <option key={b.id} value={b.id}>
                              {b.batch_no} | exp {b.expiry_date || '--/--'} | ₹{Number(b.sale_rate || 0).toFixed(2)} | stock{' '}
                              {qStr}
                            </option>
                          )
                        })}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Copies selected batch details (batch no, expiry, rates) to this new product.
                      </p>
                    </label>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-slate-50">
                {data.add_batch && (
                  <div className="block">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Opening stock</span>
                    <div
                      className={`mt-1 grid gap-1.5 ${data.mrp_input_type === 'pack' ? 'grid-cols-2' : 'grid-cols-1'}`}
                    >
                      {data.mrp_input_type === 'pack' && (
                        <label className="block">
                          <span className="text-[10px] font-semibold text-slate-600">{packFieldLabel(activeCategoryRules)}</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={data.opening_stock_pack_qty}
                            onChange={(e) => handleOpeningStockPackChange(e.target.value)}
                            placeholder="0"
                            disabled={!(openingUnitsPerPack > 0)}
                            className="mt-0.5 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </label>
                      )}
                      <label className="block">
                        <span className="text-[10px] font-semibold text-slate-600">{baseFieldLabel(activeCategoryRules)}</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={data.opening_stock_qty}
                          onChange={(e) => handleOpeningStockUnitsChange(e.target.value)}
                          placeholder="0"
                          className="mt-0.5 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500"
                        />
                      </label>
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-500">
                      {data.mrp_input_type === 'unit'
                        ? `Enter opening stock in ${baseFieldLabel(activeCategoryRules).toLowerCase()} (same as inventory when pricing per unit).`
                        : openingUnitsPerPack > 0
                          ? `Linked: 1 ${packFieldLabel(activeCategoryRules).toLowerCase()} = ${openingUnitsPerPack} ${baseFieldLabel(activeCategoryRules).toLowerCase()} (edit either side).`
                          : `Set Units / Pack in Pricing first${data.form?.trim() ? ` — labels follow category “${data.form.trim()}”` : ''}.`}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Tax</span>
                </div>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Tax Mode</span>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setData((d) => ({ ...d, price_tax_mode: 'exclusive' }))}
                      className={`border rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        data.price_tax_mode === 'exclusive'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      Excluded
                    </button>
                    <button
                      type="button"
                      onClick={() => setData((d) => ({ ...d, price_tax_mode: 'inclusive' }))}
                      className={`border rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        data.price_tax_mode === 'inclusive'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      Included
                    </button>
                  </div>
                </label>
                <label className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-700">GST %</span>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!data.no_gst}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setData((d) => ({
                            ...d,
                            no_gst: checked,
                            gst_percent: checked ? '0' : d.gst_percent === '0' ? fallbackGstStr : d.gst_percent,
                          }))
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-[10px] text-slate-700">No GST</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={data.gst_percent}
                    onChange={(e) => setData({ ...data, gst_percent: e.target.value, no_gst: false })}
                    placeholder={fallbackGstStr}
                    disabled={!!data.no_gst}
                    className="mt-1 w-full h-7 border border-slate-300 rounded px-2 text-[11px] outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </label>
                <p className="text-[10px] text-slate-500">
                  {(() => {
                    if (!unitPricingPreview || !(unitPricingPreview.unitSale > 0)) {
                      return 'Enter MRP, units/pack, and selling price to preview GST on the unit sale rate.'
                    }
                    const unitBill = unitPricingPreview.unitSale
                    const gstPct = data.no_gst ? 0 : Math.max(0, Number(data.gst_percent || fallbackGstStr) || 0)
                    if (gstPct <= 0) return `Unit sale rate: ₹${unitBill.toFixed(2)} (No GST)`
                    if (data.price_tax_mode === 'inclusive') {
                      const base = unitBill / (1 + gstPct / 100)
                      const gstAmt = unitBill - base
                      return `GST included ${gstPct}% on sale rate: base ₹${base.toFixed(2)} + GST ₹${gstAmt.toFixed(2)}`
                    }
                    const gstAmt = unitBill * (gstPct / 100)
                    return `GST excluded ${gstPct}% on sale rate: taxable ₹${unitBill.toFixed(2)} + GST ₹${gstAmt.toFixed(2)}`
                  })()}
                </p>
              </div>
            </section>
          </div>
        </div>
        <div className="p-2 shrink-0 border-t border-slate-100 flex justify-end bg-white">
          <button
            type="button"
            onClick={handleAdd}
            disabled={submitting}
            className="bg-blue-600 text-white font-semibold h-8 rounded-md px-5 text-[13px] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? 'Creating…' : (
              <>
                <Plus size={16} /> Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddPatientModal({ onClose, onAdd }) {
  const [data, setData] = useState({ first_name: '', last_name: '', phone: '', gender: 'male' })
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd() {
    const firstName = (data.first_name || '').trim()
    const lastName = (data.last_name || '').trim()
    const phone = (data.phone || '').trim()
    if (!firstName || !phone) {
      toast.error('Name & phone required')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone,
        gender: data.gender || 'other',
      }
      const res = await api.post('/patients/', payload)
      toast.success('Patient registered')
      onAdd(res.data?.data || res.data)
    } catch (err) {
      toast.error(parseApiError(err) || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 z-[9999] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden">
        <div className="p-5">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-800">New patient</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3 grid grid-cols-2 gap-3">
            <label className="col-span-1">
              <span className="text-[10px] font-semibold text-slate-600">First name *</span>
              <input
                value={data.first_name}
                onChange={(e) => setData({ ...data, first_name: e.target.value })}
                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
            </label>
            <label className="col-span-1">
              <span className="text-[10px] font-semibold text-slate-600">Last name</span>
              <input
                value={data.last_name}
                onChange={(e) => setData({ ...data, last_name: e.target.value })}
                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
            </label>
            <label className="col-span-2">
              <span className="text-[10px] font-semibold text-slate-600">Mobile *</span>
              <input
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={submitting}
            className="w-full bg-blue-600 text-white font-medium py-2 rounded mt-4 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Saving…' : (
              <>
                <UserPlus size={14} /> Register
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
