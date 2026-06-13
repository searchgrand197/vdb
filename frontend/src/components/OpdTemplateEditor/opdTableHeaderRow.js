/**
 * Tables store optional labels in `headers[]` for row 0.
 * Legacy layouts used "Col 1", "Col 2" placeholders with a gray header row.
 * We treat placeholders (or all-empty) as "no header row" so row 0 matches other rows.
 *
 * Set `tableHeaderPlain: false` on a table to force the shaded header row even
 * if titles look like placeholders (rare).
 */

export function useStyledTableHeaderRow(tableCfg) {
  const cfg = tableCfg || {}
  if (cfg.tableHeaderPlain === true) return false
  if (cfg.tableHeaderPlain === false) return true

  const cols = Number(cfg.cols) || 2
  const headers = Array.isArray(cfg.headers) ? cfg.headers : []

  for (let i = 0; i < cols; i++) {
    const s = String(headers[i] ?? '').trim()
    if (!s) continue
    if (!/^Col\s*\d+$/i.test(s)) return true
  }
  return false
}
