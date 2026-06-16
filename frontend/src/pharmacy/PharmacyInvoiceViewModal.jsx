import React, { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { formatWithPattern } from '../utils/dateTimeFormat'

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'cancelled') return 'bg-red-100 text-red-700 border-red-200'
  if (s === 'finalized') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (s === 'draft') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function qtyLabel(item) {
  const qty = Number(item.qty || 0)
  const free = Number(item.free_qty || 0)
  if (free > 0) return `${qty} + ${free} free`
  return String(qty)
}

export default function PharmacyInvoiceViewModal({ invoiceId, onClose }) {
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false
    setLoading(true)
    api.get(`/pharmacy/invoices/${invoiceId}/`)
      .then(({ data }) => {
        if (cancelled) return
        setInvoice(data?.data || data || null)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load receipt details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [invoiceId])

  if (!invoiceId) return null

  const isB2B = Boolean(invoice?.party || invoice?.party_details)
  const party = invoice?.party_details || (typeof invoice?.party === 'object' ? invoice.party : null)
  const patient = invoice?.patient_details || (typeof invoice?.patient === 'object' ? invoice.patient : null)
  const doctor = invoice?.doctor_details
  const items = Array.isArray(invoice?.items) ? invoice.items : []
  const isCancelled = String(invoice?.status || '').toLowerCase() === 'cancelled'
  const totalAmt = Number(invoice?.grand_total || 0)
  const paidAmt = Number(invoice?.paid_amount || 0)
  const dueAmt = Math.max(0, Number(invoice?.due_amount ?? totalAmt - paidAmt))

  const customerName = isB2B
    ? (party?.name || invoice?.party_name || invoice?.party_name_snapshot || '—')
    : `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || '—'

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900">Pharmacy Receipt</h3>
            {invoice?.invoice_no && (
              <p className="text-[11px] text-slate-500 font-mono">#{invoice.invoice_no}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[12px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 size={28} className="animate-spin mb-2" />
              <p>Loading receipt…</p>
            </div>
          ) : !invoice ? (
            <p className="text-center text-slate-500 py-12">Receipt not found.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${statusBadge(invoice.status)}`}>
                  {invoice.status || '—'}
                </span>
                {isCancelled && (
                  <span className="text-[10px] font-bold text-red-700">Cancelled (view only)</span>
                )}
                {invoice.created_at && (
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {formatWithPattern(invoice.created_at, 'dd MMM yyyy, HH:mm')}
                  </span>
                )}
              </div>

              {isCancelled && invoice.cancel_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[10px] font-bold text-red-800 uppercase tracking-wide">Cancellation reason</p>
                  <p className="text-[12px] text-red-900 mt-0.5 whitespace-pre-wrap">{invoice.cancel_reason}</p>
                  {(invoice.cancelled_by_name || invoice.cancelled_at) && (
                    <p className="text-[10px] text-red-700 mt-1">
                      {invoice.cancelled_by_name ? `By ${invoice.cancelled_by_name}` : ''}
                      {invoice.cancelled_by_name && invoice.cancelled_at ? ' · ' : ''}
                      {invoice.cancelled_at ? formatWithPattern(invoice.cancelled_at, 'dd MMM yyyy, HH:mm') : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Customer</p>
                  <p className="font-semibold text-slate-900 mt-1">{customerName}</p>
                  {isB2B ? (
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                      {party?.phone && <p>Phone: {party.phone}</p>}
                      {party?.gst_number && <p>GSTIN: {party.gst_number}</p>}
                      {party?.dl_number && <p>DL: {party.dl_number}</p>}
                      {party?.address && <p className="whitespace-pre-wrap">{party.address}</p>}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                      {patient?.uhid && <p>UHID: {patient.uhid}</p>}
                      {patient?.phone && <p>Phone: {patient.phone}</p>}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Payment</p>
                  <div className="mt-1 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Method</span>
                      <span className="font-semibold uppercase">{invoice.payment_method || 'cash'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Paid</span>
                      <span className="font-semibold text-emerald-700">{money(paidAmt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Due</span>
                      <span className="font-semibold text-amber-700">{money(dueAmt)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1">
                      <span className="font-bold text-slate-800">Grand total</span>
                      <span className="font-bold">{money(totalAmt)}</span>
                    </div>
                    {invoice.gst_enabled && (
                      <>
                        <div className="flex justify-between text-slate-500">
                          <span>CGST</span>
                          <span>{money(invoice.cgst)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>SGST</span>
                          <span>{money(invoice.sgst)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {(doctor?.user?.first_name || invoice.billing_doctor_name || invoice.billing_hospital_name || invoice.ipd_admission) && (
                <div className="rounded-lg border border-slate-200 p-3 text-[11px] text-slate-600 space-y-0.5">
                  {doctor && (
                    <p>
                      Referred doctor:{' '}
                      <span className="font-medium text-slate-800">
                        {`${doctor.user?.first_name || ''} ${doctor.user?.last_name || ''}`.trim() || '—'}
                      </span>
                    </p>
                  )}
                  {invoice.billing_doctor_name && (
                    <p>Billing doctor: <span className="font-medium text-slate-800">{invoice.billing_doctor_name}</span></p>
                  )}
                  {invoice.billing_hospital_name && (
                    <p>Billing hospital: <span className="font-medium text-slate-800">{invoice.billing_hospital_name}</span></p>
                  )}
                  {invoice.ipd_admission && (
                    <p>IPD admission linked</p>
                  )}
                </div>
              )}

              {invoice.remarks && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Remarks</p>
                  <p className="text-[11px] text-slate-700 mt-1 whitespace-pre-wrap">{invoice.remarks}</p>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold">
                    <tr>
                      <th className="px-3 py-2">Medicine</th>
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">MRP</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No line items</td></tr>
                    ) : items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {it.medicine_name || it.medicine?.name || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {it.batch_no || it.snapshot_batch_no || '—'}
                          {it.expiry_date && (
                            <span className="block text-[10px] text-slate-400">
                              Exp: {formatWithPattern(it.expiry_date, 'MM/yy')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{qtyLabel(it)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(it.rate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(it.mrp)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
