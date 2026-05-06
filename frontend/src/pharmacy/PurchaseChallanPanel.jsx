import React, { memo, useCallback, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { computeMargPurchaseLineAmounts, parseApiError, parseOutletDefaultGstPercent } from './pharmacyCalculations'
import { PurchaseMedicinePicker } from './PurchaseMedicinePicker'
import { PurchaseSupplierPicker } from './PurchaseSupplierPicker'

const MIN_ROWS = 5

function todayISODate() {
  try {
    return new Date().toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function emptyLine() {
  return {
    medicine: '',
    medicine_name: '',
    product_gst_percent: '',
    batch_no: '',
    expiry_date: '',
    quantity: '',
    pack_type: 'strip',
    conversion: '10',
    rate_type: 'STRIP',
    purchase_rate: '',
    mrp: '',
    discount: '0',
    gst_type: 'exclusive',
    gst_percent: '',
    no_gst: false,
  }
}

function defaultStripConv(med) {
  if (!med || typeof med !== 'object') return null
  const uc = med.unit_conversions || {}
  const tryNum = (k) => {
    const v = Number(uc[k])
    return v > 0 ? String(v) : null
  }
  return tryNum('strip') ?? tryNum('STRIP') ?? tryNum('box') ?? tryNum('BOX')
}

function rateTypeLabelsForPack(packType) {
  const p = (packType || '').toLowerCase()
  if (p === 'box') {
    return { packRate: 'Box rate', unitRate: 'Unit rate' }
  }
  return { packRate: 'Strip rate', unitRate: 'Tablet rate' }
}

function isLineEmpty(ln) {
  if (!ln) return true
  return (
    !ln.medicine &&
    !(ln.batch_no || '').trim() &&
    !(ln.expiry_date || '').trim() &&
    !(ln.quantity || '').toString().trim() &&
    !(ln.purchase_rate || '').toString().trim()
  )
}

function isLineComplete(ln) {
  if (!ln) return false
  const q = Number(ln.quantity)
  const c = Number(ln.conversion)
  const rate = Number(ln.purchase_rate)
  return !!(
    ln.medicine &&
    (ln.batch_no || '').trim() &&
    (ln.expiry_date || '').trim() &&
    q > 0 &&
    c > 0 &&
    rate > 0
  )
}

function ensureMinRows(lines) {
  const out = [...lines]
  while (out.length < MIN_ROWS) out.push(emptyLine())
  return out
}

function maybeGrow(lines) {
  if (!lines.length) return ensureMinRows([])
  const out = [...lines]
  const last = out[out.length - 1]
  if (isLineComplete(last)) out.push(emptyLine())
  return out
}

function PurchaseChallanPanelInner({ onPosted, outletSettings }) {
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayISODate)
  const [paymentType, setPaymentType] = useState('cash')
  const [challanGstEnabled, setChallanGstEnabled] = useState(true)
  const [lines, setLines] = useState(() => ensureMinRows([]))
  const [submitting, setSubmitting] = useState(false)

  const setSupplier = useCallback((id, name) => {
    setSupplierId(id || '')
    setSupplierName(name || '')
  }, [])

  const previews = useMemo(() => {
    const defGst = parseOutletDefaultGstPercent(outletSettings?.default_gst_percent)
    return lines.map((ln) =>
      computeMargPurchaseLineAmounts({
        qty: ln.quantity,
        conversion: ln.conversion,
        rateType: ln.rate_type,
        purchaseRate: ln.purchase_rate,
        discount: ln.discount,
        gstType: ln.gst_type,
        rowGstPercent: ln.gst_percent,
        productGstPercent: ln.product_gst_percent,
        defaultGstPercent: defGst,
        noGst: ln.no_gst,
        challanGstEnabled,
      }),
    )
  }, [lines, outletSettings, challanGstEnabled])

  const colSum = useMemo(() => {
    return previews.reduce(
      (acc, pv, i) => {
        if (isLineEmpty(lines[i])) return acc
        acc.taxable += Number(pv.taxableAmount) || 0
        acc.gst += Number(pv.gstAmount) || 0
        acc.final += Number(pv.finalAmount) || 0
        return acc
      },
      { taxable: 0, gst: 0, final: 0 },
    )
  }, [previews, lines])

  const updateLine = useCallback((i, patch) => {
    setLines((prev) => {
      const n = [...prev]
      n[i] = { ...n[i], ...patch }
      let next = ensureMinRows(n)
      next = maybeGrow(next)
      return next
    })
  }, [])

  const removeLine = useCallback((i) => {
    setLines((prev) => ensureMinRows(prev.filter((_, j) => j !== i)))
  }, [])

  const addRow = useCallback(() => {
    setLines((prev) => [...ensureMinRows(prev), emptyLine()])
  }, [])

  async function submit() {
    if (!supplierId) {
      toast.error('Select party')
      return
    }
    if (!(invoiceNo || '').trim()) {
      toast.error('Invoice number is required')
      return
    }
    if (!(purchaseDate || '').trim()) {
      toast.error('Purchase date is required')
      return
    }

    const payloadLines = []
    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx]
      if (isLineEmpty(ln)) continue
      if (!ln.medicine) {
        toast.error('Each line needs a medicine')
        return
      }
      if (!(ln.batch_no || '').trim()) {
        toast.error('Batch is required on each line')
        return
      }
      if (!(ln.expiry_date || '').trim()) {
        toast.error('Expiry is required on each line')
        return
      }
      const q = Number(ln.quantity)
      const conv = Number(ln.conversion)
      const rate = Number(ln.purchase_rate)
      if (!(q > 0)) {
        toast.error('Quantity must be greater than zero')
        return
      }
      if (!(conv > 0)) {
        toast.error('Conversion must be greater than zero')
        return
      }
      if (!(rate > 0)) {
        toast.error('Purchase rate must be greater than zero')
        return
      }
      const rt = (ln.rate_type || 'STRIP').toUpperCase()
      const row = {
        medicine: ln.medicine,
        batch_no: (ln.batch_no || '').trim(),
        expiry_date: ln.expiry_date,
        quantity: String(q),
        quantity_basis: 'pack',
        pack_type: ln.pack_type || 'strip',
        conversion: String(conv),
        rate_type: rt === 'TABLET' ? 'TABLET' : 'STRIP',
        purchase_rate: String(rate),
        mrp: String(Number(ln.mrp) || 0),
        gst_type: ln.gst_type,
        discount: String(Number(ln.discount) || 0),
        skip_gst: !!ln.no_gst,
        no_gst: !!ln.no_gst,
      }
      if ((ln.gst_percent ?? '').toString().trim() !== '') {
        row.gst_percent = String(Number(ln.gst_percent))
      }
      payloadLines.push(row)
    }

    if (!payloadLines.length) {
      toast.error('Add at least one complete line')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/pharmacy/purchase-challan/', {
        supplier_id: supplierId,
        invoice_no: (invoiceNo || '').trim(),
        purchase_date: purchaseDate,
        payment_type: paymentType,
        gst_enabled: challanGstEnabled,
        lines: payloadLines,
      })
      toast.success('Purchase posted — stock updated')
      setInvoiceNo('')
      setLines(ensureMinRows([]))
      onPosted?.()
    } catch (e) {
      toast.error(parseApiError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const th = 'px-1 py-1 font-semibold text-slate-700 whitespace-nowrap text-xs'
  const td = 'px-1 py-0.5 align-top border-t border-slate-100'
  const inp = 'w-full min-w-0 border border-slate-200 rounded px-1 py-0.5 text-[11px] leading-tight'
  const num = 'text-right font-mono tabular-nums text-[11px]'
  const calcCell = `${num} bg-amber-50/90`

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden p-3 text-slate-800 text-[14px] bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 rounded-xl">
      <div className="shrink-0 flex flex-wrap items-end gap-x-2 gap-y-1 bg-white/95 border border-slate-200/80 rounded-xl px-3 py-2 shadow-sm">
        <div className="flex flex-col min-w-[10rem] flex-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Party *</span>
          <PurchaseSupplierPicker supplierId={supplierId} supplierName={supplierName} onChange={setSupplier} required />
        </div>
        <label className="flex flex-col w-[7.5rem]">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Invoice *</span>
          <input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            className={inp}
            placeholder="Inv no."
          />
        </label>
        <label className="flex flex-col w-[8.5rem]">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Date *</span>
          <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inp} />
        </label>
        <label className="flex flex-col w-[6.5rem]">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Pay *</span>
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={inp}>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Tax</span>
          <div className="flex rounded border border-slate-200 overflow-hidden text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setChallanGstEnabled(true)}
              className={`px-1.5 py-0.5 ${challanGstEnabled ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
            >
              GST
            </button>
            <button
              type="button"
              onClick={() => setChallanGstEnabled(false)}
              className={`px-1.5 py-0.5 border-l border-slate-200 ${!challanGstEnabled ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
            >
              No GST
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 border border-slate-200/90 rounded-xl bg-white overflow-hidden flex flex-col shadow-sm">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <table className="w-full border-collapse table-fixed text-[11px]">
            <thead className="bg-gradient-to-b from-slate-100 to-slate-50 sticky top-0 z-10">
              <tr className="text-left">
                <th className={`${th} w-[16%]`}>Medicine</th>
                <th className={`${th} w-[6%]`}>Batch</th>
                <th className={`${th} w-[7%]`}>Expiry</th>
                <th className={`${th} w-[4%]`}>Qty</th>
                <th className={`${th} w-[5%]`}>Pack</th>
                <th className={`${th} w-[4%]`}>Conv</th>
                <th className={`${th} w-[5%]`}>Tot.qty</th>
                <th className={`${th} w-[6%]`}>Rate type</th>
                <th className={`${th} w-[6%]`}>P.Rate</th>
                <th className={`${th} w-[6%]`}>MRP</th>
                <th className={`${th} w-[5%]`}>Disc</th>
                {challanGstEnabled ? <th className={`${th} w-[8%]`}>GST</th> : null}
                <th className={`${th} w-[6%]`}>Taxable</th>
                {challanGstEnabled ? <th className={`${th} w-[6%]`}>GST ₹</th> : null}
                <th className={`${th} w-[6%]`}>Final</th>
                <th className="w-5 p-0" />
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, i) => {
                const pv = previews[i] || {}
                const tq = pv.totalQty
                return (
                  <tr key={i} className={i % 2 ? 'bg-slate-50/40' : 'hover:bg-emerald-50/30 transition-colors'}>
                    <td className={td}>
                      <PurchaseMedicinePicker
                        medicineId={ln.medicine}
                        medicineName={ln.medicine_name}
                        onChange={(id, name, med) => {
                          const patch = { medicine: id, medicine_name: name || '' }
                          const dc = defaultStripConv(med)
                          if (dc) patch.conversion = dc
                          if (med && med.gst_percent != null && med.gst_percent !== '')
                            patch.product_gst_percent = String(med.gst_percent)
                          else patch.product_gst_percent = ''
                          updateLine(i, patch)
                        }}
                        onRefreshCatalog={onPosted}
                      />
                    </td>
                    <td className={td}>
                      <input
                        value={ln.batch_no}
                        onChange={(e) => updateLine(i, { batch_no: e.target.value })}
                        className={inp}
                      />
                    </td>
                    <td className={td}>
                      <input
                        type="date"
                        value={ln.expiry_date}
                        onChange={(e) => updateLine(i, { expiry_date: e.target.value })}
                        className={inp}
                      />
                    </td>
                    <td className={td}>
                      <input
                        value={ln.quantity}
                        onChange={(e) => updateLine(i, { quantity: e.target.value })}
                        className={`${inp} text-right`}
                        inputMode="decimal"
                      />
                    </td>
                    <td className={td}>
                      <select
                        value={ln.pack_type}
                        onChange={(e) => updateLine(i, { pack_type: e.target.value })}
                        className={inp}
                      >
                        {['strip', 'box'].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={td}>
                      <input
                        value={ln.conversion}
                        onChange={(e) => updateLine(i, { conversion: e.target.value })}
                        className={`${inp} text-right`}
                        inputMode="decimal"
                        title="Tablets per pack (e.g. 10)"
                      />
                    </td>
                    <td className={`${td} ${calcCell} bg-amber-50/70`} title="Qty × conversion (tablets)">
                      {tq > 0 ? (Number.isInteger(tq) ? tq : tq.toFixed(3)) : ''}
                    </td>
                    <td className={td}>
                      {(() => {
                        const labels = rateTypeLabelsForPack(ln.pack_type)
                        return (
                      <select
                        value={ln.rate_type}
                        onChange={(e) => updateLine(i, { rate_type: e.target.value })}
                        className={inp}
                      >
                        <option value="STRIP">{labels.packRate}</option>
                        <option value="TABLET">{labels.unitRate}</option>
                      </select>
                        )
                      })()}
                    </td>
                    <td className={td}>
                      <input
                        value={ln.purchase_rate}
                        onChange={(e) => updateLine(i, { purchase_rate: e.target.value })}
                        className={`${inp} text-right`}
                        inputMode="decimal"
                      />
                    </td>
                    <td className={td}>
                      <input
                        value={ln.mrp}
                        onChange={(e) => updateLine(i, { mrp: e.target.value })}
                        className={`${inp} text-right`}
                        inputMode="decimal"
                        title="MRP per unit"
                      />
                    </td>
                    <td className={td}>
                      <input
                        value={ln.discount}
                        onChange={(e) => updateLine(i, { discount: e.target.value })}
                        className={`${inp} text-right`}
                        inputMode="decimal"
                      />
                    </td>
                    {challanGstEnabled ? (
                      <td className={td}>
                        <select
                          value={ln.gst_type}
                          onChange={(e) => updateLine(i, { gst_type: e.target.value })}
                          className={`${inp} mb-0.5`}
                          disabled={ln.no_gst}
                        >
                          <option value="exclusive">Ex</option>
                          <option value="inclusive">Inc</option>
                        </select>
                        <input
                          value={ln.gst_percent}
                          onChange={(e) => updateLine(i, { gst_percent: e.target.value })}
                          className={`${inp} text-right`}
                          placeholder="%"
                          disabled={ln.no_gst}
                          title="Blank = product / outlet default"
                        />
                        <label className="flex items-center gap-0.5 mt-0.5 text-[10px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={ln.no_gst}
                            onChange={(e) => updateLine(i, { no_gst: e.target.checked })}
                          />
                          No GST
                        </label>
                      </td>
                    ) : null}
                    <td className={`${td} ${calcCell} bg-amber-50/70`}>{pv.taxableAmount > 0 ? pv.taxableAmount.toFixed(2) : ''}</td>
                    {challanGstEnabled ? (
                      <td className={`${td} ${calcCell} bg-amber-50/70`}>
                        {pv.gstAmount > 0 ? (
                          <>
                            <div>{pv.gstAmount.toFixed(2)}</div>
                            <div className="text-[9px] text-slate-500 leading-tight">
                              C {Number(pv.cgst || 0).toFixed(2)} · S {Number(pv.sgst || 0).toFixed(2)}
                            </div>
                          </>
                        ) : pv.gstAmount === 0 && pv.taxableAmount > 0 ? (
                          '0.00'
                        ) : (
                          ''
                        )}
                      </td>
                    ) : null}
                    <td className={`${td} ${calcCell} bg-amber-50/70 font-semibold`}>
                      {pv.finalAmount > 0 ? pv.finalAmount.toFixed(2) : ''}
                    </td>
                    <td className={`${td} p-0`}>
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="text-slate-300 hover:text-rose-500 p-0.5"
                        title="Remove row"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gradient-to-r from-slate-50 to-emerald-50/40 font-semibold text-slate-700">
                <td colSpan={challanGstEnabled ? 12 : 11} className={`${td} text-right text-[11px] pr-1`}>
                  Totals
                </td>
                <td className={`${td} ${calcCell}`}>{colSum.taxable > 0 ? colSum.taxable.toFixed(2) : ''}</td>
                {challanGstEnabled ? (
                  <td className={`${td} ${calcCell}`}>
                    {colSum.gst > 0 ? colSum.gst.toFixed(2) : colSum.taxable > 0 ? colSum.gst.toFixed(2) : ''}
                  </td>
                ) : null}
                <td className={`${td} ${calcCell}`}>{colSum.final > 0 ? colSum.final.toFixed(2) : ''}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex gap-2 shrink-0 items-center">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-0.5 border border-slate-200 bg-white px-2 py-1 rounded-lg text-[11px] font-medium hover:bg-slate-50 transition-colors"
        >
          <Plus size={12} /> Row
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-md shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post purchase'}
        </button>
      </div>
    </div>
  )
}

export default memo(PurchaseChallanPanelInner)
