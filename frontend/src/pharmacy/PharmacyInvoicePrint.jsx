import React, { useCallback, useRef, useState } from 'react'
import { format } from 'date-fns'

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

function stripSizeFromItem(it) {
  const forced = Number(it?.strip_size_for_print)
  if (Number.isFinite(forced) && forced > 0) return forced
  const fromField = Number(it?.pack_size)
  if (Number.isFinite(fromField) && fromField > 0) return fromField
  const convStrip =
    Number(it?.medicine?.unit_conversions?.strip) ||
    Number(it?.medicine?.unit_conversions?.STRIP) ||
    Number(it?.unit_conversions?.strip) ||
    Number(it?.unit_conversions?.STRIP)
  if (Number.isFinite(convStrip) && convStrip > 0) return convStrip
  const packInfo = String(it?.medicine?.pack_info || it?.pack_info || it?.pack || '')
  const m = packInfo.match(/x\s*(\d+(?:\.\d+)?)/i)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return 1
}

function stripMrpFromItem(it, rateFallback = 0) {
  const forcedStripMrp = Number(it?.mrp_strip_for_print)
  if (Number.isFinite(forcedStripMrp) && forcedStripMrp > 0) return forcedStripMrp
  const unitMrp = Number(it?.mrp ?? it?.batch?.mrp ?? rateFallback)
  const size = stripSizeFromItem(it)
  return unitMrp * size
}

function unitMrpFromItem(it, rateFallback = 0) {
  const u = Number(it?.mrp ?? it?.batch?.mrp ?? rateFallback)
  return Number.isFinite(u) ? u : 0
}

/** % off unit MRP vs selling rate (same basis as billing screen). */
function lineDiscountPercentFromItem(it) {
  const unitMrp = unitMrpFromItem(it, Number(it?.rate ?? 0))
  const rate = Number(it?.rate ?? 0)
  if (!(unitMrp > 0)) return 0
  const raw = ((unitMrp - rate) / unitMrp) * 100
  if (!Number.isFinite(raw)) return 0
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100))
}

/** 3-letter qty suffix from dosage form / unit name (e.g. tab, str). */
function qtySuffixFromItem(it) {
  const form = String(it?.medicine?.form || '').toLowerCase()
  const unit = String(it?.medicine?.unit_name || '').toLowerCase()
  const s = `${form} ${unit}`.trim()
  if (!s) return 'tab'
  if (/\bstrip\b|strip|str\b/.test(s)) return 'str'
  if (/\btab|tablet|tabl/.test(s)) return 'tab'
  if (/\bcap|capsule/.test(s)) return 'cap'
  if (/\bml\b|syrup|susp|liquid|drops?/.test(s)) return 'ml'
  if (/\binj|vial|amp/.test(s)) return 'inj'
  if (/\bpcs|piece|unit\b/.test(s)) return 'pcs'
  const compact = s.replace(/[^a-z]/g, '')
  if (compact.length >= 3) return compact.slice(0, 3)
  return (compact + 'tab').slice(0, 3)
}

function formatQtyCell(it) {
  const q = Number(it?.qty || 0)
  return q % 1 === 0 ? String(q) : q.toFixed(2)
}

function formatInvoiceTotalQty(items) {
  const list = Array.isArray(items) ? items : []
  let sum = 0
  for (const it of list) {
    const q = Number(it?.qty || 0)
    if (Number.isFinite(q)) sum += q
  }
  const sumStr = sum % 1 === 0 ? String(sum) : sum.toFixed(2)
  return sumStr
}

