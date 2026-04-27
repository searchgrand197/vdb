import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import AdminCrudPage from '../admin/AdminCrudPage'
import { ADMIN_MODULES, ADMIN_NAV_GROUPS } from '../admin/moduleConfigs'

export default function AdminDashboard() {
  const nav = useNavigate()
  const { moduleKey } = useParams()
  const currentKey = moduleKey && ADMIN_MODULES[moduleKey] ? moduleKey : 'users'
  const currentModule = ADMIN_MODULES[currentKey]

  const openModule = (key) => nav(`/admin-dashboard/${key}`)

  return (
    <Layout
      title="Admin Dashboard"
      subtitle={currentModule?.title || 'Superuser Control Center'}
      color="purple"
      noScroll
    >
      <div className="h-full overflow-hidden">
        <div className="grid grid-cols-12 gap-3 h-full">
          <aside className="col-span-12 md:col-span-3 lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-auto p-2">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-3">
                <p className="px-2 py-1 text-[11px] uppercase tracking-wide font-bold text-slate-500">{group.title}</p>
                <div className="space-y-1">
                  {group.keys.map((key) => (
                    <button
                      key={key}
                      onClick={() => openModule(key)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-sm ${
                        key === currentKey ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {ADMIN_MODULES[key]?.title || key}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>
          <main className="col-span-12 md:col-span-9 lg:col-span-10 overflow-auto">
            <AdminCrudPage module={currentModule} />
          </main>
        </div>
      </div>
    </Layout>
  )
}
