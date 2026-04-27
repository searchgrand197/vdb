import React, { memo, useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pill, Trash2, ArrowLeft, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api'
import {
  CATEGORY_RULE_REFERENCE,
  presetRuleForForm,
  normalizeCategoryName,
  DEFAULT_CATEGORY_RULE,
} from './categoryRulePresets'

const RULE_TYPE_OPTIONS = [
  { value: 'strip_based', label: 'Strip-based (allow loose sale)' },
  { value: 'liquid', label: 'Liquid (no loose sale)' },
  { value: 'flexible', label: 'Flexible (outer + retail + base)' },
  { value: 'unit_only', label: 'Unit only' },
]

const DEFAULT_CATEGORIES = [
  'Tablet', 'Syrup', 'Capsule', 'Injection', 'Cream', 'Powder', 'Drops', 'Surgicals', 'Liquid', 'Gel',
  'Suspension', 'Lotion', 'Diaper', 'Soap', 'Oil', 'Ointment', 'Kit', 'Bandage', 'Device', 'Spray',
  'Shampoo', 'Sachet', 'Facewash', 'Packet', 'Bottle', 'Solution', 'Condom', 'Sanitary Pad', 'Unit', 'Infusion',
  'Box', 'Elixir', 'Paste', 'Bolus', 'Balm', 'Respule', 'Toothpaste', 'Inhaler', 'Toothbrush', 'Serum',
  'Syringe', 'Paint', 'Churna', 'Granules', 'Face Mask', 'Jelly', 'Deodorant', 'Strip', 'Plaster', 'Wipe',
  'Roll On', 'Gummies', 'Chyawanprash', 'Mouthwash', 'Tube', 'Pouch', 'Wash', 'Rotacap', 'Vaccine', 'Suppository',
  'Patch', 'Jar', 'Water', 'Card', 'Expectorant', 'Razor', 'Lozenges', 'Honey', 'Thermometer', 'Tincture',
  'Conditioner', 'Bar', 'Nebulisers', 'Handwash', 'Liniment', 'Foam', 'Gargle', 'Vial', 'Moisturiser', 'Gum',
  'Scrub', 'Ampules', 'Cleanser', 'Particles', 'Adhesive', 'Lozenge', 'Diskette', 'Pen', 'Pastilles', 'Soflets',
  'Transcap', 'Tonic', 'Grains', 'Linctus', 'Pellet', 'Respicap', 'Pessaries', 'Cartrige', 'Husk', 'Emulsion',
  'Pessary', 'Enema', 'Gummy', 'Lacquer', 'Rotahaler', 'Instacap', 'Captabs', 'Aerosol', 'Film', 'Redicap',
  'Novocart', 'Opticops', 'Solvent', 'Tabcaps', 'Particle', 'Rapitab', 'Caplets', 'Intrauterine System', 'Transpule',
  'Transhaler', 'Vegicaps', 'Aquanase', 'Autopen', 'Multihaler', 'Oxipule', 'Autohaler', 'Alicaps', 'Rheocap',
  'Nexcaps', 'Oxycaps',
]

function colorForText(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return {
    backgroundColor: `hsl(${hue} 85% 94%)`,
    borderColor: `hsl(${hue} 70% 76%)`,
    color: `hsl(${hue} 60% 30%)`,
  }
}

function normalize(v) {
  return (v || '').trim().toLowerCase()
}

function uniqCategories(values) {
  const out = []
  const seen = new Set()
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

function PharmacyCategoriesView() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categorySearch, setCategorySearch] = useState('')
  const [medicineSearch, setMedicineSearch] = useState('')
  const [categoryStack, setCategoryStack] = useState([])
  const [customCategories, setCustomCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryParentId, setNewCategoryParentId] = useState('')
  const [rulesCategory, setRulesCategory] = useState('')
  const [rulesDraft, setRulesDraft] = useState({ ...DEFAULT_CATEGORY_RULE })
  const [rulesSaving, setRulesSaving] = useState(false)

  const selectedCategory = categoryStack[categoryStack.length - 1] || ''

  useEffect(() => {
    let cancelled = false
    setCategoriesLoading(true)
    api
      .get('/medicine-categories/?limit=1000')
      .then((res) => {
        if (cancelled) return
        const list = res.data?.data || res.data?.results || []
        setCustomCategories(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load categories')
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false)
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get('/medicines/?limit=2000')
      .then((res) => {
        if (cancelled) return
        const list = res.data?.data || res.data?.results || []
        setMedicines(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load medicines')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => {
    const fromMedicines = medicines.map((m) => m.form).filter(Boolean)
    const fromApi = customCategories
      .filter((c) => !c.parent)
      .map((c) => c.name)
      .filter(Boolean)
    return uniqCategories([...DEFAULT_CATEGORIES, ...fromMedicines, ...fromApi])
  }, [medicines, customCategories])

  const topLevelCustomCategories = useMemo(
    () => customCategories.filter((c) => !c.parent),
    [customCategories],
  )

  const subcategoriesByParentName = useMemo(() => {
    const map = new Map()
    customCategories.forEach((cat) => {
      const parentName = (cat.parent_name || '').trim()
      if (!parentName) return
      const key = normalize(parentName)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(cat)
    })
    return map
  }, [customCategories])

  const categoryByName = useMemo(() => {
    const map = new Map()
    customCategories.forEach((cat) => {
      const key = normalize(cat.name)
      if (!key || map.has(key)) return
      map.set(key, cat)
    })
    return map
  }, [customCategories])

  const selectedCategoryRow = selectedCategory ? categoryByName.get(normalize(selectedCategory)) : null

  const visibleCategories = useMemo(() => {
    const q = normalize(categorySearch)
    if (!q) return categories
    return categories.filter((c) => normalize(c).includes(q))
  }, [categories, categorySearch])

  const visibleMeds = useMemo(() => {
    const q = normalize(medicineSearch)
    if (!selectedCategory) return []
    return medicines.filter((m) => {
      const inCategory = normalize(m.form) === normalize(selectedCategory)
      if (!inCategory) return false
      if (!q) return true
      const hay = `${m.name || ''} ${m.sku || ''} ${m.pack_info || ''} ${m.hsn_code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [medicines, selectedCategory, medicineSearch])

  function openCategory(name) {
    const clean = (name || '').trim()
    if (!clean) return
    setCategoryStack((prev) => {
      if (normalize(prev[prev.length - 1] || '') === normalize(clean)) return prev
      return [...prev, clean]
    })
  }

  function openTopLevelCategory(name) {
    const clean = (name || '').trim()
    if (!clean) return
    setCategoryStack([clean])
  }

  async function addCategory({ parentId = null, parentName = '' } = {}) {
    const raw = newCategory.trim()
    if (!raw) return
    const duplicate = customCategories.some((c) => {
      if (normalize(c.name) !== normalize(raw)) return false
      const cParentName = normalize(c.parent_name || '')
      return cParentName === normalize(parentName)
    })
    if (duplicate || (!parentId && categories.some((c) => normalize(c) === normalize(raw)))) {
      toast('Category already exists')
      return
    }
    const payload = { name: raw, is_active: true }
    if (parentId) payload.parent = parentId
    try {
      const res = await api.post('/medicine-categories/', payload)
      const created = res.data?.data || res.data
      setCustomCategories((prev) => [...prev, created])
      setNewCategory('')
      setNewCategoryParentId('')
      if (parentName) {
        setCategoryStack([parentName, raw])
      } else {
        setCategoryStack([raw])
      }
      toast.success(parentId ? 'Sub-category added' : 'Category added')
      return created
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to add category')
      return null
    }
  }

  async function ensureParentCategory(parentName) {
    const cleanName = (parentName || '').trim()
    if (!cleanName) return null
    const existing = customCategories.find((c) => normalize(c.name) === normalize(cleanName))
    if (existing?.id) return existing
    try {
      const preset = presetRuleForForm(cleanName)
      const payload = {
        name: cleanName,
        is_active: true,
        rule_type: preset.rule_type,
        allow_loose_sale: !!preset.allow_loose_sale,
        base_unit_label: (preset.base_unit_label || 'unit').trim().slice(0, 40),
        retail_pack_label: (preset.retail_pack_label || '').trim().slice(0, 40),
        outer_pack_label: (preset.outer_pack_label || '').trim().slice(0, 40),
      }
      const res = await api.post('/medicine-categories/', payload)
      const created = res.data?.data || res.data
      setCustomCategories((prev) => [...prev, created])
      return created
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save parent category')
      return null
    }
  }

  function removeCustomCategory(cat) {
    const row = customCategories.find((c) => normalize(c.name) === normalize(cat))
    if (!row?.id) return
    api
      .delete(`/medicine-categories/${row.id}/`)
      .then(() => {
        setCustomCategories((prev) => prev.filter((c) => c.id !== row.id))
        if (normalize(selectedCategory) === normalize(cat)) {
          setCategoryStack([])
        }
        toast.success(`Deleted category: ${cat}`)
      })
      .catch((e) => {
        toast.error(e?.response?.data?.detail || 'Failed to delete category')
      })
  }

  function assignCategory(medicineId, categoryName) {
    api
      .patch(`/medicines/${medicineId}/`, { form: categoryName })
      .then(() => {
        setMedicines((prev) =>
          prev.map((m) => (String(m.id) === String(medicineId) ? { ...m, form: categoryName } : m)),
        )
      })
      .catch(() => {
        toast.error('Failed to assign category')
      })
  }

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

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Medicine Categories</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search category..."
              className="pl-8 pr-3 py-1.5 text-sm rounded border border-slate-200 bg-white"
            />
          </div>
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Add category"
            className="px-3 py-1.5 text-sm rounded border border-slate-200 bg-white"
          />
          <select
            value={newCategoryParentId}
            onChange={(e) => setNewCategoryParentId(e.target.value)}
            className="px-2 py-1.5 text-sm rounded border border-slate-200 bg-white"
          >
            <option value="">Main category</option>
            {topLevelCustomCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                Sub of {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const parentRow = customCategories.find((c) => String(c.id) === String(newCategoryParentId))
              addCategory({
                parentId: newCategoryParentId || null,
                parentName: parentRow?.name || '',
              })
            }}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-1"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {!selectedCategory ? (
        <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-xl bg-white p-3 space-y-3">
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Package className="text-indigo-600 shrink-0" size={18} />
              <h3 className="text-sm font-bold text-slate-900">📦 Category rules (auto apply)</h3>
            </div>
            <p className="text-[11px] text-slate-600 mb-3">
              Set unit names and sale style per category. When you add a medicine and pick this form, conversion labels
              (e.g. 1 strip = 10 tablets) use these names with your <strong>Units / Pack</strong> number.
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
                    {visibleCategories.map((cat) => (
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {visibleCategories.map((cat) => {
              const count = medicines.filter((m) => normalize(m.form) === normalize(cat)).length
              const css = colorForText(cat)
              const isCustom = customCategories.some((c) => normalize(c.name) === normalize(cat))
              const subcats = subcategoriesByParentName.get(normalize(cat)) || []
              return (
                <div key={cat} className="rounded-xl border px-3 py-3 min-h-[86px] transition" style={css}>
                  <button type="button" onClick={() => openTopLevelCategory(cat)} className="w-full text-left">
                    <div className="text-base font-bold leading-tight">{cat}</div>
                    <div className="text-xs opacity-75 mt-1">{count} items</div>
                    {subcats.length > 0 && <div className="text-[11px] mt-1 opacity-80">{subcats.length} sub-categories</div>}
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => removeCustomCategory(cat)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryStack((prev) => prev.slice(0, -1))
                  setMedicineSearch('')
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div className="text-sm font-semibold text-slate-700 flex items-center gap-2 flex-wrap">
                <span>
                  {selectedCategory} Medicines ({visibleMeds.length})
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {categoryStack.join(' / ')}
                </span>
                {!!selectedCategoryRow?.parent_name && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Sub-category of {selectedCategoryRow.parent_name}
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={medicineSearch}
                onChange={(e) => setMedicineSearch(e.target.value)}
                placeholder="Search medicine..."
                className="pl-8 pr-3 py-1 text-sm rounded border border-slate-200"
              />
            </div>
          </div>
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70">
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Sub-categories</div>
            <div className="flex flex-wrap gap-1.5">
              {(subcategoriesByParentName.get(normalize(selectedCategory)) || []).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => openCategory(sub.name)}
                  className="px-2 py-0.5 rounded-full text-xs border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                >
                  {sub.name}
                </button>
              ))}
              {(subcategoriesByParentName.get(normalize(selectedCategory)) || []).length === 0 && (
                <span className="text-xs text-slate-500">No sub-categories yet.</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={`Add sub-category under ${selectedCategory}`}
                className="px-2 py-1 text-sm rounded border border-slate-200 bg-white"
              />
              <button
                type="button"
                onClick={async () => {
                  const parentRow = await ensureParentCategory(selectedCategory)
                  if (!parentRow?.id) return
                  await addCategory({ parentId: parentRow.id, parentName: parentRow.name })
                }}
                className="px-2.5 py-1 rounded bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <Plus size={12} /> Add sub-category
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {loading || categoriesLoading ? (
              <div className="p-4 text-sm text-slate-500">Loading medicines...</div>
            ) : visibleMeds.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Pill className="mx-auto mb-2 text-slate-300" size={24} />
                No medicines found for this category.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Medicine</th>
                    <th className="text-left px-3 py-2">Category</th>
                    <th className="text-left px-3 py-2">Pack</th>
                    <th className="text-left px-3 py-2">HSN</th>
                    <th className="text-left px-3 py-2">Assign Category</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMeds.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 text-slate-600">{m.form || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{m.pack_info || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{m.hsn_code || '—'}</td>
                      <td className="px-3 py-2">
                        <select
                          value={m.form || ''}
                          onChange={(e) => assignCategory(m.id, e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm bg-white"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(PharmacyCategoriesView)

