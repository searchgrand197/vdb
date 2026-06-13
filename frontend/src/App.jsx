import React, { Suspense, lazy, useEffect, useState, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import api from './api'
import { useAuthStore } from './stores/authStore'
import { resolvePortalFromPath } from './themes'
import {
  createManifestBlobUrl,
  getHospitalBrandingProfile,
  getHospitalNameForTab,
  HOSPITAL_BRANDING_CHANGED,
  syncHospitalBrandingFromApiRow,
} from './utils/hospitalBranding'
import { syncTimeDisplayModeFromRow } from './utils/dateTimeFormat'
import { AppRoutes as AdminRoutes } from './adminPortal/routes/AppRoutes'
import { ToastProvider } from './adminPortal/context/ToastContext'

const StaffPortal = lazy(() => import('./pages/StaffPortal'))
const DoctorPortal = lazy(() => import('./pages/DoctorPortal'))
const ReceptionistPortal = lazy(() => import('./pages/ReceptionistPortal'))
const TVDisplay = lazy(() => import('./pages/TVDisplay'))
const LabPortal = lazy(() => import('./pages/LabPortal'))
const PrintSlipPage = lazy(() => import('./pages/PrintSlipPage'))
const PharmacyPortal = lazy(() => import('./pages/PharmacyPortal'))
const PharmacySalesDisplay = lazy(() => import('./pages/PharmacySalesDisplay'))

const ROLE_PATHS = {
  staff: '/staff',
  doctor: '/doctor',
  receptionist: '/receptionist',
  lab: '/lab',
  pharmacy: '/pharmacy',
  admin: '/admin',
}

/** Pharmacy API requires X-Pharmacy-Branch; without it every request fails and must not auto-bounce from /login */
function pharmacyPortalReady(role, pharmacyBranchId) {
  return role !== 'pharmacy' || Boolean(pharmacyBranchId)
}

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => Boolean(s.tokens.access))
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PortalAccessRoute({ portalCode, children }) {
  const isAuthenticated = useAuthStore((s) => Boolean(s.tokens.access))
  const user = useAuthStore((s) => s.user)
  const selectedRole = useAuthStore((s) => s.role)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.is_superuser) {
    return children
  }

  const allowedPortals = Array.isArray(user?.allowed_portals) ? user.allowed_portals : []
  const portalToCheck = portalCode || selectedRole
  if (portalToCheck && !allowedPortals.includes(portalToCheck)) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PharmacyRequiresBranch({ children }) {
  const role = useAuthStore((s) => s.role)
  const pharmacyBranchId = useAuthStore((s) => s.pharmacyBranchId)
  if (role === 'pharmacy' && !pharmacyBranchId) {
    return <Navigate to="/login" replace />
  }
  return children
}

function HomeRedirect() {
  const hasAccess = useAuthStore((s) => Boolean(s.tokens.access))
  const role = useAuthStore((s) => s.role) || 'staff'
  const pharmacyBranchId = useAuthStore((s) => s.pharmacyBranchId)
  if (hasAccess && !pharmacyPortalReady(role, pharmacyBranchId)) {
    return <Navigate to="/login" replace />
  }
  if (hasAccess) {
    return <Navigate to={ROLE_PATHS[role] || '/staff'} replace />
  }
  return <Navigate to="/login" replace />
}

function LoginRoute() {
  const hasAccess = useAuthStore((s) => Boolean(s.tokens.access))
  const role = useAuthStore((s) => s.role) || 'staff'
  const pharmacyBranchId = useAuthStore((s) => s.pharmacyBranchId)

  if (hasAccess && pharmacyPortalReady(role, pharmacyBranchId)) {
    return <Navigate to={ROLE_PATHS[role] || '/staff'} replace />
  }
  return <Login />
}

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
      Loading…
    </div>
  )
}

const PORTAL_TITLE_PREFIX = {
  doctor: 'Doctor Portal',
  pharmacy: 'Pharmacy Portal',
  receptionist: 'Reception Portal',
  admin: 'Admin Portal',
  staff: 'Staff Portal',
  lab: 'Lab Portal',
}