function formatMoney(n) {
  const v = Number(n || 0)
  return `Rs ${v.toFixed(2)}`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function extractNotesAdviceFromRemarks(remarks) {
  const raw = String(remarks || '')
  if (!raw.trim()) return ''
  const lower = raw.toLowerCase()
  const key = 'notes/advice:'
  const idx = lower.indexOf(key)
  if (idx < 0) return ''
  return raw.slice(idx + key.length).trim()
}

/** Patient name from API / billing (PatientSerializer includes middle_name). */
function patientDisplayName(pd) {
  if (!pd || typeof pd !== 'object') return ''
  const parts = [pd.first_name, pd.middle_name, pd.last_name].filter(
    (x) => x != null && String(x).trim() !== '',
  )
  return parts.map((x) => String(x).trim()).join(' ').trim()
}

/** One line: flat address or address_line1 + city + state from PatientSerializer. */
function patientDisplayAddress(pd) {
  if (!pd || typeof pd !== 'object') return '—'
  const flat = String(pd.address ?? '').trim()
  if (flat) return flat
  const line1 = String(pd.address_line1 ?? '').trim()
  const city = String(pd.city ?? '').trim()
  const state = String(pd.state ?? '').trim()
  const tail = [city, state].filter(Boolean).join(', ')
  const joined = [line1, tail].filter(Boolean).join(', ').trim()
  return joined || '—'
}

/** Referred doctor: nested doctor_details.name (API) or legacy string. */
function invoiceDoctorDisplayName(inv) {
  if (!inv || typeof inv !== 'object') return '—'
  const fromNested = inv.doctor_details?.name
  if (fromNested != null && String(fromNested).trim() !== '') return String(fromNested).trim()
  const rb = inv.referred_by
  if (rb != null && typeof rb === 'object' && rb.name != null && String(rb.name).trim() !== '') {
    return String(rb.name).trim()
  }
  if (typeof rb === 'string' && rb.trim() !== '' && !/^[0-9a-f-]{36}$/i.test(rb.trim())) {
    return rb.trim()
  }
  return '—'
}

/** Number of columns before QTY in the invoice grid. */
function qtyColumnColspan(showGst) {
  return showGst ? 11 : 9
}

function invoiceColgroupHtml(showGst) {
  const eq = '7%'
  if (showGst) {
    return `<colgroup>
      <col style="width:4%" />
      <col style="width:17%" />
      <col style="width:6%" /><col style="width:6%" /><col style="width:7%" /><col style="width:6%" />
      <col style="width:${eq}" /><col style="width:${eq}" /><col style="width:${eq}" />
      <col style="width:5%" /><col style="width:5%" />
      <col style="width:${eq}" />
      <col style="width:16%" />
    </colgroup>`
  }
  return `<colgroup>
    <col style="width:4%" />
    <col style="width:22%" />
    <col style="width:7%" /><col style="width:7%" /><col style="width:9%" /><col style="width:7%" />
    <col style="width:${eq}" /><col style="width:${eq}" /><col style="width:${eq}" /><col style="width:${eq}" />
    <col style="width:16%" />
  </colgroup>`
}

function printViaIframe(htmlString) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:none;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(htmlString)
    doc.close()

    const win = iframe.contentWindow
    const cleanup = () => {
      try { document.body.removeChild(iframe) } catch { /* already removed */ }
      resolve()
    }
    win.addEventListener('afterprint', cleanup)

    const tryPrint = () => {
      try { win.focus(); win.print() } catch { /* noop */ }
      setTimeout(() => cleanup(), 8000)
    }

    if (doc.readyState === 'complete') {
      setTimeout(tryPrint, 80)
    } else {
      iframe.onload = () => setTimeout(tryPrint, 80)
    }
  })
}

