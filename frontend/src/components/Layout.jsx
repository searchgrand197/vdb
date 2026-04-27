import React from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Hospital } from 'lucide-react'

export default function Layout({ title, subtitle, color = 'blue', children, tabs, activeTab, onTab, headerExtra }) {
  const nav = useNavigate()

  function logout() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('role')
    localStorage.removeItem('user')
    nav('/login')
  }

  const colors = {
    blue: 'from-blue-600 to-indigo-600',
    green: 'from-emerald-600 to-teal-600',
    purple: 'from-purple-600 to-pink-600',
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className={`bg-gradient-to-r ${colors[color]} text-white px-6 py-1.5 flex items-center justify-between shadow`}>
        <div className="flex items-center gap-2">
          <Hospital size={18} />
          <div className="flex items-baseline gap-2">
            <h1 className="font-extrabold text-sm leading-none">{title}</h1>
            {subtitle && <p className="text-[10px] opacity-80 leading-none">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          <button onClick={logout} className="flex items-center gap-1 text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-all">
            <LogOut size={12} /> Logout
          </button>
        </div>
      </header>

      {/* Tab bar */}
      {tabs && (
        <div className="bg-white border-b border-gray-200 px-6 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {t.icon && <t.icon size={14} />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 overflow-auto p-4 min-h-0">{children}</main>
    </div>
  )
}
