import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { formatDateTime, formatTime, useTimeDisplayMode } from '../utils/dateTimeFormat'
import { format } from 'date-fns'
import api from '../api'
import { Clock3, Stethoscope, UserRound } from 'lucide-react'
import { getRoomsConfig, DEFAULT_ROOMS, getTvGroupsConfig } from '../utils/rooms'

function getRoomMap() {
  const rooms = getRoomsConfig()
  const fallback = DEFAULT_ROOMS
  const source = Array.isArray(rooms) && rooms.length ? rooms : fallback
  return source.reduce((acc, r, idx) => {
    acc[r.code] = { ...r, color: idx % 3 === 0 ? 'from-blue-900 to-blue-700' : idx % 3 === 1 ? 'from-emerald-900 to-emerald-700' : 'from-purple-900 to-purple-700' }
    return acc
  }, {})
}

export default function TVDisplay() {
  useTimeDisplayMode()
  const { roomCode } = useParams()
  const [roomMap, setRoomMap] = useState(getRoomMap())
  const tvGroups = getTvGroupsConfig(Object.values(roomMap))
  const matchedTv = tvGroups.find(g => g.id === roomCode)
  const selectedCodes = matchedTv
    ? [matchedTv.left_room, matchedTv.right_room].filter(Boolean)
    : String(roomCode || '').split('+').filter(Boolean)
  const selectedRooms = selectedCodes.map(code => ({ ...roomMap[code], code })).filter(Boolean)
  const room = selectedRooms[0] || roomMap[roomCode] || { label: 'OPD', prefix: '', color: 'from-gray-900 to-gray-700' }
  const roomTitle = matchedTv?.name || (selectedRooms.length > 1
    ? `Combined TV: ${selectedRooms.map(r => r.label).join(' + ')}`
    : room.label)
  const [boardData, setBoardData] = useState([])
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setRoomMap(getRoomMap()), 3000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetchTokens()
    const interval = setInterval(fetchTokens, 5000)
    return () => clearInterval(interval)
  }, [roomCode, roomMap])

  async function fetchTokens() {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const [v, d] = await Promise.all([
        api.get(`/opd-visits/?visit_date=${today}&limit=1000`),
        api.get('/doctor-profiles/'),
      ])
      const visits = v.data?.data || v.data?.results || v.data
      const docs = d.data?.data || d.data?.results || d.data || []
      const safeDocs = Array.isArray(docs) ? docs : []
      const allRooms = Object.values(roomMap)
      const normalizeId = (value) => (value == null ? '' : String(value))
      const roomCodeByDoctorUser = new Map(
        allRooms
          .filter((rm) => rm?.code)
          .map((rm) => [normalizeId(rm.doctor_user), rm.code])
          .filter(([doctorUser]) => doctorUser),
      )

      const withRooms = safeDocs.map((doc, idx) => {
        const doctorUser = normalizeId(doc.user || doc.id)
        const assignedCode = roomCodeByDoctorUser.get(doctorUser)
        return {
          ...doc,
          room_code: assignedCode || allRooms[idx % allRooms.length]?.code,
        }
      })
      const rows = (Array.isArray(visits) ? visits : []).map(vis => {
        const doctorUser = normalizeId(vis.doctor_user)
        const doc = withRooms.find(x => normalizeId(x.user || x.id) === doctorUser)
        return { ...vis, room_code: vis.room_code || doc?.room_code }
      })
      const renderRooms = selectedRooms.length ? selectedRooms : [room]
      const perRoom = renderRooms.map((rm) => {
        const roomRows = rows.filter(r => r.room_code === rm.code)
        const current = roomRows
          .filter(v => v.status === 'in_progress' || v.status === 'in_consultation')
          .sort((a, b) => (a.token_number || 0) - (b.token_number || 0))[0] || null
        const queue = roomRows
          .filter(v => v.status === 'waiting')
          .sort((a, b) => (a.token_number || 0) - (b.token_number || 0))
        const slabs = [
          ...(current ? [{ ...current, __serving: true }] : []),
          ...queue.map(q => ({ ...q, __serving: false })),
        ].slice(0, 10)
        return { room: rm, current, queue, slabs }
      })
      setBoardData(perRoom)
    } catch {
      // Silently retry
    }
  }

  const renderData = boardData.length ? boardData : [{ room, current: null, queue: [] }]
  const renderPanels = renderData.slice(0, 2)
  const isSinglePanel = renderPanels.length === 1
  const servingTone = ['from-emerald-500 via-green-500 to-emerald-600', 'from-rose-500 via-red-500 to-rose-600']

  return (
    <div className="h-screen bg-[#f5f7fb] text-slate-900 overflow-hidden">
      <header className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <h1 className="text-3xl font-black tracking-tight">{roomTitle}</h1>
        <div className="text-right">
          <p className="text-4xl font-black tabular-nums leading-none">{formatTime(time)}</p>
          <p className="text-xs text-slate-500 font-semibold">{format(time, 'dd MMM yyyy')}</p>
        </div>
      </header>

      <main className={`h-[calc(100vh-64px)] ${isSinglePanel ? 'grid grid-cols-1' : 'grid grid-cols-2'}`}>
        {renderPanels.map(({ room: rm, current, queue = [] }, panelIndex) => {
          const circles = queue.slice(0, isSinglePanel ? 20 : 10)

          return (
            <section
              key={rm.code}
              className={`relative px-6 ${isSinglePanel ? 'py-6' : 'py-5'} ${panelIndex === 0 && !isSinglePanel ? 'border-r-4 border-slate-900' : ''}`}
            >
              <div className={`flex items-center ${isSinglePanel ? 'justify-center gap-5 pb-4' : 'justify-between pb-4'} border-b border-slate-700`}>
                <h2 className={`${isSinglePanel ? 'text-5xl text-center' : 'text-5xl'} font-black tracking-tight leading-tight`}>{rm.label}</h2>
                <div className={`${isSinglePanel ? 'w-20 h-20' : 'w-20 h-20'} rounded-full border-2 border-amber-300 bg-amber-50 flex items-center justify-center shrink-0 ${isSinglePanel ? '' : 'ml-4'}`}>
                  <UserRound size={44} className="text-amber-500" />
                </div>
              </div>

              <div className={`flex items-center justify-center ${isSinglePanel ? 'mt-7 gap-10' : 'mt-4 gap-10'}`}>
                <div className={`${isSinglePanel ? 'w-44 h-44' : 'w-40 h-40'} rounded-full bg-gradient-to-br ${servingTone[panelIndex % servingTone.length]} shadow-[inset_0_2px_10px_rgba(255,255,255,0.35),0_8px_22px_rgba(0,0,0,0.14)] flex items-center justify-center shrink-0`}>
                  <span className={`${isSinglePanel ? 'text-7xl' : 'text-7xl'} font-black text-white leading-none`}>
                    {current ? `${rm.prefix}${current.token_number}` : '--'}
                  </span>
                </div>
                <div className={`${isSinglePanel ? 'text-5xl max-w-[440px]' : 'text-5xl max-w-[260px]'} font-bold text-slate-900 leading-tight truncate`}>
                  {current?.patient_name || 'Waiting'}
                </div>
              </div>

              <div className={`${isSinglePanel ? 'mt-9 max-w-[1540px] mx-auto grid grid-cols-7 gap-2.5' : 'mt-12 grid grid-cols-5 gap-4'}`}>
                {circles.map((v, idx) => (
                  <div
                    key={`${rm.code}-dot-${idx}`}
                    className={`${isSinglePanel ? 'w-32 h-32' : 'w-28 h-28'} mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-[inset_0_2px_10px_rgba(255,255,255,0.25),0_10px_16px_rgba(37,99,235,0.3)] flex items-center justify-center`}
                  >
                    <span className={`${isSinglePanel ? 'text-[3.1rem]' : 'text-5xl'} font-black text-white leading-none tracking-tight`}>
                      {rm.prefix}{v.token_number}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
