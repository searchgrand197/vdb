import React, { useEffect, useState } from 'react'
import { buildPrintHtml } from '../components/OpdTemplateEditor/buildPrintHtml'

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
      // ── Path 1: OPD Generator left a print job in localStorage ────────────
      try {
        const raw = localStorage.getItem('opd-print-job')
        if (raw) {
          const job = JSON.parse(raw)
          if (job?.layout?.fields) {
            const html = buildPrintHtml(job.layout, job.values || {}, !!job.withBackground)
            if (!cancelled) {
              renderAndPrint(html)
              setTimeout(() => {
                try { localStorage.removeItem('opd-print-job') } catch { /* ignore */ }
              }, 15000)
            }
            return
          }
        }
      } catch { /* fall through to URL params path */ }

      // ── Path 2: Token Queue navigated here with URL query params ───────────
      const params = new URLSearchParams(window.location.search)
      const values = {}
      // Read the _bg control param (1 = with background, 0 = plain paper), default true
      const withBackground = params.get('_bg') !== '0'
      for (const [k, v] of params.entries()) {
        if (k !== '_bg') values[k] = v
      }

      // Fetch the saved layout from the backend
      let layout = null
      try {
        const res = await fetch('/api/templates')
        if (res.ok) {
          const data = await res.json()
          const single = (data.templates || []).find(t => t.key === 'single')
          if (single?.layout) layout = single.layout
        }
      } catch { /* ignore */ }

      // Fallback: try localStorage copy of the layout
      if (!layout) {
        try {
          const raw = localStorage.getItem('custom-editor-single-layout')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.fields) layout = parsed
          }
        } catch { /* ignore */ }
      }

      if (!layout) {
        if (!cancelled) setStatus('Error: Could not load OPD template layout. Please save the layout in the OPD editor first.')
        return
      }

      if (!cancelled) {
        const html = buildPrintHtml(layout, values, withBackground)
        renderAndPrint(html)
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

/**
 * Replaces this tab's document with the generated OPD HTML and auto-prints.
 * The tab closes itself after the print dialog is dismissed (printed or cancelled),
 * returning the user to the token queue tab.
 */
function renderAndPrint(html) {
  // Inject a close-after-print script into the HTML before writing it
  const closeScript = `
    <script>
      (function () {
        let finalized = false;
        function finalize() {
          if (finalized) return;
          finalized = true;
          try { window.location.replace('about:blank'); } catch (e) {}
          setTimeout(function () {
            try { window.close(); } catch (e) {}
          }, 50);
        }
        window.addEventListener('afterprint', finalize, { once: true });
        window.addEventListener('focus', function () { setTimeout(finalize, 200); }, { once: true });
        setTimeout(finalize, 120000);
      })();
    </script>
  `
  // Insert the close script just before </body>
  const finalHtml = html.includes('</body>')
    ? html.replace('</body>', closeScript + '</body>')
    : html + closeScript

  document.open('text/html')
  document.write(finalHtml)
  document.close()
}
