import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function DischargeSuggestibleInput({
  value,
  onChange,
  suggestions = [],
  label,
  multiline = false,
  required = false,
  placeholder = '',
  className = '',
  rows = 2,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [menuRect, setMenuRect] = useState(null)
  const rootRef = useRef(null)
  const fieldRef = useRef(null)
  const menuRef = useRef(null)

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase()
    const list = (suggestions || []).filter(Boolean)
    if (!q) return list
    return list.filter((opt) => String(opt).toLowerCase().includes(q))
  }, [suggestions, value])

  const updateMenuRect = useCallback(() => {
    const el = fieldRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const maxHeight = 192
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow
    const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow)
    setMenuRect({
      top: openUp ? Math.max(8, rect.top - height - gap) : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(height, 80),
    })
  }, [])

  const openMenu = useCallback(() => {
    if (!(suggestions || []).length) return
    setOpen(true)
    setHighlightedIndex(0)
    updateMenuRect()
  }, [suggestions, updateMenuRect])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setHighlightedIndex(-1)
  }, [])

  const selectOption = useCallback((opt) => {
    onChange(opt)
    closeMenu()
  }, [onChange, closeMenu])

  useLayoutEffect(() => {
    if (!open) return undefined
    updateMenuRect()
    const onScrollOrResize = () => updateMenuRect()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updateMenuRect, filtered.length, value])

  useEffect(() => {
    function handleOutsideClick(e) {
      const target = e.target
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [closeMenu])

  const handleKeyDown = (e) => {
    if (!(suggestions || []).length) return
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault()
      openMenu()
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        Math.min((prev < 0 ? 0 : prev + 1), Math.max(filtered.length - 1, 0))
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max((prev < 0 ? 0 : prev - 1), 0))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      const pick = filtered[highlightedIndex >= 0 ? highlightedIndex : 0]
      if (pick) selectOption(pick)
    }
  }

  const menu = open && (suggestions || []).length > 0 && menuRect
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[700] rounded-xl border border-gray-200 bg-white shadow-xl overflow-auto"
          style={{
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            maxHeight: menuRect.maxHeight,
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((opt, idx) => (
              <button
                key={`${opt}-${idx}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectOption(opt)
                }}
                className={`w-full text-left px-3 py-2 border-b last:border-b-0 border-gray-100 text-sm whitespace-pre-wrap break-words ${
                  idx === highlightedIndex ? 'bg-emerald-50' : 'hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500">
              No matching suggestion — continue typing your own text
            </div>
          )}
        </div>,
        document.body
      )
    : null

  return (
    <div ref={rootRef} className="relative min-w-0">
      {label ? (
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
          {label}
        </span>
      ) : null}
      {multiline ? (
        <textarea
          ref={fieldRef}
          id={id}
          value={value ?? ''}
          onChange={(e) => {
            onChange(e.target.value)
            openMenu()
          }}
          onFocus={openMenu}
          onClick={openMenu}
          onKeyDown={handleKeyDown}
          required={required}
          placeholder={placeholder}
          rows={rows}
          className={`${className} min-h-[52px]`}
        />
      ) : (
        <input
          ref={fieldRef}
          id={id}
          value={value ?? ''}
          onChange={(e) => {
            onChange(e.target.value)
            openMenu()
          }}
          onFocus={openMenu}
          onClick={openMenu}
          onKeyDown={handleKeyDown}
          required={required}
          placeholder={placeholder}
          className={className}
        />
      )}
      {menu}
    </div>
  )
}