function buildInvoiceHtml({ invoice, outlet }) {
  const showGst = invoice.gst_enabled !== false
  const subtotal = Number(invoice.subtotal || 0)
  const cgst = Number(invoice.cgst || 0)
  const sgst = Number(invoice.sgst || 0)
  const tax = cgst + sgst
  const grandTotal = Number(invoice.grand_total || 0)
  const grossBeforeBillDiscount = showGst ? subtotal + tax : subtotal
  const totalDiscount = Math.max(0, Math.round((grossBeforeBillDiscount - grandTotal) * 100) / 100)
  const totalDiscountPercent =
    grossBeforeBillDiscount > 0
      ? Math.max(0, Math.round((totalDiscount / grossBeforeBillDiscount) * 100 * 100) / 100)
      : 0
  const paidAmount = Number(invoice.paid_amount || 0)
  const dueAmount = Math.max(0, Number(invoice.due_amount ?? grandTotal - paidAmount))
  const paymentMethod = String(invoice.payment_method || 'cash').toUpperCase()
  const items = invoice.items || []

  const biz = outlet || {}
  const title = (biz.business_name || 'Pharmacy').toUpperCase()
  const addrLines = (biz.address || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const gstColCount = showGst ? 13 : 11

  const gstHeaderCols = showGst
    ? `<th style="border:1px solid #000;padding:4px 2px;text-align:center">SGST%</th>
       <th style="border:1px solid #000;padding:4px 2px;text-align:center">CGST%</th>`
    : ''

  const itemRows = items
    .map((it, idx) => {
      const qty = Number(it.qty || 0)
      const rate = Number(it.rate || 0)
      const mrpStrip = stripMrpFromItem(it, rate)
      const discPct = lineDiscountPercentFromItem(it)
      const amount = qty * rate
      const sgstR = showGst ? Number(it.sgst_rate ?? 0) : 0
      const cgstR = showGst ? Number(it.cgst_rate ?? 0) : 0
      const gstCols = showGst
        ? `<td style="border:1px solid #ccc;padding:3px;text-align:center">${sgstR.toFixed(2)}</td>
           <td style="border:1px solid #ccc;padding:3px;text-align:center">${cgstR.toFixed(2)}</td>`
        : ''
      return `<tr style="border-bottom:1px solid #ddd">
        <td style="border:1px solid #ccc;padding:3px;text-align:center">${idx + 1}</td>
        <td style="border:1px solid #ccc;padding:3px;font-weight:bold;word-break:break-word">${it.medicine?.name || it.medicine_name || '—'}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:center">${it.medicine?.pack_info || it.pack_info || '—'}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:center;font-size:8px">${it.medicine?.hsn_code || it.hsn_code || '—'}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:center;font-size:8px">${it.batch?.batch_no ?? it.batch_no ?? '—'}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:center;font-size:8px">${safeFormat(it.batch?.expiry_date || it.expiry_date, 'MM/yy')}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:right">${formatMoney(mrpStrip)}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:center">${discPct.toFixed(2)}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:right">${formatMoney(rate)}</td>
        ${gstCols}
        <td style="border:1px solid #ccc;padding:3px;text-align:center;font-size:8px">${formatQtyCell(it)}</td>
        <td style="border:1px solid #ccc;padding:3px;text-align:right;font-weight:bold">${formatMoney(amount)}</td>
      </tr>`
    })
    .join('')

  const totalQtyLine = formatInvoiceTotalQty(items)
  const fillerRowCount = Math.max(0, 8 - items.length)
  const emptyRows =
    fillerRowCount > 0
      ? Array.from({ length: fillerRowCount })
          .map(
            () =>
              `<tr style="height:18px">${Array.from({ length: gstColCount })
                .map(() => `<td style="border:1px solid #ccc;padding:3px">&nbsp;</td>`)
                .join('')}</tr>`,
          )
          .join('')
      : ''

  const taxSummaryLine = showGst
    ? `Taxable ${formatMoney(subtotal)} &middot; CGST ${formatMoney(cgst)} &middot; SGST ${formatMoney(sgst)} &middot; GST ${formatMoney(tax)}`
    : `Subtotal ${formatMoney(subtotal)} &middot; Non-GST bill (no tax)`
  const qtyColspan = qtyColumnColspan(showGst)

  const gstTotalRows = showGst
    ? `<div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #ccc">
         <span>CGST</span><span>${formatMoney(cgst)}</span>
       </div>
       <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #ccc">
         <span>SGST</span><span>${formatMoney(sgst)}</span>
       </div>`
    : ''

  const headerGstInfo = showGst
    ? `${biz.gst_number ? `<div>GSTIN : ${biz.gst_number}</div>` : ''}${biz.dl_number ? `<div>D.L.NO. : ${biz.dl_number}</div>` : ''}`
    : `${biz.dl_number ? `<div>D.L.NO. : ${biz.dl_number}</div>` : ''}`

  const pd = invoice.patient_details
  const patientNameHtml = escapeHtml(patientDisplayName(pd) || '—')
  const patientAddrHtml = escapeHtml(patientDisplayAddress(pd))
  const doctorNameHtml = escapeHtml(invoiceDoctorDisplayName(invoice))
  const invoiceDate = safeFormat(invoice.created_at || new Date(), 'dd-MM-yyyy HH:mm')
  const notesAdviceText = extractNotesAdviceFromRemarks(invoice.remarks)
  const notesAdviceHtml = notesAdviceText ? escapeHtml(notesAdviceText).replace(/\n/g, '<br/>') : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${invoice.invoice_no || ''}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
    html, body { width:100%; background:#fff; color:#000; font-family:Arial,sans-serif; font-size:10px; }
    @page { size:A4; margin:8mm; }
    @media print {
      html, body { background:#fff !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
    }
  </style>
</head>
<body>
  <div style="max-width:210mm;margin:0 auto;border:1px solid #000">

    <div style="display:flex;border-bottom:1px solid #000">
      <div style="flex:1;padding:8px 10px;border-right:1px solid #000">
        <div style="font-size:14px;font-weight:bold">${title}</div>
        <div style="font-size:8px;font-style:italic;margin-bottom:4px">${showGst ? 'GST Invoice' : 'Retail invoice'}</div>
        <div style="font-size:8px;line-height:1.5">
          ${addrLines.length > 0 ? addrLines.map((l) => `<div>${l}</div>`).join('') : '<div>&mdash;</div>'}
          ${biz.mobile ? `<div>Phone: ${biz.mobile}</div>` : ''}
          ${biz.email ? `<div>E-Mail: ${biz.email}</div>` : ''}
          ${biz.website ? `<div>Web: ${biz.website}</div>` : ''}
        </div>
        <div style="font-size:8px;margin-top:4px;line-height:1.5">${headerGstInfo}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;border-right:1px solid #000;padding:8px">
        <div style="font-size:16px;font-weight:bold;text-align:center">${showGst ? 'GST INVOICE' : 'INVOICE'}</div>
      </div>
      <div style="flex:1.2;padding:8px 10px;font-size:9px;line-height:1.8">
        <div><strong>Patient Name :</strong> ${patientNameHtml}</div>
        <div><strong>Patient Address :</strong> ${patientAddrHtml}</div>
        <div><strong>UHID No. :</strong> ${escapeHtml(invoice.patient_details?.uhid || '—')}</div>
        <div><strong>Dr. Name :</strong> ${doctorNameHtml}</div>
        <div><strong>Payment :</strong> ${paymentMethod}</div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;border-top:1px solid #000;padding-top:4px">
          <span><strong>Invoice No. : ${invoice.invoice_no || ''}</strong></span>
          <span><strong>Date: ${invoiceDate}</strong></span>
        </div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed">
      ${invoiceColgroupHtml(showGst)}
      <thead>
        <tr style="background:#f0f0f0;border-bottom:1px solid #000;border-top:1px solid #000">
          <th style="border:1px solid #000;padding:4px 2px;text-align:center">SN.</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:left">PRODUCT NAME</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:center">PACK</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:center">HSN</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:center">BATCH</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:center">EXP.</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:right">MRP</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:center">DISC%</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:right">RATE</th>
          ${gstHeaderCols}
          <th style="border:1px solid #000;padding:4px 2px;text-align:center">QTY</th>
          <th style="border:1px solid #000;padding:4px 2px;text-align:right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${emptyRows}
      </tbody>
      <tfoot>
        <tr style="border-top:1px solid #000;border-bottom:1px solid #000;background:#fff">
          <td colspan="${qtyColspan}" style="padding:4px 8px;font-size:8px;border-right:1px solid #000">${taxSummaryLine}</td>
          <td style="padding:3px 2px;text-align:center;font-size:8px;font-weight:700;border-right:1px solid #000;line-height:1.2">
            <div style="font-size:7px;color:#555">Total Qty</div>
            <div>${totalQtyLine}</div>
          </td>
          <td style="padding:3px 2px">&nbsp;</td>
        </tr>
      </tfoot>
    </table>

    <div style="display:flex;border-bottom:1px solid #000">
      <div style="flex:1;padding:8px 10px;border-right:1px solid #000;font-size:8px">
        <div style="font-weight:bold;margin-bottom:4px;text-decoration:underline">Terms &amp; Conditions</div>
        <div>Please consult the Doctor before using medicine.</div>
        <div>Medicine without batch and expiry date will not be taken back.</div>
        <div>All disputes subject to local Jurisdiction only.</div>
        ${
          notesAdviceHtml
            ? `<div style="margin-top:8px"><strong>Notes/Advice :</strong><div style="margin-top:3px;line-height:1.4">${notesAdviceHtml}</div></div>`
            : `<div style="margin-top:8px"><strong>Remark :</strong> ___________________________</div>`
        }
      </div>
      <div style="flex:1;padding:8px;text-align:center;border-right:1px solid #000;display:flex;flex-direction:column;justify-content:space-between">
        <div style="font-size:8px;margin-bottom:4px">For ${title}</div>
        <div>
          <div style="font-style:italic;font-weight:bold;font-size:12px;margin-bottom:8px">PHARMACIST</div>
          <div style="font-style:italic;font-size:10px">${biz.business_name || 'Pharmacy'}</div>
        </div>
        <div style="border-top:1px solid #000;padding-top:4px;font-size:8px">Authorised Signatory</div>
      </div>
      <div style="width:160px;font-size:9px">
        <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #ccc">
          <span>SUB TOTAL</span><span style="font-weight:bold">${formatMoney(subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #ccc">
          <span>TOTAL DIS (${totalDiscountPercent.toFixed(2)}%)</span><span>${formatMoney(totalDiscount)}</span>
        </div>
        ${gstTotalRows}
        <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #ccc">
          <span>PAID</span><span>${formatMoney(paidAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #ccc">
          <span>DUE</span><span>${formatMoney(dueAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#000;color:#fff;font-weight:bold;font-size:10px">
          <span>GRAND TOTAL</span><span>${formatMoney(grandTotal)}</span>
        </div>
        <div style="padding:4px 8px;font-size:8px;text-align:center;font-style:italic">Computer Generated Invoice</div>
      </div>
    </div>

  </div>
</body>
</html>`
}

export default function PharmacyInvoicePrint({ invoice, outlet, onClose }) {
  const [printing, setPrinting] = useState(false)
  const hasAutoPrinted = useRef(false)

  const doPrint = useCallback(async () => {
    if (!invoice || printing) return
    setPrinting(true)
    try {
      const html = buildInvoiceHtml({ invoice, outlet })
      await printViaIframe(html)
    } catch {
      // noop
    } finally {
      setPrinting(false)
    }
  }, [invoice, outlet, printing])

  React.useEffect(() => {
    if (!invoice || hasAutoPrinted.current) return
    hasAutoPrinted.current = true
    const t = setTimeout(() => doPrint(), 300)
    return () => clearTimeout(t)
  }, [invoice, doPrint])

  if (!invoice) return null

  const showGst = invoice.gst_enabled !== false
  const subtotal = Number(invoice.subtotal || 0)
  const cgst = Number(invoice.cgst || 0)
  const sgst = Number(invoice.sgst || 0)
  const tax = cgst + sgst
  const grandTotal = Number(invoice.grand_total || 0)
  const grossBeforeBillDiscount = showGst ? subtotal + tax : subtotal
  const totalDiscount = Math.max(0, Math.round((grossBeforeBillDiscount - grandTotal) * 100) / 100)
  const totalDiscountPercent =
    grossBeforeBillDiscount > 0
      ? Math.max(0, Math.round((totalDiscount / grossBeforeBillDiscount) * 100 * 100) / 100)
      : 0
  const paidAmount = Number(invoice.paid_amount || 0)
  const dueAmount = Math.max(0, Number(invoice.due_amount ?? grandTotal - paidAmount))
  const paymentMethod = String(invoice.payment_method || 'cash').toUpperCase()
  const items = invoice.items || []
  const pd = invoice.patient_details
  const patientNameLabel = patientDisplayName(pd) || '—'
  const patientAddrLabel = patientDisplayAddress(pd)
  const doctorLabel = invoiceDoctorDisplayName(invoice)
  const notesAdvice = extractNotesAdviceFromRemarks(invoice.remarks)

  const biz = outlet || {}
  const title = (biz.business_name || 'Pharmacy').toUpperCase()
  const addrLines = (biz.address || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const tableCols = showGst ? 13 : 11
  const totalQtyLine = formatInvoiceTotalQty(items)
  const fillerRowCount = Math.max(0, 8 - items.length)
  const taxSummaryLine = showGst
    ? `Taxable ${formatMoney(subtotal)} · CGST ${formatMoney(cgst)} · SGST ${formatMoney(sgst)} · GST ${formatMoney(tax)}`
    : `Subtotal ${formatMoney(subtotal)} · Non-GST bill (no tax)`
  const qtyColspan = qtyColumnColspan(showGst)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'white',
        zIndex: 9999,
        overflowY: 'auto',
        padding: '20px',
      }}
    >
      <div style={{ maxWidth: '210mm', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#000', border: '1px solid #000' }}>

        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <div style={{ flex: 1, padding: '8px 10px', borderRight: '1px solid #000' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{title}</div>
            <div style={{ fontSize: '8px', fontStyle: 'italic', marginBottom: '4px' }}>
              {showGst ? 'GST Invoice' : 'Retail invoice'}
            </div>
            <div style={{ fontSize: '8px', lineHeight: '1.5' }}>
              {addrLines.length > 0 ? addrLines.map((line, i) => <div key={i}>{line}</div>) : <div>—</div>}
              {biz.mobile ? <div>Phone: {biz.mobile}</div> : null}
              {biz.email ? <div>E-Mail: {biz.email}</div> : null}
              {biz.website ? <div>Web: {biz.website}</div> : null}
            </div>
            {showGst ? (
              <div style={{ fontSize: '8px', marginTop: '4px', lineHeight: '1.5' }}>
                {biz.gst_number ? <div>GSTIN : {biz.gst_number}</div> : null}
                {biz.dl_number ? <div>D.L.NO. : {biz.dl_number}</div> : null}
              </div>
            ) : (
              <div style={{ fontSize: '8px', marginTop: '4px', lineHeight: '1.5' }}>
                {biz.dl_number ? <div>D.L.NO. : {biz.dl_number}</div> : null}
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000', padding: '8px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>
              {showGst ? 'GST INVOICE' : 'INVOICE'}
            </div>
          </div>

          <div style={{ flex: 1.2, padding: '8px 10px', fontSize: '9px', lineHeight: '1.8' }}>
            <div><strong>Patient Name :</strong> {patientNameLabel}</div>
            <div><strong>Patient Address :</strong> {patientAddrLabel}</div>
            <div><strong>UHID No. :</strong> {invoice.patient_details?.uhid || '—'}</div>
            <div><strong>Dr. Name :</strong> {doctorLabel}</div>
            <div><strong>Payment :</strong> {paymentMethod}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px' }}>
              <span><strong>Invoice No. : {invoice.invoice_no}</strong></span>
              <span><strong>Date: {safeFormat(invoice.created_at || new Date(), 'dd-MM-yyyy HH:mm')}</strong></span>
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', tableLayout: 'fixed' }}>
          {showGst ? (
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
          ) : (
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
          )}
          <thead>
            <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>SN.</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'left' }}>PRODUCT NAME</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>PACK</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>HSN</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>BATCH</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>EXP.</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'right' }}>MRP</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>DISC%</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'right' }}>RATE</th>
              {showGst ? (
                <>
                  <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>SGST%</th>
                  <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>CGST%</th>
                </>
              ) : null}
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>QTY</th>
              <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'right' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const qty = Number(it.qty || 0)
              const rate = Number(it.rate || 0)
              const mrpStrip = stripMrpFromItem(it, rate)
              const discPct = lineDiscountPercentFromItem(it)
              const amount = qty * rate
              const sgstR = showGst ? Number(it.sgst_rate ?? 0) : 0
              const cgstR = showGst ? Number(it.cgst_rate ?? 0) : 0
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', fontWeight: 'bold', wordBreak: 'break-word' }}>
                    {it.medicine?.name || it.medicine_name || '—'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center' }}>
                    {it.medicine?.pack_info || it.pack_info || '—'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center', fontSize: '8px' }}>
                    {it.medicine?.hsn_code || it.hsn_code || '—'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center', fontSize: '8px' }}>
                    {it.batch?.batch_no ?? it.batch_no ?? '—'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center', fontSize: '8px' }}>
                    {safeFormat(it.batch?.expiry_date || it.expiry_date, 'MM/yy')}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'right' }}>{formatMoney(mrpStrip)}</td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center' }}>{discPct.toFixed(2)}</td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'right' }}>{formatMoney(rate)}</td>
                  {showGst ? (
                    <>
                      <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center' }}>{sgstR.toFixed(2)}</td>
                      <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center' }}>{cgstR.toFixed(2)}</td>
                    </>
                  ) : null}
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'center', fontSize: '8px' }}>{formatQtyCell(it)}</td>
                  <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(amount)}</td>
                </tr>
              )
            })}
            {fillerRowCount > 0 &&
              Array.from({ length: fillerRowCount }).map((_, i) => (
                <tr key={`empty-${i}`} style={{ height: '18px' }}>
                  {Array.from({ length: tableCols }).map((_, j) => (
                    <td key={j} style={{ border: '1px solid #ccc', padding: '3px' }}>&nbsp;</td>
                  ))}
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', background: '#fff' }}>
              <td colSpan={qtyColspan} style={{ padding: '4px 8px', fontSize: '8px', borderRight: '1px solid #000' }}>
                {taxSummaryLine}
              </td>
              <td
                style={{
                  padding: '3px 2px',
                  textAlign: 'center',
                  fontSize: '8px',
                  fontWeight: 700,
                  borderRight: '1px solid #000',
                  lineHeight: 1.2,
                }}
              >
                <div style={{ fontSize: '7px', color: '#555' }}>Total Qty</div>
                <div>{totalQtyLine}</div>
              </td>
              <td style={{ padding: '3px 2px' }}>&nbsp;</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <div style={{ flex: 1, padding: '8px 10px', borderRight: '1px solid #000', fontSize: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', textDecoration: 'underline' }}>Terms & Conditions</div>
            <div>Please consult the Doctor before using medicine.</div>
            <div>Medicine without batch and expiry date will not be taken back.</div>
            <div>All disputes subject to local Jurisdiction only.</div>
            <div style={{ marginTop: '8px' }}>
              {notesAdvice ? (
                <>
                  <strong>Notes/Advice :</strong>
                  <div style={{ marginTop: '3px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{notesAdvice}</div>
                </>
              ) : (
                <><strong>Remark :</strong> ___________________________</>
              )}
            </div>
          </div>

          <div style={{ flex: 1, padding: '8px', textAlign: 'center', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '8px', marginBottom: '4px' }}>For {title}</div>
            <div>
              <div style={{ fontStyle: 'italic', fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>PHARMACIST</div>
              <div style={{ fontStyle: 'italic', fontSize: '10px' }}>{biz.business_name || 'Pharmacy'}</div>
            </div>
            <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '8px' }}>Authorised Signatory</div>
          </div>

          <div style={{ width: '160px', fontSize: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
              <span>SUB TOTAL</span><span style={{ fontWeight: 'bold' }}>{formatMoney(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
              <span>TOTAL DIS ({totalDiscountPercent.toFixed(2)}%)</span><span>{formatMoney(totalDiscount)}</span>
            </div>
            {showGst ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
                  <span>CGST</span><span>{formatMoney(cgst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
                  <span>SGST</span><span>{formatMoney(sgst)}</span>
                </div>
              </>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
              <span>PAID</span><span>{formatMoney(paidAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
              <span>DUE</span><span>{formatMoney(dueAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#000', color: '#fff', fontWeight: 'bold', fontSize: '10px' }}>
              <span>GRAND TOTAL</span><span>{formatMoney(grandTotal)}</span>
            </div>
            <div style={{ padding: '4px 8px', fontSize: '8px', textAlign: 'center', fontStyle: 'italic' }}>
              Computer Generated Invoice
            </div>
          </div>
        </div>

      </div>

      <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
        <button
          type="button"
          onClick={doPrint}
          disabled={printing}
          style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 28px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
        >
          {printing ? 'Printing…' : '🖨 Print Invoice'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          ✕ Close Preview
        </button>
      </div>
    </div>
  )
}