function AppHeadManager() {
  const location = useLocation()
  const [hospitalBrandingBump, setHospitalBrandingBump] = useState(0)
  const manifestBlobUrlRef = useRef(null)
  const access = useAuthStore((s) => s.tokens.access)

  useEffect(() => {
    const bump = () => setHospitalBrandingBump((n) => n + 1)
    window.addEventListener(HOSPITAL_BRANDING_CHANGED, bump)
    return () => window.removeEventListener(HOSPITAL_BRANDING_CHANGED, bump)
  }, [])

  useEffect(() => {
    if (!access || location.pathname.startsWith('/login')) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/settings/reception-portal/')
        const row = data?.data ?? data
        if (!cancelled && row && typeof row === 'object') {
          syncHospitalBrandingFromApiRow(row)
          syncTimeDisplayModeFromRow(row)
        }
      } catch {
        /* e.g. admin without hospital — keep cached / fallback branding */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access, location.pathname])

  useEffect(() => {
    const roleKey = resolvePortalFromPath(location.pathname) || 'staff'

    const roleMeta = {
      doctor: {
        iconHref: '/icons/icon-doctor-192.png?v=4',
        manifestFallback: '/manifest-doctor.json?v=4',
      },
      pharmacy: {
        iconHref: '/icons/icon-pharmacy-192.png?v=4',
        manifestFallback: '/manifest-pharmacy.json?v=4',
      },
      receptionist: {
        iconHref: '/icons/icon-reception-192.png?v=5',
        manifestFallback: '/manifest-receptionist.json?v=5',
      },
      admin: {
        iconHref: '/icons/icon-staff-192.png?v=4',
        manifestFallback: '/manifest-staff.json?v=4',
      },
      staff: {
        iconHref: '/icons/icon-staff-192.png?v=4',
        manifestFallback: '/manifest-staff.json?v=4',
      },
      lab: {
        iconHref: '/icons/icon-staff-192.png?v=4',
        manifestFallback: '/manifest-staff.json?v=4',
      },
    }[roleKey]

    const titlePrefix = PORTAL_TITLE_PREFIX[roleKey] || PORTAL_TITLE_PREFIX.staff
    document.title = `${titlePrefix} - ${getHospitalNameForTab()}`

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

    if (manifestBlobUrlRef.current) {
      URL.revokeObjectURL(manifestBlobUrlRef.current)
      manifestBlobUrlRef.current = null
    }
    try {
      const blobUrl = createManifestBlobUrl(roleKey, undefined, getHospitalBrandingProfile())
      manifestBlobUrlRef.current = blobUrl
      manifestLink.setAttribute('href', blobUrl)
    } catch {
      manifestLink.setAttribute('href', roleMeta.manifestFallback)
    }

    return () => {
      const u = manifestBlobUrlRef.current
      if (u) {
        URL.revokeObjectURL(u)
        manifestBlobUrlRef.current = null
      }
    }
  }, [location.pathname, hospitalBrandingBump])

  return null
}

function toBase64Url(uint8Array) {
  const binString = String.fromCharCode(...uint8Array)
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function PushNotificationBootstrap() {
  const location = useLocation()

  useEffect(() => {
    const token = useAuthStore.getState().tokens.access
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
    <ToastProvider>
      <Suspense fallback={<PageLoading />}>
        <AppHeadManager />
        <PushNotificationBootstrap />
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/staff" element={<PortalAccessRoute portalCode="staff"><StaffPortal /></PortalAccessRoute>} />
          <Route path="/doctor" element={<PortalAccessRoute portalCode="doctor"><DoctorPortal /></PortalAccessRoute>} />
          <Route path="/receptionist" element={<PortalAccessRoute portalCode="receptionist"><ReceptionistPortal /></PortalAccessRoute>} />
          <Route path="/lab" element={<PortalAccessRoute portalCode="lab"><LabPortal /></PortalAccessRoute>} />
          <Route
            path="/pharmacy"
            element={
              <PortalAccessRoute portalCode="pharmacy">
                <PharmacyRequiresBranch>
                  <PharmacyPortal />
                </PharmacyRequiresBranch>
              </PortalAccessRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <PortalAccessRoute portalCode="admin">
                <AdminRoutes />
              </PortalAccessRoute>
            }
          />
          <Route path="/tv/:roomCode" element={<TVDisplay />} />
          <Route path="/print-slip" element={<PrintSlipPage />} />
          <Route path="/pharmacy-display" element={<PharmacySalesDisplay />} />
          <Route path="/" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  )
}
