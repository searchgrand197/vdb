// Builds a standalone OPD print HTML page from the current layout + values.
// Kept as a plain JS file (not JSX) to avoid Vite parse issues with
// raw HTML string literals that contain <script> and </script> tags.

const CANVAS_W = 1024
const CANVAS_H = 1451

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPrintHtml(layout, values, withBackground) {
  const printOffsetX = typeof layout.printOffsetX === 'number' ? layout.printOffsetX : 0
  const printOffsetY = typeof layout.printOffsetY === 'number' ? layout.printOffsetY : 0
  const bgSrc        = layout.backgroundDataUrl || null
  const fieldNames   = layout.fields ? Object.keys(layout.fields) : []
  const noteIds      = layout.notes  ? Object.keys(layout.notes)  : []

  const hasBg      = !!bgSrc
  const showBg     = withBackground && hasBg
  const showChrome = withBackground && !hasBg
  const sheetClass = showBg
    ? 'template-editor-canvas opd-sheet opd-sheet--with-bg'
    : 'template-editor-canvas opd-sheet'

  const fieldBoxes = fieldNames.map((name) => {
    const cfg   = layout.fields[name] || {}
    const x     = typeof cfg.x === 'number' ? cfg.x : CANVAS_W / 2
    const y     = typeof cfg.y === 'number' ? cfg.y : CANVAS_H / 2
    const left  = (((x + printOffsetX) / CANVAS_W) * 100).toFixed(4)
    const top   = (((y + printOffsetY) / CANVAS_H) * 100).toFixed(4)
    const size  = cfg.size || 13
    const fs    = ((size / 600) * 100).toFixed(4)
    let val = values[name] ?? ''
    if (name.toLowerCase().includes('address') && val.length > 35) {
      val = val.substring(0, 32) + '...'
    }
    const text  = esc(val)
    return '<div class="field-box" style="left:' + left + '%;top:' + top + '%;font-size:' + fs + 'cqw;">' + text + '</div>'
  }).join('\n')

  const noteBoxes = noteIds.map((id) => {
    const cfg  = layout.notes[id] || {}
    const x    = typeof cfg.x === 'number' ? cfg.x : CANVAS_W / 2
    const y    = typeof cfg.y === 'number' ? cfg.y : CANVAS_H / 2
    const left = (((x + printOffsetX) / CANVAS_W) * 100).toFixed(4)
    const top  = (((y + printOffsetY) / CANVAS_H) * 100).toFixed(4)
    const size = cfg.size || 11
    const fs   = ((size / 600) * 100).toFixed(4)
    const text = esc(cfg.text || '')
    return '<div class="field-box" style="left:' + left + '%;top:' + top + '%;font-size:' + fs + 'cqw;">' + text + '</div>'
  }).join('\n')

  const bgTag = showBg ? '<img src="' + bgSrc + '" alt="" />' : ''

  const chromeDisplay = showChrome ? 'flex' : 'none'
  const imgDisplay    = showBg    ? 'block' : 'none'

  // Build inline script as array joined with '' to avoid esbuild parsing the closing tag
  const inlineScript = [
    '(function () {',
    '  var finalized = false;',
    '  function finalize() {',
    '    if (finalized) return;',
    '    finalized = true;',
    '    try { window.location.replace("about:blank"); } catch (e) {}',
    '    setTimeout(function () {',
    '      try { window.close(); } catch (e) {}',
    '    }, 50);',
    '  }',
    '  window.addEventListener("afterprint", finalize, { once: true });',
    '  window.addEventListener("focus", function () { setTimeout(finalize, 200); }, { once: true });',
    '  setTimeout(finalize, 120000);',
    '  window.addEventListener("load", function () {',
    '    setTimeout(function () {',
    '      try { window.print(); } catch (e) { finalize(); }',
    '    }, 0);',
    '  }, { once: true });',
    '})();',
  ].join('\n')

  const parts = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<title>OPD Print</title>',
    '<style>',
    '@page { size: A4 portrait; margin: 0; marks: none; }',
    '*, *::before, *::after { box-sizing: border-box; }',
    'html, body { margin: 0; padding: 0; background: #fff; }',
    '.opd-generator-wrap {',
    '  width: 210mm; aspect-ratio: 210 / 297; height: auto;',
    '  position: relative; background: #ffffff;',
    '  container-type: inline-size; overflow: hidden;',
    '}',
    '.template-editor-canvas { position: relative; width: 100%; height: 100%; }',
    '.template-editor-canvas img {',
    '  position: absolute; left: 0; top: 0; width: 100%; height: 100%;',
    '  display: ' + imgDisplay + '; object-fit: fill; z-index: 1;',
    '}',
    '.field-box {',
    '  position: absolute; padding: 4px 6px; color: #000;',
    '  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '  background: transparent; z-index: 2;',
    '}',
    '.opd-sheet-chrome {',
    '  display: ' + chromeDisplay + '; position: absolute; inset: 0; z-index: 0;',
    '  flex-direction: column; font-family: Arial, Helvetica, sans-serif;',
    '  color: #111; overflow: hidden; font-size: 8px;',
    '}',
    '.opd-sheet--with-bg .opd-sheet-chrome { display: none !important; }',
    '.opd-header { flex-shrink:0; background:linear-gradient(180deg,#0f766e 0%,#0d5c55 100%); color:#fff; padding:0.9em 1em 0.75em; }',
    '.opd-header-brand { display:flex; align-items:center; gap:0.75em; }',
    '.opd-logo-icon { width:2.8em; height:2.8em; display:block; border-radius:0.35em; }',
    '.opd-hospital-name { font-weight:800; font-size:1.6em; letter-spacing:0.04em; line-height:1.1; }',
    '.opd-hospital-meta { margin-top:0.35em; font-size:1em; opacity:0.95; line-height:1.35; }',
    '.opd-patient-section { flex-shrink:0; display:grid; grid-template-columns:1fr 1fr; gap:0.6em 1.25em; padding:0.65em 1em; background:#fff; border-bottom:1px solid #d1d5db; }',
    '.opd-field-line { display:flex; align-items:baseline; gap:0.35em; min-height:1.5em; }',
    '.opd-lbl { font-weight:700; font-size:1.05em; white-space:nowrap; color:#111827; }',
    '.opd-dots { flex:1; border-bottom:1px dotted #6b7280; min-height:0.85em; }',
    '.opd-mid-panel { flex:1; min-height:0; display:flex; flex-direction:column; padding:0.5em 0.65em 0.35em; background:#fff; }',
    '.opd-mid-grid { flex:1; display:grid; grid-template-columns:1fr 1.4fr 1fr; gap:0.35em; min-height:8em; }',
    '.opd-mid-cell { border:1px solid #374151; padding:0.35em 0.4em; background:#fafafa; }',
    '.opd-mid-title { display:block; font-weight:700; font-size:0.95em; margin-bottom:0.5em; color:#111827; }',
    '.opd-mid-list { margin:0; padding-left:1.1em; font-size:0.95em; line-height:1.35; color:#374151; }',
    '.opd-mid-placeholder { margin:0.25em 0 0; font-size:0.9em; line-height:1.3; color:#4b5563; }',
    '.opd-pain-scale { margin-top:0.5em; font-size:0.85em; }',
    '.opd-pain-bar { height:0.4em; margin-top:0.25em; background:linear-gradient(90deg,#22c55e 0%,#eab308 40%,#eab308 60%,#dc2626 100%); border-radius:2px; border:1px solid #9ca3af; }',
    '.opd-mid-bottom { display:grid; grid-template-columns:1fr 1fr; gap:0.35em; margin-top:0.35em; }',
    '.opd-mid-wide { border:1px solid #374151; min-height:2.5em; padding:0.3em 0.4em; font-size:0.95em; font-weight:600; color:#111827; background:#f9fafb; }',
    '.opd-watermark { position:absolute; left:50%; top:52%; transform:translate(-50%,-50%) rotate(-18deg); font-size:clamp(14px,4.5cqw,28px); font-weight:900; color:rgba(15,118,110,0.08); white-space:nowrap; z-index:0; pointer-events:none; font-family:Arial,Helvetica,sans-serif; letter-spacing:0.08em; }',
    '.opd-sheet-footer { flex-shrink:0; margin-top:auto; }',
    '.opd-disclaimer { margin:0; padding:0.35em 0.65em 0.25em; font-size:0.85em; line-height:1.35; color:#374151; background:#fff; }',
    '.opd-bar-grey { display:flex; justify-content:space-between; align-items:center; gap:0.5em; padding:0.35em 0.65em; background:#d1d5db; font-size:0.95em; color:#111827; }',
    '.opd-bar-hindi { flex:1; line-height:1.3; }',
    '.opd-bar-mlc { font-weight:700; white-space:nowrap; }',
    '.opd-bar-teal { height:0.55em; background:#0f766e; }',
    '@media print {',
    '  @page { size: A4 portrait; margin: 0; marks: none; }',
    '  html, body { margin: 0 !important; padding: 0 !important; }',
    '  .opd-generator-wrap { width: 210mm !important; }',
    '}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="opd-generator-wrap">',
    '  <div class="' + sheetClass + '">',
    '    ' + bgTag,
    '    <div class="opd-sheet-chrome" aria-hidden="true">',
    '      <header class="opd-header">',
    '        <div class="opd-header-brand">',
    '          <span class="opd-logo-wrap">',
    '            <svg class="opd-logo-icon" viewBox="0 0 32 32" aria-hidden>',
    '              <rect fill="#ffffff" rx="4" width="32" height="32"/>',
    '              <path fill="#dc2626" d="M14 8h4v8h8v4h-8v8h-4v-8H6v-4h8z"/>',
    '            </svg>',
    '          </span>',
    '          <div class="opd-header-text">',
    '            <div class="opd-hospital-name">VARDAAN HOSPITAL</div>',
    '            <div class="opd-hospital-meta">Near oxford School, Rohtak By Pass Road, JIND M. +91 99924-25764, +91 70828-77717</div>',
    '          </div>',
    '        </div>',
    '      </header>',
    '      <section class="opd-patient-section">',
    '        <div class="opd-patient-col">',
    '          <div class="opd-field-line"><span class="opd-lbl">OPD No</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Patient Name</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Age / Sex</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Guardian Name</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Address</span><span class="opd-dots"></span></div>',
    '        </div>',
    '        <div class="opd-patient-col">',
    '          <div class="opd-field-line"><span class="opd-lbl">Date</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Doctor</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Reg. No.</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Amount</span><span class="opd-dots"></span></div>',
    '          <div class="opd-field-line"><span class="opd-lbl">Mobile</span><span class="opd-dots"></span></div>',
    '        </div>',
    '      </section>',
    '      <div class="opd-mid-panel">',
    '        <div class="opd-mid-grid">',
    '          <div class="opd-mid-cell opd-mid-vitals">',
    '            <span class="opd-mid-title">Vital assessment</span>',
    '            <ul class="opd-mid-list"><li>BP</li><li>PR</li><li>Temp</li><li>RR</li><li>SPO2</li><li>Wt. / Ht. / BMI</li></ul>',
    '          </div>',
    '          <div class="opd-mid-cell opd-mid-center">',
    '            <span class="opd-mid-title">CO-Morbidities &amp; screening</span>',
    '            <p class="opd-mid-placeholder">DM &middot; HTN &middot; CAD &middot; COPD &middot; CVA &middot; THYROID &middot; Nutritional screening</p>',
    '            <div class="opd-pain-scale"><span>Pain 0 &mdash; 10</span><div class="opd-pain-bar"></div></div>',
    '          </div>',
    '          <div class="opd-mid-cell opd-mid-side">',
    '            <span class="opd-mid-title">Allergy &amp; addiction</span>',
    '            <p class="opd-mid-placeholder">Drug &middot; Food &middot; Others &middot; Smoking &middot; Alcohol</p>',
    '          </div>',
    '        </div>',
    '        <div class="opd-mid-bottom">',
    '          <div class="opd-mid-wide">Chief complaints</div>',
    '          <div class="opd-mid-wide">Preventive / special advice</div>',
    '        </div>',
    '      </div>',
    '      <div class="opd-watermark">VARDAAN HOSPITAL</div>',
    '      <footer class="opd-sheet-footer">',
    '        <p class="opd-disclaimer">Prescribed Medicines are only suggestions, patient is free to choose any reliable generic/brand of their choice with exactly the same content.</p>',
    '        <div class="opd-bar-grey">',
    '          <span class="opd-bar-hindi">\u0915\u0943\u092a\u092f\u093e \u0905\u0917\u0932\u0940 \u092c\u093e\u0930 \u092a\u0941\u0930\u093e\u0085\u0928\u0940 \u092a\u0930\u094d\u091a\u0940 \u0935 \u0930\u093f\u092a\u094b\u0930\u094d\u091f\u0938 \u0938\u093e\u0925 \u0932\u093e\u090f\u0902</span>',
    '          <span class="opd-bar-mlc">&#10022; Not Valid For MLC</span>',
    '        </div>',
    '        <div class="opd-bar-teal"></div>',
    '      </footer>',
    '    </div>',
    '    ' + fieldBoxes,
    '    ' + noteBoxes,
    '  </div>',
    '</div>',
    '<' + 'script' + '>',
    inlineScript,
    '</' + 'script' + '>',
    '</body>',
    '</html>',
  ]

  return parts.join('\n')
}
