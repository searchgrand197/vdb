import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import api from './api'
import { AuthProvider } from './adminPortal/context/AuthContext'
import { ToastProvider } from './adminPortal/context/ToastContext'
import { AppRoutes as AdminRoutes } from './adminPortal/routes/AppRoutes'

const StaffPortal = lazy(() => import('./pages/StaffPortal'))
const DoctorPortal = lazy(() => import('./pages/DoctorPortal'))
const ReceptionistPortal = lazy(() => import('./pages/ReceptionistPortal'))
const TVDisplay = lazy(() => import('./pages/TVDisplay'))
const LabPortal = lazy(() => import('./pages/LabPortal'))
const PrintSlipPage = lazy(() => import('./pages/PrintSlipPage'))
const PharmacyPortal = lazy(() => import('./pages/PharmacyPortal'))
const ROLE_PATHS = {
  staff: '/staff',
  doctor: '/doctor',
  receptionist: '/receptionist',
  lab: '/lab',
  pharmacy: '/pharmacy',
  admin: '/admin',
}

function PrivateRoute({ children }) {
  return localStorage.getItem('access') ? children : <Navigate to="/login" replace />
}

function HomeRedirect() {
  const token = localStorage.getItem('access')
  if (token) {
    const role = localStorage.getItem('role') || 'staff'
    return <Navigate to={ROLE_PATHS[role] || '/staff'} replace />
  }
  return <Navigate to="/login" replace />
}

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
      Loading…
    </div>
  )
}

function AppHeadManager() {
  const location = useLocation()

  useEffect(() => {
    const resolveRoleKey = () => {
      const firstSegment = (location.pathname || '/')
        .split('/')
        .filter(Boolean)[0]

      if (firstSegment === 'doctor') return 'doctor'
      if (firstSegment === 'pharmacy') return 'pharmacy'
      if (firstSegment === 'receptionist' || firstSegment === 'reception') return 'receptionist'
      if (firstSegment === 'admin') return 'admin'
      if (firstSegment === 'staff') return 'staff'
      const savedRole = localStorage.getItem('role')
      if (savedRole === 'doctor') return 'doctor'
      if (savedRole === 'pharmacy') return 'pharmacy'
      if (savedRole === 'receptionist' || savedRole === 'reception') return 'receptionist'
      if (savedRole === 'admin') return 'admin'
      return 'staff'
    }

    const roleKey = resolveRoleKey()
    const roleMeta = {
      doctor: {
        title: 'Doctor Portal - Vardaan',
        iconHref: '/icons/icon-doctor-192.png?v=4',
        manifestHref: '/manifest-doctor.json?v=4',
      },
      pharmacy: {
        title: 'Pharmacy Portal - Vardaan',
        iconHref: '/icons/icon-pharmacy-192.png?v=4',
        manifestHref: '/manifest-pharmacy.json?v=4',
      },
      receptionist: {
        title: 'Reception Portal - Vardaan',
        iconHref: '/icons/icon-reception-192.png?v=5',
        manifestHref: '/manifest-receptionist.json?v=5',
      },
      admin: {
        title: 'Admin Portal - Vardaan',
        iconHref: '/icons/icon-staff-192.png?v=4',
        manifestHref: '/manifest-staff.json?v=4',
      },
      staff: {
        title: 'Staff Portal - Vardaan',
        iconHref: '/icons/icon-staff-192.png?v=4',
        manifestHref: '/manifest-staff.json?v=4',
      },
    }[roleKey]

    // Force-refresh favicon links so browser tab icon updates reliably.
    document
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach((node) => node.parentNode?.removeChild(node))

    const cacheBust = `cb=${Date.now()}`
    const iconUrl = roleMeta.iconHref.includes('?')
      ? `${roleMeta.iconHref}&${cacheBust}`
      : `${roleMeta.iconHref}?${cacheBust}`

    const appendLink = (rel, href, type) => {
      const link = document.createElement('link')
      link.setAttribute('rel', rel)
      link.setAttribute('href', href)
      if (type) link.setAttribute('type', type)
      document.head.appendChild(link)
    }

    appendLink('icon', iconUrl, 'image/png')
    appendLink('shortcut icon', iconUrl, 'image/png')
    appendLink('apple-touch-icon', iconUrl)
    let manifestLink = document.querySelector('link[rel="manifest"]')
    if (!manifestLink) {
      manifestLink = document.createElement('link')
      manifestLink.setAttribute('rel', 'manifest')
      document.head.appendChild(manifestLink)
    }
    manifestLink.setAttribute('href', roleMeta.manifestHref)

    document.title = roleMeta.title
  }, [location.pathname])

  return null
}

function toBase64Url(uint8Array) {
  const binString = String.fromCharCode(...uint8Array)
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function PushNotificationBootstrap() {
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (!token) return
    if (location.pathname.startsWith('/login')) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return

    let cancelled = false

    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
      const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = atob(normalized)
      return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
    }

    const subscribe = async () => {
      try {
        let permission = Notification.permission
        if (permission === 'default') {
          permission = await Notification.requestPermission()
        }
        if (permission !== 'granted') return

        const { data } = await api.get('/notifications/push/public-key/')
        const publicKey = data?.public_key
        if (!publicKey) return

        const registration = await navigator.serviceWorker.ready
        if (cancelled) return

        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          })
        }
        if (!subscription) return

        const subJson = subscription.toJSON()
        const endpoint = subJson.endpoint
        const p256dh = subJson.keys?.p256dh || toBase64Url(new Uint8Array(subscription.getKey('p256dh')))
        const auth = subJson.keys?.auth || toBase64Url(new Uint8Array(subscription.getKey('auth')))
        if (!endpoint || !p256dh || !auth) return

        await api.post('/notifications/push/subscribe/', {
          endpoint,
          p256dh_key: p256dh,
          auth_key: auth,
        })
      } catch {
        // Best-effort registration only.
      }
    }

    subscribe()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<PageLoading />}>
          <AppHeadManager />
          <PushNotificationBootstrap />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/staff" element={<PrivateRoute><StaffPortal /></PrivateRoute>} />
            <Route path="/doctor" element={<PrivateRoute><DoctorPortal /></PrivateRoute>} />
            <Route path="/receptionist" element={<PrivateRoute><ReceptionistPortal /></PrivateRoute>} />
            <Route path="/lab" element={<PrivateRoute><LabPortal /></PrivateRoute>} />
            <Route
              path="/pharmacy"
              element={
                <PrivateRoute>
                  <PharmacyPortal />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <PrivateRoute>
                  <AdminRoutes />
                </PrivateRoute>
              }
            />
            <Route path="/tv/:roomCode" element={<TVDisplay />} />
            <Route path="/print-slip" element={<PrintSlipPage />} />
            <Route path="/" element={<HomeRedirect />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  )
}
