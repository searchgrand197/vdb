import { resolveSlipFieldLabel } from './opdCoreFields.js'

/** Shared width (in `ch`) for the "Label: " column so values line up across fields. */
export function computeSlipLabelChCount(layout, opdFieldConfig) {
  const names = Object.keys(layout?.fields || {})
  if (!names.length) return 8
  const widths = names.map((name) => {
    const cfg = layout.fields?.[name] || {}
    const label = resolveSlipFieldLabel(name, cfg, layout, opdFieldConfig)
    return label ? label.length : 0
  }).filter((n) => n > 0)
  if (!widths.length) return 8
  return Math.max(8, ...widths)
}

/** Fixed label column + aligned value column (requires "Show field name on slip"). */
export function slipColumnAlignEnabled(layout) {
  return layout?.alignSlipFieldColumns === true
}
