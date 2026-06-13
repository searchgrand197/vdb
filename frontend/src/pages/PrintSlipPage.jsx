import React, { useEffect, useState } from 'react'
import { printOpdSheet } from '../utils/printOpdSheet'

/**
 * Handles two print entry points:
 *
 * 1. OPD Generator tab  → sets localStorage['opd-print-job'] then opens /print-slip
 * 2. Token Queue A4 btn → navigates to /print-slip?field1=val1&field2=val2
 *    (the layout is fetched from /api/templates and values come from URL params)
 */
export default function PrintSlipPage() {
  const [status, setStatus] = useState('Preparing print…')

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const raw = localStorage.getItem('opd-print-job')
        if (raw) {
          const job = JSON.parse(raw)
          if (job?.layout?.fields) {
            if (!cancelled) {
              await printOpdSheet({
                values: job.values || {},
                withBackground: !!job.withBackground,
                layout: job.layout,
                opdFieldConfig: job.opdFieldConfig,
              })
              setStatus('Printing…')
              setTimeout(() => {
                try { localStorage.removeItem('opd-print-job') } catch { /* ignore */ }
              }, 15000)
            }
            return
          }
        }
      } catch { /* fall through to URL params path */ }

      const params = new URLSearchParams(window.location.search)
      const values = {}
      const withBackground = params.get('_bg') !== '0'
      for (const [k, v] of params.entries()) {
        if (k !== '_bg') values[k] = v
      }

      try {
        if (!cancelled) {
          await printOpdSheet({ values, withBackground })
          setStatus('Printing…')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(err?.message || 'Error: Could not load OPD template layout. Please save the layout in the OPD editor first.')
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#374151' }}>
      {status}
    </div>
  )
}
