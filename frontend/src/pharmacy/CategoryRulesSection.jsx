import React, { memo, useEffect, useMemo, useState } from 'react'
import { Package } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api'
import {
  CATEGORY_RULE_REFERENCE,
  presetRuleForForm,
  normalizeCategoryName,
  DEFAULT_CATEGORY_RULE,
} from './categoryRulePresets'
import { mergeCategoryNames } from './pharmacyCategoryNames'

const RULE_TYPE_OPTIONS = [
  { value: 'strip_based', label: 'Strip-based (allow loose sale)' },
  { value: 'liquid', label: 'Liquid (no loose sale)' },
  { value: 'flexible', label: 'Flexible (outer + retail + base)' },
  { value: 'unit_only', label: 'Unit only' },
]

function CategoryRulesSection() {
  const [medicines, setMedicines] = useState([])
  const [customCategories, setCustomCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [rulesCategory, setRulesCategory] = useState('')
  const [rulesDraft, setRulesDraft] = useState({ ...DEFAULT_CATEGORY_RULE })
  const [rulesSaving, setRulesSaving] = useState(false)

  const categoryOptions = useMemo(
    () => mergeCategoryNames(medicines, customCategories),
    [medicines, customCategories],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get('/medicine-categories/?limit=1000'),
      api.get('/medicines/?limit=2000'),
    ])
      .then(([catRes, medRes]) => {
        if (cancelled) return
        const catList = catRes.data?.data || catRes.data?.results || []
        const medList = medRes.data?.data || medRes.data?.results || []
        setCustomCategories(Array.isArray(catList) ? catList : [])
        setMedicines(Array.isArray(medList) ? medList : [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load category rules data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!rulesCategory) {
      setRulesDraft({ ...DEFAULT_CATEGORY_RULE })
      return
    }
    const preset = presetRuleForForm(rulesCategory)
    const row = customCategories.find((c) => normalizeCategoryName(c.name) === normalizeCategoryName(rulesCategory))
    setRulesDraft({
      rule_type: row?.rule_type || preset.rule_type,
      allow_loose_sale:
        typeof row?.allow_loose_sale === 'boolean' ? row.allow_loose_sale : preset.allow_loose_sale,
      base_unit_label: (row?.base_unit_label || '').trim() || preset.base_unit_label,
      retail_pack_label: (row?.retail_pack_label ?? preset.retail_pack_label) || '',
      outer_pack_label: (row?.outer_pack_label ?? preset.outer_pack_label) || '',
    })
  }, [rulesCategory, customCategories])

  async function saveCategoryRules() {
    const name = (rulesCategory || '').trim()
    if (!name) {
      toast.error('Choose a category first')
      return
    }
    setRulesSaving(true)
    const payload = {
      name,
      is_active: true,
      rule_type: rulesDraft.rule_type,
      allow_loose_sale: !!rulesDraft.allow_loose_sale,
      base_unit_label: (rulesDraft.base_unit_label || 'unit').trim().slice(0, 40),
      retail_pack_label: (rulesDraft.retail_pack_label || '').trim().slice(0, 40),
      outer_pack_label: (rulesDraft.outer_pack_label || '').trim().slice(0, 40),
    }
    try {
      const row = customCategories.find((c) => normalizeCategoryName(c.name) === normalizeCategoryName(name))
      if (row?.id) {
        const { data } = await api.patch(`/medicine-categories/${row.id}/`, payload)
        const updated = data?.data || data?.entity || data
        setCustomCategories((prev) =>
          prev.map((c) => (String(c.id) === String(row.id) ? { ...c, ...updated } : c)),
        )
        toast.success('Category rules updated')
      } else {
        const { data } = await api.post('/medicine-categories/', payload)
        const created = data?.data || data?.entity || data
        if (created?.id) {
          setCustomCategories((prev) => {
            const next = [...prev.filter((c) => normalizeCategoryName(c.name) !== normalizeCategoryName(name)), created]
            return next.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          })
        }
        toast.success('Managed category saved — rules apply when adding medicines')
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.errors?.detail || 'Could not save rules')
    } finally {
      setRulesSaving(false)
    }
  }

  if (loading) {
    return <div className="text-xs text-slate-500 py-2">Loading category rules…</div>
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Package className="text-indigo-600 shrink-0" size={18} />
        <h3 className="text-sm font-bold text-slate-900">Category rules (auto apply)</h3>
      </div>
      <p className="text-[11px] text-slate-600 mb-3">
        Set unit names and sale style per category. When you add a medicine and pick this form, conversion labels (e.g. 1
        strip = 10 tablets) use these names with your <strong>Units / Pack</strong> number.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2 max-h-56 overflow-y-auto text-[11px] text-slate-700 space-y-2">
          <p className="font-bold text-[10px] text-slate-500 uppercase tracking-wide">Reference</p>
          {CATEGORY_RULE_REFERENCE.map((grp) => (
            <div key={grp.title}>
              <div className="font-semibold text-indigo-900 text-[11px]">{grp.title}</div>
              <ul className="list-disc pl-4 mt-0.5 text-slate-600">
                {grp.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-2">
          <label className="block">
            <span className="text-[10px] font-semibold text-slate-700">Category to configure</span>
            <select
              value={rulesCategory}
              onChange={(e) => setRulesCategory(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Select category…</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                  {customCategories.some((c) => normalizeCategoryName(c.name) === normalizeCategoryName(cat))
                    ? ' · saved'
                    : ' · preset until saved'}
                </option>
              ))}
            </select>
          </label>
          {!!rulesCategory && (
            <>
              <label className="block">
                <span className="text-[10px] font-semibold text-slate-700">Rule type</span>
                <select
                  value={rulesDraft.rule_type}
                  onChange={(e) => setRulesDraft((d) => ({ ...d, rule_type: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded px-2 py-1.5 text-sm bg-white"
                >
                  {RULE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!rulesDraft.allow_loose_sale}
                  onChange={(e) => setRulesDraft((d) => ({ ...d, allow_loose_sale: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <span className="text-[11px] text-slate-700 font-medium">Allow loose sale (fractional base units)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Base unit label</span>
                  <input
                    value={rulesDraft.base_unit_label}
                    onChange={(e) => setRulesDraft((d) => ({ ...d, base_unit_label: e.target.value }))}
                    placeholder="e.g. tablet"
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Retail pack label</span>
                  <input
                    value={rulesDraft.retail_pack_label}
                    onChange={(e) => setRulesDraft((d) => ({ ...d, retail_pack_label: e.target.value }))}
                    placeholder="e.g. strip, bottle"
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-700">Outer pack (optional)</span>
                  <input
                    value={rulesDraft.outer_pack_label}
                    onChange={(e) => setRulesDraft((d) => ({ ...d, outer_pack_label: e.target.value }))}
                    placeholder="e.g. box"
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={rulesSaving}
                onClick={saveCategoryRules}
                className="w-full sm:w-auto px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
              >
                {rulesSaving ? 'Saving…' : 'Save rules for this category'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(CategoryRulesSection)
