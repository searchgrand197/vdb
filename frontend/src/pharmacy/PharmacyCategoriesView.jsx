import React, { memo, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Plus, Pill, Trash2, ArrowLeft, Folder, Pencil, CheckCircle2, X, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api'
import { presetRuleForForm, normalizeCategoryName } from './categoryRulePresets'
import { mergeCategoryNames } from './pharmacyCategoryNames'

function colorForText(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return {
    backgroundColor: `hsl(${hue} 88% 78%)`,
    borderColor: `hsl(${hue} 78% 52%)`,
    color: `hsl(${hue} 58% 20%)`,
  }
}

function hueForText(text) {
  let hash = 0
  const source = String(text || '')
  for (let i = 0; i < source.length; i += 1) hash = source.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

function defaultHexColorForText(text) {
  return hslToHex(hueForText(text), 78, 52)
}

function normalizeHexColor(value) {
  const raw = (value || '').trim().toUpperCase()
  if (!raw) return ''
  if (!/^#[0-9A-F]{6}$/.test(raw)) return ''
  return raw
}

function colorForCategory(cat) {
  const custom = normalizeHexColor(cat?.color)
  if (!custom) return colorForText(cat?.name || '')
  const r = Number.parseInt(custom.slice(1, 3), 16)
  const g = Number.parseInt(custom.slice(3, 5), 16)
  const b = Number.parseInt(custom.slice(5, 7), 16)
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.22)`,
    borderColor: custom,
    // Keep text dark because the folder body is intentionally pastel/light.
    color: '#0F172A',
  }
}

function normalize(v) {
  return (v || '').trim().toLowerCase()
}

function parseApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data
  const errors = data?.errors
  const detail = errors?.detail || data?.detail
  if (Array.isArray(detail)) return detail[0] || fallbackMessage
  if (typeof detail === 'string' && detail.trim()) return detail
  if (typeof errors === 'string' && errors.trim()) return errors
  return fallbackMessage
}

/** Shared tile for category grid (top-level) and sub-category grid (drilled-in). */
function CategoryBrowseTile({ title, style, size = 'lg', onClick, details, actions, selectable = false, selected = false, onSelect }) {
  const compact = size === 'sm'
  const folderBg = style?.backgroundColor || '#eef2ff'
  const folderText = style?.color || '#1e293b'
  const folderBorder = style?.borderColor || '#c7d2fe'
  return (
    <div className={`relative ${compact ? 'min-h-[120px]' : 'min-h-[138px]'} transition`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        }}
        className="w-full text-left group cursor-pointer"
      >
        <div className={`relative ${compact ? 'h-20' : 'h-24'}`}>
          <div
            className={`absolute left-1.5 top-0 rounded-t-md border-2 border-b-0 ${compact ? 'w-12 h-3.5' : 'w-14 h-4'}`}
            style={{ backgroundColor: folderBg, borderColor: folderBorder }}
          />
          <div
            className={`absolute inset-x-0 bottom-0 rounded-md border-2 ${compact ? 'h-16' : 'h-20'} group-hover:brightness-95`}
            style={{ backgroundColor: folderBg, borderColor: folderBorder }}
          />
          {selectable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.()
              }}
              className={`absolute z-20 left-2 bottom-2 w-5 h-5 rounded-full border-2 shadow-sm flex items-center justify-center ${
                selected
                  ? 'border-emerald-600 bg-white text-emerald-600'
                  : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
              }`}
              title={selected ? 'Selected' : 'Select'}
            >
              <CheckCircle2 size={13} />
            </button>
          )}
          <div className={`absolute left-2.5 ${compact ? 'top-4.5' : 'top-5'} opacity-70`} style={{ color: folderText }}>
            <Folder size={compact ? 13 : 15} />
          </div>
        </div>
        <div className={`${compact ? 'mt-0.5 px-0.5' : 'mt-1 px-0.5'} overflow-hidden`} style={{ color: folderText }}>
          <div className={`font-bold leading-tight truncate ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{title}</div>
          <div className={`opacity-90 leading-tight ${compact ? 'text-[11px] mt-0.5' : 'text-[12px] mt-0.5'}`}>{details}</div>
        </div>
      </div>
      {actions && <div className="mt-1">{actions}</div>}
    </div>
  )
}

/** Recursive tree rows — mirrors CategoryPickerTreeRows in PharmacyPortal */
function CatTreeRows({ nodes, depth, childrenOf, expandedIds, onToggle, onSelect }) {
  if (!nodes?.length) return null
  return nodes.map((r) => {
    const id = String(r.id)
    const kids = childrenOf.get(id) || []
    const hasKids = kids.length > 0
    const expanded = expandedIds.has(id)
    return (
      <div key={id}>
        <div className="flex items-center min-h-[28px] pr-1" style={{ paddingLeft: `${8 + depth * 12}px` }}>
          <div className="w-6 shrink-0 flex items-center justify-center">
            {hasKids ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onToggle(id) }}
                className="p-0.5 rounded hover:bg-slate-100 text-slate-600"
              >
                <ChevronRight
                  size={14}
                  className="text-slate-500 transition-transform duration-150"
                  style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
                />
              </button>
            ) : (
              <span className="inline-block w-4 shrink-0" />
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelect(r)}
            className="flex-1 text-left text-[11px] py-1 px-1 rounded hover:bg-slate-50 text-slate-800 truncate min-w-0"
          >
            {r.name}
          </button>
        </div>
        {hasKids && expanded && (
          <CatTreeRows
            nodes={kids}
            depth={depth + 1}
            childrenOf={childrenOf}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        )}
      </div>
    )
  })
}

