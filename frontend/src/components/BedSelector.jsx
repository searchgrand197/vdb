import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { getBedDisplayLabel } from '../utils/bedDisplay'
import {
  ChevronUp, ChevronDown, Wind, Fan, Bed, X, CheckCircle,
  AlertTriangle, Wrench, Clock, Sparkles, Shield, Home, Users,
} from 'lucide-react'

// ─── Bed SVG (top-down portrait view) ────────────────────────────────────────
function BedSVG({ status, selected }) {
  // viewBox: 60 wide × 88 tall  (portrait — head at top, feet at bottom)
  const vw = 48, vh = 70

  // colour palette per status
  const palette = {
    available:   { frame: '#15803d', wood: '#166534', mattress: '#f0fdf4', sheet: '#bbf7d0', sheetDark: '#86efac' },
    occupied:    { frame: '#b91c1c', wood: '#991b1b', mattress: '#fff1f2', sheet: '#fecaca', sheetDark: '#fca5a5' },
    reserved:    { frame: '#b45309', wood: '#92400e', mattress: '#fffbeb', sheet: '#fde68a', sheetDark: '#fcd34d' },
    maintenance: { frame: '#4b5563', wood: '#374151', mattress: '#f9fafb', sheet: '#e5e7eb', sheetDark: '#d1d5db' },
    cleaning:    { frame: '#0e7490', wood: '#155e75', mattress: '#ecfeff', sheet: '#a5f3fc', sheetDark: '#67e8f9' },
  }
  const sel = {                    frame: '#1d4ed8', wood: '#1e3a8a', mattress: '#eff6ff', sheet: '#bfdbfe', sheetDark: '#93c5fd' }
  const c = selected ? sel : (palette[status] || palette.available)

  return (
    <svg viewBox="0 0 60 88" width={vw} height={vh} xmlns="http://www.w3.org/2000/svg">

      {/* ── Bed frame outer shadow ── */}
      <rect x="5" y="5" width="50" height="78" rx="6" fill={c.wood} opacity="0.25" />

      {/* ── Bed frame (wood) ── */}
      <rect x="4" y="4" width="52" height="76" rx="6" fill={c.wood} />

      {/* ── Mattress ── */}
      <rect x="8" y="8" width="44" height="68" rx="4" fill={c.mattress} />

      {/* ── Headboard panel (top) ── */}
      <rect x="4" y="4"  width="52" height="14" rx="6" fill={c.wood} />
      <rect x="7" y="6"  width="46" height="10" rx="4" fill={c.frame} opacity="0.6" />

      {/* ── Footboard panel (bottom) ── */}
      <rect x="4"  y="66" width="52" height="14" rx="6" fill={c.wood} />
      <rect x="7"  y="68" width="46" height="10" rx="4" fill={c.frame} opacity="0.4" />

      {/* ── Mattress stitch lines ── */}
      <line x1="8"  y1="36" x2="52" y2="36" stroke={c.sheetDark} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
      <line x1="8"  y1="50" x2="52" y2="50" stroke={c.sheetDark} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />

      {/* ══════════════════════════════════════
          AVAILABLE — neat empty bed
         ══════════════════════════════════════ */}
      {(status === 'available' || status === undefined) && (
        <g>
          {/* Pillow */}
          <rect x="13" y="18" width="34" height="14" rx="5" fill="white" stroke={c.sheetDark} strokeWidth="1" />
          <line x1="20" y1="22" x2="40" y2="22" stroke={c.sheetDark} strokeWidth="0.6" opacity="0.5" />
          <line x1="20" y1="26" x2="40" y2="26" stroke={c.sheetDark} strokeWidth="0.6" opacity="0.5" />
          {/* Sheet fold at top of blanket */}
          <rect x="9" y="34" width="42" height="30" rx="3" fill={c.sheet} />
          <rect x="9" y="34" width="42" height="7"  rx="3" fill={c.sheetDark} opacity="0.7" />
          {/* Blanket texture lines */}
          <line x1="9" y1="46" x2="51" y2="46" stroke={c.sheetDark} strokeWidth="0.7" opacity="0.4" />
          <line x1="9" y1="54" x2="51" y2="54" stroke={c.sheetDark} strokeWidth="0.7" opacity="0.4" />
        </g>
      )}

      {/* ══════════════════════════════════════
          OCCUPIED — person lying in bed
         ══════════════════════════════════════ */}
      {status === 'occupied' && (
        <g>
          {/* Blanket/sheet covering body */}
          <rect x="9" y="36" width="42" height="28" rx="3" fill={c.sheet} />
          {/* Blanket fold at top */}
          <rect x="9" y="36" width="42" height="7" rx="3" fill={c.sheetDark} />

          {/* Body under blanket — subtle bump shape */}
          <ellipse cx="30" cy="53" rx="14" ry="7"  fill={c.sheetDark} opacity="0.45" />

          {/* LEFT ARM on top of blanket */}
          <rect x="10" y="43" width="16" height="6" rx="3" fill="#fbbf24" />
          {/* Right arm hint */}
          <rect x="34" y="43" width="16" height="6" rx="3" fill="#fbbf24" opacity="0.7" />

          {/* ─ Pillow ─ */}
          <rect x="11" y="17" width="38" height="16" rx="5" fill="white" stroke={c.sheetDark} strokeWidth="1" />
          {/* pillow crease */}
          <line x1="18" y1="22" x2="42" y2="22" stroke={c.sheetDark} strokeWidth="0.8" opacity="0.5" />

          {/* ─ NECK ─ */}
          <rect x="25" y="31" width="10" height="7" rx="3" fill="#fbbf24" />

          {/* ─ HEAD ─ (skin tone circle) */}
          <ellipse cx="30" cy="26" rx="11" ry="11" fill="#fbbf24" />

          {/* Hair cap */}
          <path d="M 19 22 Q 30 10 41 22 Q 36 15 30 14 Q 24 15 19 22 Z" fill="#92400e" />

          {/* Eyes (closed — sleeping) */}
          <path d="M 25 25 Q 27 23.5 29 25" stroke="#78350f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M 31 25 Q 33 23.5 35 25" stroke="#78350f" strokeWidth="1.2" fill="none" strokeLinecap="round" />

          {/* Nose */}
          <ellipse cx="30" cy="28" rx="1.5" ry="1" fill="#e8a020" opacity="0.7" />

          {/* Mouth (slight smile) */}
          <path d="M 27 31 Q 30 33 33 31" stroke="#c07820" strokeWidth="1" fill="none" strokeLinecap="round" />

          {/* Ear left */}
          <ellipse cx="19" cy="27" rx="2.5" ry="3.5" fill="#fbbf24" />
          {/* Ear right */}
          <ellipse cx="41" cy="27" rx="2.5" ry="3.5" fill="#fbbf24" />
        </g>
      )}

      {/* ══════════════════════════════════════
          RESERVED — made bed, name tag
         ══════════════════════════════════════ */}
      {status === 'reserved' && (
        <g>
          {/* Pillow */}
          <rect x="13" y="18" width="34" height="14" rx="5" fill="white" stroke={c.sheetDark} strokeWidth="1" />
          {/* Sheet */}
          <rect x="9"  y="34" width="42" height="30" rx="3" fill={c.sheet} />
          <rect x="9"  y="34" width="42" height="7"  rx="3" fill={c.sheetDark} opacity="0.8" />
          {/* RESERVED label tag */}
          <rect x="15" y="46" width="30" height="12" rx="4" fill={c.frame} />
          <text x="30" y="55.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="white">RESERVED</text>
        </g>
      )}

      {/* ══════════════════════════════════════
          MAINTENANCE
         ══════════════════════════════════════ */}
      {status === 'maintenance' && (
        <g>
          <rect x="13" y="18" width="34" height="14" rx="5" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
          <rect x="9"  y="34" width="42" height="30" rx="3" fill={c.sheet} />
          <rect x="9"  y="34" width="42" height="7"  rx="3" fill={c.sheetDark} />
          {/* Diagonal hazard stripes */}
          <clipPath id="maint-clip"><rect x="9" y="34" width="42" height="30" rx="3" /></clipPath>
          <g clipPath="url(#maint-clip)" opacity="0.25">
            {[0,8,16,24,32,40,48].map(i => (
              <line key={i} x1={9+i} y1="34" x2={9+i+10} y2="64" stroke="#374151" strokeWidth="3" />
            ))}
          </g>
          {/* Wrench symbol */}
          <text x="30" y="56" textAnchor="middle" fontSize="18">🔧</text>
        </g>
      )}

      {/* ══════════════════════════════════════
          CLEANING
         ══════════════════════════════════════ */}
      {status === 'cleaning' && (
        <g>
          <rect x="13" y="18" width="34" height="14" rx="5" fill="white" stroke={c.sheetDark} strokeWidth="1" />
          <rect x="9"  y="34" width="42" height="30" rx="3" fill={c.sheet} />
          <rect x="9"  y="34" width="42" height="7"  rx="3" fill={c.sheetDark} />
          <text x="30" y="56" textAnchor="middle" fontSize="18">🧹</text>
        </g>
      )}

      {/* ── Selected highlight ring ── */}
      {selected && (
        <rect x="2" y="2" width="56" height="84" rx="8"
          fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="5 3" opacity="0.8" />
      )}
    </svg>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOM_TYPE_META = {
  ward: {
    label: 'Ward',
    icon: Users,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    iconColor: 'text-blue-500',
    headerGrad: 'from-blue-50 to-blue-100',
  },
  shared: {
    label: 'Shared Room',
    icon: Home,
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    iconColor: 'text-purple-500',
    headerGrad: 'from-purple-50 to-purple-100',
  },
  personal: {
    label: 'Personal Room',
    icon: Shield,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    iconColor: 'text-emerald-500',
    headerGrad: 'from-emerald-50 to-emerald-100',
  },
  icu: {
    label: 'ICU',
    icon: Sparkles,
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    iconColor: 'text-red-500',
    headerGrad: 'from-red-50 to-red-100',
  },
  emergency: {
    label: 'Emergency',
    icon: AlertTriangle,
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    iconColor: 'text-orange-500',
    headerGrad: 'from-orange-50 to-orange-100',
  },
}

const BED_STATUS_META = {
  available:   { label: 'Available',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50'  },
  occupied:    { label: 'Occupied',    dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'      },
  reserved:    { label: 'Reserved',    dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50'    },
  maintenance: { label: 'Maintenance', dot: 'bg-gray-400',    text: 'text-gray-600',    bg: 'bg-gray-100'    },
  cleaning:    { label: 'Cleaning',    dot: 'bg-cyan-400',    text: 'text-cyan-700',    bg: 'bg-cyan-50'     },
}

// ─── BedSelector Modal ────────────────────────────────────────────────────────
export default function BedSelector({ onSelect, onClose, zIndexClass = 'z-50', labelMode: labelModeProp }) {
  const [floors, setFloors] = useState([])
  const [loading, setLoading] = useState(true)
  const [labelMode, setLabelMode] = useState(labelModeProp || 'bed_code')
  const [floorIdx, setFloorIdx] = useState(0)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedBed, setSelectedBed] = useState(null)
  const [filter, setFilter] = useState('all')
  const [tooltip, setTooltip] = useState(null) // { x, y, bed, room }
  const [showFastClean, setShowFastClean] = useState(false)
  const [housekeepers, setHousekeepers] = useState([])
  const [fastCleanBedId, setFastCleanBedId] = useState('')
  const [fastStaffId, setFastStaffId] = useState('')
  const [fastNotes, setFastNotes] = useState('')
  const [fastSaving, setFastSaving] = useState(false)

  useEffect(() => {
    if (labelModeProp) {
      setLabelMode(labelModeProp === 'bed_number' ? 'bed_number' : 'bed_code')
      return
    }
    api.get('/settings/reception-portal/')
      .then(({ data }) => {
        const row = data?.data || data || {}
        setLabelMode(row.admission_bed_label_mode === 'bed_number' ? 'bed_number' : 'bed_code')
      })
      .catch(() => {})
  }, [labelModeProp])

  useEffect(() => {
    api.get('/beds/beds/by-floor/')
      .then(({ data }) => {
        const fl = data?.data || data || []
        setFloors(Array.isArray(fl) ? fl : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!showFastClean) return
    api.get('/beds/beds/housekeeping-on-duty/')
      .then(({ data }) => setHousekeepers(data?.data || []))
      .catch(() => setHousekeepers([]))
  }, [showFastClean])

  const floor = floors[floorIdx] || null
  const rooms = floor?.rooms || []
  const cleaningBeds = floors.flatMap(fl =>
    (fl.rooms || []).flatMap(r => (r.beds || [])
      .filter(b => b.status === 'cleaning')
      .map(b => ({ ...b, room_name: r.name, floor_name: fl.name })))
  )

  // Filter rooms on current floor
  const filteredRooms = rooms.filter(r => {
    if (filter === 'available') return r.available_bed_count > 0
    if (['ward', 'shared', 'personal', 'icu', 'emergency'].includes(filter)) return r.room_type === filter
    return true
  })

  function floorUp()   { if (floorIdx < floors.length - 1) { setFloorIdx(i => i + 1); setSelectedRoom(null); setSelectedBed(null) } }
  function floorDown() { if (floorIdx > 0) { setFloorIdx(i => i - 1); setSelectedRoom(null); setSelectedBed(null) } }

  function pickBed(bed, room) {
    if (bed.status !== 'available') return
    setSelectedBed(bed)
    setSelectedRoom(room)
  }

  function confirmSelection() {
    if (!selectedBed || !selectedRoom) return
    onSelect({
      bed_id: selectedBed.id,
      bed_code: selectedBed.bed_code,
      bed_number: selectedBed.bed_number,
      room_id: selectedRoom.id,
      room_name: selectedRoom.name,
      room_type: selectedRoom.room_type,
      floor_name: floor.name,
      floor_number: floor.floor_number,
      is_ac: selectedRoom.is_ac,
      daily_charge: selectedRoom.daily_charge,
      ward_name: selectedRoom.name,
    })
    onClose()
  }

  async function handleFastClean(markAvailable) {
    if (!fastCleanBedId) return
    setFastSaving(true)
    try {
      await api.post(`/beds/beds/${fastCleanBedId}/fast-clean/`, {
        staff_id: fastStaffId || null,
        mark_available: markAvailable,
        notes: fastNotes,
      })
      const { data } = await api.get('/beds/beds/by-floor/')
      const fl = data?.data || data || []
      setFloors(Array.isArray(fl) ? fl : [])
      setFastNotes('')
      if (markAvailable) setFastCleanBedId('')
    } finally {
      setFastSaving(false)
    }
  }

  const totalAvailable = floors.reduce((s, f) => s + (f.available_beds || 0), 0)
  const floorAvail = floor?.available_beds || 0

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center ${zIndexClass} p-2`} onMouseLeave={() => setTooltip(null)}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Bed size={18} />
            <div>
              <h2 className="text-base font-bold leading-tight">Bed Selection</h2>
              <p className="text-xs text-blue-200">{totalAvailable} beds available · {floors.length} floors</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFastClean(true)}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-bold flex items-center gap-1.5"
            >
              <Wrench size={12} /> Fast Clean
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
              <X size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading floor plan…</div>
        ) : floors.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No floors configured. Run seed_beds in backend.</div>
        ) : (
          <div className="flex flex-1 overflow-hidden">

            {/* Left: Floor navigator */}
            <div className="w-44 bg-gray-50 border-r border-gray-100 flex flex-col shrink-0">
              {/* Up/Down controls */}
              <div className="p-2 border-b border-gray-100 flex gap-1.5">
                <button onClick={floorUp} disabled={floorIdx >= floors.length - 1}
                  className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 rounded-lg py-1.5 text-xs font-semibold text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-30 transition-all">
                  <ChevronUp size={13} /> Up
                </button>
                <button onClick={floorDown} disabled={floorIdx <= 0}
                  className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 rounded-lg py-1.5 text-xs font-semibold text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-30 transition-all">
                  <ChevronDown size={13} /> Down
                </button>
              </div>

              {/* Floor list */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                {[...floors].reverse().map((fl, ri) => {
                  const actualIdx = floors.length - 1 - ri
                  const isActive = actualIdx === floorIdx
                  return (
                    <button key={fl.id} onClick={() => { setFloorIdx(actualIdx); setSelectedRoom(null); setSelectedBed(null) }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-100'
                      }`}>
                      <p className="font-bold text-xs leading-tight">{fl.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-semibold ${isActive ? 'text-blue-200' : 'text-emerald-600'}`}>
                          {fl.available_beds} free
                        </span>
                        <span className={`text-[11px] ${isActive ? 'text-blue-300' : 'text-gray-400'}`}>
                          / {fl.total_beds}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: Rooms + Beds */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Floor banner + filters (single compact row) */}
              <div className="px-4 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-gray-800 text-sm">{floor?.name}</span>
                  <span className="text-[11px] text-gray-400">{floorAvail} free · {(floor?.total_beds || 0) - floorAvail} occupied</span>
                </div>
                {/* Filter chips */}
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {[['all', 'All'], ['available', 'Free'], ['ward', 'Ward'], ['shared', 'Shared'], ['personal', 'Personal'], ['icu', 'ICU']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setFilter(val)}
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold transition-all ${
                        filter === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-blue-50'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room grid */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {filteredRooms.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No rooms match the filter on this floor.</div>
                ) : (
                <div className="flex flex-wrap gap-2.5 content-start">
                {filteredRooms.map((room) => {
                  const spanFull = (room.beds || []).length > 6
                  const meta = ROOM_TYPE_META[room.room_type] || ROOM_TYPE_META.ward
                  const RoomIcon = meta.icon
                  const isRoomSelected = selectedRoom?.id === room.id
                  const beds = room.beds || []

                  return (
                    <div key={room.id}
                      style={spanFull ? { width: '100%' } : {}}
                      className={`rounded-xl border-2 transition-all inline-flex flex-col ${isRoomSelected ? 'border-blue-400 shadow-md' : meta.border}`}>

                      {/* Room header — just name + type icon */}
                      <div className={`px-2.5 py-1 bg-gradient-to-r ${meta.headerGrad} rounded-t-xl flex items-center gap-1.5`}>
                        <RoomIcon size={12} className={`${meta.iconColor} shrink-0`} />
                        <span className="font-bold text-gray-800 text-xs leading-none truncate">{room.name}</span>
                      </div>

                      {/* Bed grid */}
                      <div className="px-2 py-1.5 flex flex-wrap gap-1.5">
                        {beds.map(bed => {
                          const bm = BED_STATUS_META[bed.status] || BED_STATUS_META.available
                          const isSelected = selectedBed?.id === bed.id
                          const canPick = bed.status === 'available'
                          const bedLabel = getBedDisplayLabel(bed, labelMode)
                          const tooltipLines = [
                            bedLabel,
                            bm.label,
                            `${room.name} · ${meta.label}`,
                            room.room_number ? `#${room.room_number}` : null,
                            room.is_ac ? 'AC' : 'Fan',
                            `₹${Number(room.daily_charge).toLocaleString()}/day`,
                            `${room.available_bed_count}/${room.total_bed_count} free`,
                          ].filter(Boolean).join('\n')

                          return (
                            <button
                              key={bed.id}
                              onClick={() => pickBed(bed, room)}
                              disabled={!canPick}
                              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, bed, room, meta, bm, canPick })}
                              onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                              onMouseLeave={() => setTooltip(null)}
                              className={`
                                relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl border-2 transition-all duration-150
                                ${isSelected
                                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-200 scale-105 z-10'
                                  : canPick
                                    ? 'border-emerald-200 bg-white hover:border-emerald-400 hover:shadow-md hover:scale-105 cursor-pointer'
                                    : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-70'
                                }
                              `}
                            >
                              <BedSVG status={bed.status} selected={isSelected} />
                              <span className={`text-[10px] font-bold leading-none ${
                                isSelected ? 'text-blue-700' : canPick ? 'text-emerald-700' : bm.text
                              }`}>
                                {bedLabel}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold leading-none ${
                                isSelected ? 'bg-blue-600 text-white' : `${bm.bg} ${bm.text}`
                              }`}>
                                {isSelected ? '✓' : bm.label}
                              </span>
                              {isSelected && (
                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                                  <CheckCircle size={11} className="text-white" />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fixed tooltip — rendered outside scroll containers */}
        {tooltip && (
          <div
            className="pointer-events-none fixed z-[9999] transform -translate-x-1/2"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2.5 shadow-2xl border border-gray-700 whitespace-nowrap min-w-max">
              <p className="font-bold text-[12px] text-white mb-1">{getBedDisplayLabel(tooltip.bed, labelMode)}</p>
              <p className="text-gray-300">{tooltip.room.name} · {tooltip.meta.label}</p>
              {tooltip.room.room_number && <p className="text-gray-400 text-[10px]">Room #{tooltip.room.room_number}</p>}
              <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-gray-700">
                <span className={`font-semibold ${tooltip.canPick ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tooltip.bm.label}
                </span>
                {tooltip.room.is_ac
                  ? <span className="text-cyan-400">❄ AC</span>
                  : <span className="text-gray-400">Fan</span>
                }
                <span className="text-emerald-400 font-bold ml-1">₹{Number(tooltip.room.daily_charge).toLocaleString()}/day</span>
              </div>
              <p className="text-gray-400 text-[10px] mt-0.5">{tooltip.room.available_bed_count}/{tooltip.room.total_bed_count} beds free</p>
            </div>
            <div className="w-2.5 h-2.5 bg-gray-900 border-r border-b border-gray-700 rotate-45 mx-auto -mt-1.5" />
          </div>
        )}

        {/* Footer: selection summary + confirm */}
        <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-3 bg-gray-50 shrink-0">
          {selectedBed && selectedRoom ? (
            <div className="flex-1 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Bed size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 leading-none">
                  {getBedDisplayLabel(selectedBed, labelMode)} · {selectedRoom.name}
                  {selectedRoom.is_ac && <span className="ml-1.5 text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-semibold"><Wind size={8} className="inline" /> AC</span>}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {floor?.name} · {ROOM_TYPE_META[selectedRoom.room_type]?.label} ·{' '}
                  <span className="text-emerald-600 font-semibold">₹{Number(selectedRoom.daily_charge).toLocaleString()}/day</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="flex-1 text-xs text-gray-400 italic">Click on a green bed to select it</p>
          )}

          <button onClick={onClose}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100 font-medium">
            Cancel
          </button>
          <button onClick={confirmSelection} disabled={!selectedBed}
            className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            <CheckCircle size={13} /> Confirm Bed
          </button>
        </div>
      </div>

      {showFastClean && (
        <div className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Wrench size={14} /> Fast Cleaning Desk</h3>
              <button onClick={() => setShowFastClean(false)} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X size={13} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500">Cleaning Bed</label>
                <select value={fastCleanBedId} onChange={e => setFastCleanBedId(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select cleaning bed...</option>
                  {cleaningBeds.map(b => (
                    <option key={b.id} value={b.id}>{getBedDisplayLabel(b, labelMode)} · {b.room_name} · {b.floor_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500">Assign to Staff (on duty)</label>
                <select value={fastStaffId} onChange={e => setFastStaffId(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Auto-pick / keep current</option>
                  {housekeepers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.employee_code ? ` (${s.employee_code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500">Reception Note</label>
                <textarea value={fastNotes} onChange={e => setFastNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Urgent bed turnover requested..." />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  disabled={fastSaving || !fastCleanBedId}
                  onClick={() => handleFastClean(false)}
                  className="flex-1 py-2 rounded-lg border border-cyan-300 bg-cyan-50 text-cyan-700 font-semibold text-sm disabled:opacity-40"
                >
                  Assign / Reassign Task
                </button>
                <button
                  disabled={fastSaving || !fastCleanBedId}
                  onClick={() => handleFastClean(true)}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm disabled:opacity-40"
                >
                  Mark Available Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