function PharmacyCategoriesView({ batches = [] }) {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categorySearch, setCategorySearch] = useState('')
  const [medicineSearch, setMedicineSearch] = useState('')
  const [categoryPath, setCategoryPath] = useState([])
  const [customCategories, setCustomCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [actionMode, setActionMode] = useState('none') // none | edit | delete
  const [deleteSelection, setDeleteSelection] = useState([])
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [medicineSelection, setMedicineSelection] = useState([])
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveToCategory, setMoveToCategory] = useState('')
  const [moving, setMoving] = useState(false)
  const [deletingMeds, setDeletingMeds] = useState(false)

  // Tree picker state for Move modal
  const [moveCatPickerOpen, setMoveCatPickerOpen] = useState(false)
  const [moveCatSearch, setMoveCatSearch] = useState('')
  const [moveCatExpandedIds, setMoveCatExpandedIds] = useState(() => new Set())

  const selectedCategoryNode = categoryPath[categoryPath.length - 1] || null
  const selectedCategory = selectedCategoryNode?.name || ''

  const fetchCategories = useMemo(
    () => () =>
      api
        .get('/medicine-categories/?limit=1000')
        .then((res) => {
          const list = res.data?.data || res.data?.results || []
          setCustomCategories(Array.isArray(list) ? list : [])
          return Array.isArray(list) ? list : []
        }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    setCategoriesLoading(true)
    fetchCategories()
      .then((res) => {
        if (cancelled) return
        setCustomCategories(Array.isArray(res) ? res : [])
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
  }, [fetchCategories])

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

  const categories = useMemo(() => mergeCategoryNames(medicines, customCategories), [medicines, customCategories])

  const categoriesById = useMemo(() => {
    const map = new Map()
    customCategories.forEach((cat) => {
      if (cat?.id == null) return
      map.set(String(cat.id), cat)
    })
    return map
  }, [customCategories])

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

  const subcategoriesByParentId = useMemo(() => {
    const map = new Map()
    customCategories.forEach((cat) => {
      if (!cat.parent) return
      const key = String(cat.parent)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(cat)
    })
    return map
  }, [customCategories])

  const selectedCategoryRow = useMemo(() => {
    if (!selectedCategoryNode?.id) return null
    return categoriesById.get(String(selectedCategoryNode.id)) || null
  }, [selectedCategoryNode, categoriesById])
  const categoryBreadcrumb = useMemo(
    () => categoryPath.map((node) => node?.name || '').filter(Boolean).join(' / '),
    [categoryPath],
  )
  const managedMoveCategoryOptions = useMemo(() => {
    const getLabel = (row) => {
      const parts = [row.name]
      let parentId = row.parent ? String(row.parent) : ''
      while (parentId) {
        const p = categoriesById.get(parentId)
        if (!p) break
        parts.unshift(p.name)
        parentId = p.parent ? String(p.parent) : ''
      }
      return parts.join(' / ')
    }
    return customCategories
      .map((row) => ({ value: `id:${row.id}`, label: getLabel(row), id: String(row.id) }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [customCategories, categoriesById])

  // Tree structure for the picker
  const { treeRoots, treeChildrenOf, treeIdToRow } = useMemo(() => {
    const idToRow = new Map()
    customCategories.forEach((c) => { if (c?.id) idToRow.set(String(c.id), c) })
    const childrenOf = new Map()
    const roots = []
    customCategories.forEach((c) => {
      if (!c?.id) return
      if (c.parent) {
        const pk = String(c.parent)
        if (!childrenOf.has(pk)) childrenOf.set(pk, [])
        childrenOf.get(pk).push(c)
      } else {
        roots.push(c)
      }
    })
    return { treeRoots: roots, treeChildrenOf: childrenOf, treeIdToRow: idToRow }
  }, [customCategories])

  const moveCatSelectedRow = useMemo(() => {
    if (!moveToCategory.startsWith('id:')) return null
    return treeIdToRow.get(moveToCategory.slice(3)) || null
  }, [moveToCategory, treeIdToRow])

  const moveCatBreadcrumb = useMemo(() => {
    if (!moveCatSelectedRow) return ''
    const parts = [moveCatSelectedRow.name]
    let parentId = moveCatSelectedRow.parent ? String(moveCatSelectedRow.parent) : ''
    while (parentId) {
      const p = treeIdToRow.get(parentId)
      if (!p) break
      parts.unshift(p.name)
      parentId = p.parent ? String(p.parent) : ''
    }
    return parts.join(' › ')
  }, [moveCatSelectedRow, treeIdToRow])

  const moveCatFilteredOptions = useMemo(() => {
    const q = moveCatSearch.trim().toLowerCase()
    return managedMoveCategoryOptions.filter(
      (o) => !q || o.label.toLowerCase().includes(q),
    )
  }, [managedMoveCategoryOptions, moveCatSearch])

  function selectMoveCatRow(row) {
    if (!row?.id) return
    setMoveToCategory(`id:${row.id}`)
    setMoveCatPickerOpen(false)
    setMoveCatSearch('')
  }

  function toggleMoveCatExpand(id) {
    setMoveCatExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(String(id))) next.delete(String(id))
      else next.add(String(id))
      return next
    })
  }

  const visibleCategories = useMemo(() => {
    const q = normalize(categorySearch)
    if (!q) return categories
    return categories.filter((c) => normalize(c).includes(q))
  }, [categories, categorySearch])

  const visibleMeds = useMemo(() => {
    const q = normalize(medicineSearch)
    if (!selectedCategory) return []
    return medicines.filter((m) => {
      if (m?.is_active === false) return false
      const inCategory = selectedCategoryRow?.id
        ? String(m.category || '') === String(selectedCategoryRow.id)
        : normalize(m.form) === normalize(selectedCategory)
      if (!inCategory) return false
      if (!q) return true
      const hay = `${m.name || ''} ${m.sku || ''} ${m.pack_info || ''} ${m.hsn_code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [medicines, selectedCategory, selectedCategoryRow, medicineSearch])

  const medicineCountByForm = useMemo(() => {
    const map = new Map()
    medicines.forEach((m) => {
      const f = normalize(m.form)
      if (!f) return
      map.set(f, (map.get(f) || 0) + 1)
    })
    return map
  }, [medicines])

  const selectedSubcategories = useMemo(() => {
    if (!selectedCategory) return []
    if (selectedCategoryRow?.id) {
      return subcategoriesByParentId.get(String(selectedCategoryRow.id)) || []
    }
    return subcategoriesByParentName.get(normalize(selectedCategory)) || []
  }, [selectedCategory, selectedCategoryRow, subcategoriesByParentId, subcategoriesByParentName])

  function childCountForCategoryName(name) {
    const normalizedName = normalize(name)
    if (!normalizedName) return 0
    // Prefer exact parent-id based counting for managed categories.
    const candidateRows = customCategories.filter((c) => normalize(c.name) === normalizedName)
    if (candidateRows.length > 0) {
      const seen = new Set()
      candidateRows.forEach((row) => {
        const list = subcategoriesByParentId.get(String(row.id)) || []
        list.forEach((sub) => seen.add(String(sub.id)))
      })
      return seen.size
    }
    // Fallback for default/non-managed categories.
    return (subcategoriesByParentName.get(normalizedName) || []).length
  }

  function childCountForTopLevelTile(tileName, topLevelRow) {
    if (topLevelRow?.id) {
      return (subcategoriesByParentId.get(String(topLevelRow.id)) || []).length
    }
    return childCountForCategoryName(tileName)
  }

  const topLevelRowByName = useMemo(() => {
    const map = new Map()
    customCategories.forEach((cat) => {
      if (cat?.parent) return
      const key = normalize(cat.name)
      if (!key || map.has(key)) return
      map.set(key, cat)
    })
    return map
  }, [customCategories])

  function openCategory(row, fallbackName = '') {
    const cleanName = (row?.name || fallbackName || '').trim()
    if (!cleanName) return
    setCategoryPath((prev) => {
      const last = prev[prev.length - 1]
      const nextNode = { id: row?.id ? String(row.id) : null, name: cleanName }
      if (
        last &&
        String(last.id || '') === String(nextNode.id || '') &&
        normalize(last.name) === normalize(nextNode.name)
      ) {
        return prev
      }
      return [...prev, nextNode]
    })
  }

  function openTopLevelCategory(row, fallbackName = '') {
    const clean = (row?.name || fallbackName || '').trim()
    if (!clean) return
    setCategoryPath([{ id: row?.id ? String(row.id) : null, name: clean }])
  }

  async function addCategory({ parentId = null, parentName = '' } = {}) {
    const raw = newCategory.trim()
    if (!raw) return
    const duplicate = customCategories.some((c) => {
      if (normalize(c.name) !== normalize(raw)) return false
      if (parentId) return String(c.parent || '') === String(parentId)
      const cParentName = normalize(c.parent_name || '')
      return !c.parent && cParentName === normalize(parentName)
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
      // POST response may omit derived fields like parent_name; enrich so UI can
      // immediately show the new node in sub-category tiles without refresh.
      const createdNormalized = {
        ...created,
        name: (created?.name || raw).trim(),
        parent: created?.parent ?? parentId ?? null,
        parent_name: (created?.parent_name || parentName || '').trim(),
      }
      setCustomCategories((prev) => [...prev, createdNormalized])
      if (!createdNormalized?.id) {
        // Some create responses may omit id fields; refresh to keep new folders editable.
        const latest = await fetchCategories()
        setCustomCategories(Array.isArray(latest) ? latest : [])
      }
      setNewCategory('')
      const createdId = createdNormalized?.id ? String(createdNormalized.id) : null
      const createdName = (createdNormalized?.name || raw).trim()
      if (parentId) {
        setCategoryPath((prev) => {
          if (prev[prev.length - 1] && String(prev[prev.length - 1].id || '') === String(parentId)) {
            return [...prev, { id: createdId, name: createdName }]
          }
          return [
            { id: String(parentId), name: parentName || selectedCategory || 'Category' },
            { id: createdId, name: createdName },
          ]
        })
      } else {
        setCategoryPath([{ id: createdId, name: createdName }])
      }
      toast.success(parentId ? 'Sub-category added' : 'Category added')
      return created
    } catch (e) {
      const errors = e?.response?.data?.errors
      const detail = errors?.detail || e?.response?.data?.detail
      const nameErr = errors?.name
      const parentErr = errors?.parent
      const msg =
        (Array.isArray(nameErr) ? nameErr[0] : nameErr) ||
        (Array.isArray(parentErr) ? parentErr[0] : parentErr) ||
        (Array.isArray(detail) ? detail[0] : detail) ||
        'Failed to add category'
      toast.error(msg)
      return null
    }
  }

  async function ensureParentCategory(parentName) {
    const cleanName = (parentName || '').trim()
    if (!cleanName) return null
    if (selectedCategory && normalize(selectedCategory) === normalize(cleanName) && selectedCategoryRow?.id) {
      return selectedCategoryRow
    }
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
      const errors = e?.response?.data?.errors
      const detail = errors?.detail || e?.response?.data?.detail
      const nameErr = errors?.name
      const msg =
        (Array.isArray(nameErr) ? nameErr[0] : nameErr) ||
        (Array.isArray(detail) ? detail[0] : detail) ||
        'Could not save parent category'
      toast.error(msg)
      return null
    }
  }

  async function resolveCurrentParentRow() {
    if (!selectedCategory) return null
    if (selectedCategoryRow?.id) return selectedCategoryRow
    return ensureParentCategory(selectedCategory)
  }

  function openEditModal(row) {
    if (!row?.id) {
      toast('Only managed categories can be edited')
      return
    }
    setEditingCategory(row)
    setEditName((row.name || '').trim())
    setEditColor(normalizeHexColor(row.color) || defaultHexColorForText(row.name))
    setEditModalOpen(true)
  }

  async function saveCategoryEdit() {
    if (!editingCategory?.id || savingEdit) return
    const cleanName = (editName || '').trim()
    const cleanColor = normalizeHexColor(editColor)
    if (!cleanName) {
      toast.error('Category name is required')
      return
    }
    if (!cleanColor) {
      toast.error('Pick a valid color')
      return
    }
    setSavingEdit(true)
    try {
      const { data } = await api.patch(`/medicine-categories/${editingCategory.id}/`, {
        name: cleanName,
        color: cleanColor,
      })
      const updated = data?.data || data?.entity || data || {}
      const nextName = (updated.name || cleanName).trim()
      const nextColor = normalizeHexColor(updated.color) || cleanColor
      setCustomCategories((prev) =>
        prev.map((c) =>
          String(c.id) === String(editingCategory.id)
            ? { ...c, ...updated, name: nextName, color: nextColor }
            : c,
        ),
      )
      setCategoryPath((prev) =>
        prev.map((node) =>
          String(node.id || '') === String(editingCategory.id)
            ? { ...node, id: String(editingCategory.id), name: nextName }
            : node,
        ),
      )
      setEditModalOpen(false)
      setEditingCategory(null)
      setActionMode('none')
      toast.success('Category updated')
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.errors?.detail || 'Failed to update category')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteCategoriesByIds(ids) {
    if (!ids?.length) return
    const selectedIdSet = new Set(ids.map(String))
    const rows = customCategories.filter((c) => selectedIdSet.has(String(c.id)))
    if (!rows.length) {
      toast('Only managed categories can be deleted')
      return
    }

    // Block parent deletion when it still has subcategories.
    const blockedParents = rows.filter((row) =>
      customCategories.some((c) => String(c.parent || '') === String(row.id)),
    )
    if (blockedParents.length > 0) {
      const sampleNames = blockedParents
        .slice(0, 3)
        .map((r) => r.name)
        .filter(Boolean)
        .join(', ')
      toast.error(
        blockedParents.length === 1
          ? `Delete sub-categories first for "${blockedParents[0].name}".`
          : `Delete sub-categories first for: ${sampleNames}${blockedParents.length > 3 ? '…' : ''}`,
      )
      return
    }

    const confirmed = window.confirm(
      rows.length === 1
        ? `Delete category "${rows[0].name}"?`
        : `Delete ${rows.length} categories?`,
    )
    if (!confirmed) return
    try {
      for (const r of rows) {
        // sequential keeps failures easy to reason about for users
        // eslint-disable-next-line no-await-in-loop
        await api.delete(`/medicine-categories/${r.id}/`)
      }

      const deletedSet = new Set([...selectedIdSet])
      setCustomCategories((prev) => prev.filter((c) => !deletedSet.has(String(c.id))))
      setCategoryPath((prev) => prev.filter((node) => !deletedSet.has(String(node.id || ''))))
      setDeleteSelection([])
      setActionMode('none')
      toast.success(rows.length === 1 ? `Deleted category: ${rows[0].name}` : `Deleted ${rows.length} categories`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.errors?.detail || 'Failed to delete category')
    }
  }

  function toggleDeleteSelection(row) {
    if (!row?.id) return
    const id = String(row.id)
    setDeleteSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleCategoryTileClick(name, row) {
    if (actionMode === 'edit') {
      openEditModal(row)
      setActionMode('none')
      return
    }
    if (actionMode === 'delete') {
      toggleDeleteSelection(row)
      return
    }
    openTopLevelCategory(row, name)
  }

  async function handleSubcategoryTileClick(sub) {
    if (actionMode === 'edit') {
      openEditModal(sub)
      setActionMode('none')
      return
    }
    if (actionMode === 'delete') {
      toggleDeleteSelection(sub)
      return
    }
    openCategory(sub)
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


  function toggleMedicineSelection(med) {
    const id = String(med?.id || '')
    if (!id) return
    setMedicineSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const visibleMedicineIds = useMemo(
    () => visibleMeds.map((m) => String(m.id)).filter(Boolean),
    [visibleMeds],
  )
  const allVisibleSelected = useMemo(() => {
    if (!visibleMedicineIds.length) return false
    const selected = new Set(medicineSelection.map(String))
    return visibleMedicineIds.every((id) => selected.has(id))
  }, [visibleMedicineIds, medicineSelection])
  const someVisibleSelected = useMemo(() => {
    if (!visibleMedicineIds.length) return false
    const selected = new Set(medicineSelection.map(String))
    return visibleMedicineIds.some((id) => selected.has(id)) && !allVisibleSelected
  }, [visibleMedicineIds, medicineSelection, allVisibleSelected])

  function toggleSelectAllVisibleMedicines() {
    setMedicineSelection((prev) => {
      const selected = new Set(prev.map(String))
      if (visibleMedicineIds.every((id) => selected.has(id))) {
        visibleMedicineIds.forEach((id) => selected.delete(id))
      } else {
        visibleMedicineIds.forEach((id) => selected.add(id))
      }
      return [...selected]
    })
  }

  async function deleteSelectedMedicines() {
    if (deletingMeds) return
    if (!medicineSelection.length) return
    const confirmed = window.confirm(
      medicineSelection.length === 1 ? 'Delete this medicine?' : `Delete ${medicineSelection.length} medicines?`,
    )
    if (!confirmed) return
    setDeletingMeds(true)
    const deletedIds = []
    const failedItems = []
    for (const id of medicineSelection) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await api.delete(`/medicines/${id}/`)
        deletedIds.push(String(id))
      } catch (e) {
        failedItems.push({
          id: String(id),
          message: parseApiErrorMessage(e, 'Failed to delete'),
          status: e?.response?.status,
        })
      }
    }
    if (deletedIds.length) {
      const deletedSet = new Set(deletedIds)
      setMedicines((prev) => prev.filter((m) => !deletedSet.has(String(m.id))))
    }
    if (failedItems.length) {
      setMedicineSelection(failedItems.map((x) => x.id))
      setActionMode('delete')
    } else {
      setMedicineSelection([])
      setActionMode('none')
    }
    if (deletedIds.length && !failedItems.length) {
      toast.success(deletedIds.length === 1 ? 'Medicine deleted' : `Deleted ${deletedIds.length} medicines`)
    } else if (deletedIds.length && failedItems.length) {
      const sample = failedItems[0]?.message || 'Some deletions failed'
      toast.error(`Deleted ${deletedIds.length}, failed ${failedItems.length}. ${sample}`)
    } else {
      const sample = failedItems[0]?.message || 'Failed to delete medicines'
      toast.error(`No medicines deleted. ${sample}`)
    }
    setDeletingMeds(false)
  }

  function openMoveMedicinesModal() {
    if (!medicineSelection.length) {
      toast('Select medicines first')
      return
    }
    if (selectedCategoryRow?.id) setMoveToCategory(`id:${selectedCategoryRow.id}`)
    else setMoveToCategory(`name:${selectedCategory || ''}`)
    setMoveModalOpen(true)
  }

  async function moveSelectedMedicines() {
    const targetRaw = (moveToCategory || '').trim()
    if (!targetRaw) {
      toast.error('Choose a category')
      return
    }
    let targetForm = ''
    let targetCategoryId = ''
    if (targetRaw.startsWith('id:')) {
      targetCategoryId = targetRaw.slice(3)
      const row = categoriesById.get(String(targetCategoryId))
      targetForm = (row?.name || '').trim()
    } else if (targetRaw.startsWith('name:')) {
      targetForm = targetRaw.slice(5).trim()
    } else {
      targetForm = targetRaw
    }
    if (!targetForm) {
      toast.error('Choose a valid category')
      return
    }
    if (moving) return
    setMoving(true)
    try {
      for (const id of medicineSelection) {
        // eslint-disable-next-line no-await-in-loop
        await api.patch(`/medicines/${id}/`, {
          form: targetForm,
          ...(targetCategoryId ? { category: targetCategoryId } : { category: null }),
        })
      }
      setMedicines((prev) =>
        prev.map((m) =>
          medicineSelection.includes(String(m.id))
            ? { ...m, form: targetForm, category: targetCategoryId || null }
            : m,
        ),
      )
      setMoveModalOpen(false)
      setMedicineSelection([])
      setActionMode('none')
      toast.success('Medicines moved')
    } catch (e) {
      toast.error(parseApiErrorMessage(e, 'Failed to move medicines'))
    } finally {
      setMoving(false)
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
            placeholder={selectedCategory ? `Add under ${selectedCategory}` : 'Add category'}
            className="px-3 py-1.5 text-sm rounded border border-slate-200 bg-white"
          />
          <button
            type="button"
            onClick={() => {
              setDeleteSelection([])
              if (selectedCategory) {
                // Inside a category: Edit applies to medicines (move/edit location).
                if (actionMode !== 'edit') {
                  setMedicineSelection([])
                  setActionMode('edit')
                  setMoveModalOpen(false)
                  return
                }
                openMoveMedicinesModal()
                return
              }
              setActionMode((m) => (m === 'edit' ? 'none' : 'edit'))
            }}
            className="px-2.5 py-1.5 rounded border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            title={selectedCategory ? 'Click then select medicines to edit location' : 'Click then choose folder to edit'}
          >
            <Pencil size={12} />{' '}
            {selectedCategory
              ? actionMode === 'edit'
                ? `Edit selected (${medicineSelection.length})`
                : 'Edit'
              : actionMode === 'edit'
                ? 'Pick folder...'
                : 'Edit'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedCategory) {
                // Inside a category: Delete applies to medicines.
                if (actionMode !== 'delete') {
                  setMedicineSelection([])
                  setActionMode('delete')
                  return
                }
                deleteSelectedMedicines()
                return
              }
              if (actionMode !== 'delete') {
                setActionMode('delete')
                setDeleteSelection([])
                return
              }
              deleteCategoriesByIds(deleteSelection)
            }}
            className="px-2.5 py-1.5 rounded border border-rose-200 text-xs font-semibold text-rose-700 inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-50"
            title={selectedCategory ? 'Click then select medicines to delete' : 'Click then tick folders to delete'}
          >
            <Trash2 size={12} />{' '}
            {selectedCategory
              ? actionMode === 'delete'
                ? `Delete selected (${medicineSelection.length})`
                : 'Delete'
              : actionMode === 'delete'
                ? `Delete selected (${deleteSelection.length})`
                : 'Delete'}
          </button>
          {actionMode === 'delete' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDeleteSelection([])
                  setMedicineSelection([])
                  setActionMode('none')
                  setMoveModalOpen(false)
                }}
                className="px-2.5 py-1.5 rounded border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1"
                title="Cancel delete selection"
              >
                <X size={12} /> Cancel
              </button>
            </>
          )}
          <button
            type="button"
            onClick={async () => {
              if (selectedCategory) {
                const parentRow = await resolveCurrentParentRow()
                if (!parentRow?.id) return
                await addCategory({ parentId: parentRow.id, parentName: parentRow.name })
                return
              }
              await addCategory()
            }}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-1"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {!selectedCategory ? (
        <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-xl bg-white p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-3 gap-y-2.5">
            {visibleCategories.map((cat) => {
              const count = medicineCountByForm.get(normalize(cat)) || 0
              const row = topLevelRowByName.get(normalize(cat))
              const css = colorForCategory(row || { name: cat })
              const childSubCount = childCountForTopLevelTile(cat, row)
              return (
                <CategoryBrowseTile
                  key={cat}
                  title={cat}
                  style={css}
                  size="lg"
                  onClick={() => handleCategoryTileClick(cat, row)}
                  selectable={actionMode === 'delete' && !!row?.id}
                  selected={!!row?.id && deleteSelection.includes(String(row.id))}
                  onSelect={() => toggleDeleteSelection(row)}
                  details={
                    <>
                      <div className="text-xs opacity-75 mt-1">{count} items</div>
                      {childSubCount > 0 && (
                        <div className="text-[11px] mt-1 opacity-80">{childSubCount} sub-categories</div>
                      )}
                    </>
                  }
                />
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
                  setCategoryPath((prev) => prev.slice(0, -1))
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
                  {categoryBreadcrumb}
                </span>
                {!!selectedCategoryRow?.parent_name && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Sub-category of {selectedCategoryRow.parent_name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
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
          </div>
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="text-[11px] font-semibold text-slate-600 mb-2">Sub-categories</div>
            {selectedSubcategories.length === 0 ? (
              <p className="text-xs text-slate-500 mb-2">No sub-categories yet.</p>
            ) : (
              <div className="max-h-[min(40vh,280px)] overflow-y-auto pr-1 -mr-1 mb-2">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-3 gap-y-2.5">
                  {selectedSubcategories.map((sub) => {
                    const subCount = medicineCountByForm.get(normalize(sub.name)) || 0
                    const childSubCount = subcategoriesByParentId.get(String(sub.id))?.length || 0
                    const css = colorForCategory(sub)
                    return (
                      <CategoryBrowseTile
                        key={sub.id}
                        title={sub.name}
                        style={css}
                        size="lg"
                        onClick={() => handleSubcategoryTileClick(sub)}
                        selectable={actionMode === 'delete'}
                        selected={deleteSelection.includes(String(sub.id))}
                        onSelect={() => toggleDeleteSelection(sub)}
                        details={
                          <>
                            <div className="text-xs opacity-75 mt-1">{subCount} items</div>
                            {childSubCount > 0 && (
                              <div className="text-[11px] mt-1 opacity-80">{childSubCount} sub-categories</div>
                            )}
                          </>
                        }
                      />
                    )
                  })}
                </div>
              </div>
            )}
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
                    {actionMode !== 'none' && (
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someVisibleSelected
                          }}
                          onChange={toggleSelectAllVisibleMedicines}
                          title={allVisibleSelected ? 'Unselect all' : 'Select all'}
                        />
                      </th>
                    )}
                    <th className="text-left px-3 py-2">Medicine</th>
                    <th className="text-left px-3 py-2 w-[110px]">Stock</th>
                    <th className="text-left px-3 py-2 w-[80px]">MRP</th>
                    <th className="text-left px-3 py-2 w-[80px]">Rate</th>
                    <th className="text-left px-3 py-2">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMeds.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                      {actionMode !== 'none' && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={medicineSelection.includes(String(m.id))}
                            onChange={() => toggleMedicineSelection(m)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{m.name}</div>
                        <div className="text-[11px] text-slate-400">{m.pack_info || ''}{m.hsn_code ? ` · HSN ${m.hsn_code}` : ''}</div>
                      </td>
                      {(() => {
                        const medBatches = batches.filter((b) => String(b.medicine) === String(m.id))
                        const totalStock = medBatches.reduce((s, b) => s + Number(b.quantity ?? 0), 0)
                        const topBatch = medBatches.sort((a, b2) => Number(b2.quantity ?? 0) - Number(a.quantity ?? 0))[0]
                        return (
                          <>
                            <td className="px-3 py-2 tabular-nums text-sm">
                              <span className={`font-semibold ${totalStock <= 0 ? 'text-rose-600' : totalStock < 10 ? 'text-amber-600' : 'text-slate-800'}`}>
                                {totalStock}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">units</span>
                            </td>
                            <td className="px-3 py-2 tabular-nums text-sm text-slate-600">
                              {topBatch ? `₹${Number(topBatch.mrp ?? 0).toFixed(2)}` : '—'}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-sm text-slate-600">
                              {topBatch ? `₹${Number(topBatch.sale_rate ?? 0).toFixed(2)}` : '—'}
                            </td>
                          </>
                        )
                      })()}
                      <td className="px-3 py-2 text-[11px] text-slate-600">
                        {(() => {
                          const catId = m.category ? String(m.category) : ''
                          const cat = catId ? categoriesById.get(catId) : null
                          if (!cat) return <span className="text-slate-400">—</span>
                          const parentCat = cat.parent ? categoriesById.get(String(cat.parent)) : null
                          return parentCat
                            ? <><span className="text-slate-400">{parentCat.name}</span> / <span className="font-medium">{cat.name}</span></>
                            : <span className="font-medium">{cat.name}</span>
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {moveModalOpen && (
        <div className="fixed inset-0 z-[330] bg-slate-900/45 flex items-center justify-center p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Move medicines</h3>
              <button
                type="button"
                onClick={() => {
                  if (moving) return
                  setMoveModalOpen(false)
                }}
                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="text-xs text-slate-600">
                Selected: <span className="font-bold text-slate-900">{medicineSelection.length}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-700">Move to category</span>
                <button
                  type="button"
                  onClick={() => setMoveCatPickerOpen(true)}
                  className="mt-1 w-full flex items-center justify-between gap-2 min-h-9 border border-slate-300 rounded px-2.5 text-sm text-left bg-white hover:bg-slate-50 outline-none focus:border-blue-500"
                >
                  <span className="truncate text-slate-800">{moveCatBreadcrumb || 'Browse categories…'}</span>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" style={{ transform: 'rotate(90deg)' }} />
                </button>
                {moveCatBreadcrumb && (
                  <button
                    type="button"
                    onClick={() => setMoveToCategory('')}
                    className="mt-0.5 text-[10px] text-rose-500 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (moving) return
                  setMoveModalOpen(false)
                }}
                className="px-3 py-1.5 rounded border border-slate-200 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={moveSelectedMedicines}
                disabled={moving}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {moving ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Category tree picker portal for Move modal */}
      {moveCatPickerOpen && createPortal(
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/45"
          onClick={() => setMoveCatPickerOpen(false)}
          role="presentation"
        >
          <div
            className="flex h-[min(85vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <h4 className="text-sm font-bold text-slate-900">Select category</h4>
              <button type="button" onClick={() => setMoveCatPickerOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="shrink-0 border-b border-slate-100 p-2">
              <input
                type="text"
                value={moveCatSearch}
                onChange={(e) => setMoveCatSearch(e.target.value)}
                placeholder="Search all names or browse lists below…"
                className="h-7 w-full rounded border border-slate-200 px-2 text-[11px]"
                autoFocus
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {moveCatSearch.trim() ? (
                moveCatFilteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] text-slate-500">No matches</div>
                ) : (
                  moveCatFilteredOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectMoveCatRow(treeIdToRow.get(opt.id))}
                      className="w-full border-b border-slate-50 px-3 py-1.5 text-left text-[11px] text-slate-800 last:border-b-0 hover:bg-slate-50"
                    >
                      <span className="block truncate" title={opt.label}>{opt.label}</span>
                    </button>
                  ))
                )
              ) : (
                <div className="flex flex-col gap-0">
                  {treeRoots.length > 0 && (
                    <>
                      <div className="px-3 pb-0.5 pt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Nested folders</div>
                      <CatTreeRows
                        nodes={treeRoots}
                        depth={0}
                        childrenOf={treeChildrenOf}
                        expandedIds={moveCatExpandedIds}
                        onToggle={toggleMoveCatExpand}
                        onSelect={selectMoveCatRow}
                      />
                      <div className="mx-2 my-2 border-t border-slate-100" />
                    </>
                  )}
                  <div className="px-3 pb-0.5 pt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    All category names (presets · medicines · folders)
                  </div>
                  {managedMoveCategoryOptions.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-500">No categories yet</div>
                  ) : (
                    managedMoveCategoryOptions.map((opt) => (
                      <button
                        key={`flat-${opt.id}`}
                        type="button"
                        onClick={() => selectMoveCatRow(treeIdToRow.get(opt.id))}
                        className="w-full border-b border-slate-50 px-3 py-1.5 text-left text-[11px] text-slate-800 last:border-b-0 hover:bg-slate-50"
                      >
                        <span className="block truncate" title={opt.label}>{opt.label}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {editModalOpen && (
        <div className="fixed inset-0 z-[320] bg-slate-900/45 flex items-center justify-center p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit category</h3>
              <button
                type="button"
                onClick={() => {
                  if (savingEdit) return
                  setEditModalOpen(false)
                  setEditingCategory(null)
                }}
                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Category name</span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full h-9 rounded border border-slate-300 px-2.5 text-sm outline-none focus:border-blue-500"
                  placeholder="Category name"
                  autoFocus
                />
              </label>
              <div className="flex items-end gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Folder color</span>
                  <input
                    type="color"
                    value={editColor || '#6366F1'}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="mt-1 h-9 w-12 rounded border border-slate-300 bg-white p-1 cursor-pointer"
                  />
                </label>
                <label className="block flex-1">
                  <span className="text-xs font-semibold text-slate-700">Hex</span>
                  <input
                    type="text"
                    value={editColor}
                    onChange={(e) => setEditColor((e.target.value || '').toUpperCase())}
                    maxLength={7}
                    placeholder="#6366F1"
                    className="mt-1 w-full h-9 rounded border border-slate-300 px-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (savingEdit) return
                  setEditModalOpen(false)
                  setEditingCategory(null)
                }}
                className="px-3 py-1.5 rounded border border-slate-200 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCategoryEdit}
                disabled={savingEdit}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default memo(PharmacyCategoriesView)

