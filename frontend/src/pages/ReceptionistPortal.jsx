import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useAuthStore } from '../stores/authStore'
import {
  Groups as GroupsIcon,
  Print as PrintIcon,
  Add as AddIcon,
  Tv as TvIcon,
  ArrowForward as ArrowForwardIcon,
  Search as SearchIcon,
  Monitor as MonitorIcon,
  Bed as BedIcon,
  WarningAmber as WarningAmberIcon,
  Description as DescriptionIcon,
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  Logout as LogoutIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  Checklist as ChecklistIcon,
  MonitorHeart as MonitorHeartIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  AddCircle as AddCircleIcon,
  Edit as EditIcon,
  Air as AirIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  ReceiptLong as ReceiptLongIcon,
  Delete as DeleteIcon,
  CreditCard as CreditCardIcon,
  Notifications as NotificationsIcon,
  Phone as PhoneIcon,
  Close as CloseIcon,
  LocalOffer as LocalOfferIcon,
  Person as PersonIcon,
  Favorite as FavoriteIcon,
  Report as ReportIcon,
  Article as ArticleIcon,
  Vaccines as VaccinesIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Message as MessageIcon,
} from '@mui/icons-material'
import { getRoomsConfig, saveRoomsConfig, getTvGroupsConfig, saveTvGroupsConfig } from '../utils/rooms'
import BedSelector from '../components/BedSelector'
import OpdGeneratorTab from '../components/OpdTemplateEditor/OpdGeneratorTab'
import DischargePrescriptionPanel from '../components/DischargePrescriptionPanel'
import { rxItemsToMedicationRows, medicationRowsToRxItems } from '../pharmacy/rxMedicationMapping'
import { DEFAULT_DOSAGE_PATTERNS, DEFAULT_TIMING_OPTIONS } from '../pharmacy/rxConstants'
import { syncHospitalBrandingFromApiRow } from '../utils/hospitalBranding'

function asMuiIcon(IconComponent) {
  return function IconBridge({ size, className, sx, ...rest }) {
    return (
      <IconComponent
        className={className}
        sx={{ ...(size ? { fontSize: size } : {}), ...sx }}
        {...rest}
      />
    )
  }
}

const Users = asMuiIcon(GroupsIcon)
const Printer = asMuiIcon(PrintIcon)
const Plus = asMuiIcon(AddIcon)
const Tv = asMuiIcon(TvIcon)
const ArrowRight = asMuiIcon(ArrowForwardIcon)
const Search = asMuiIcon(SearchIcon)
const Monitor = asMuiIcon(MonitorIcon)
const Bed = asMuiIcon(BedIcon)
const AlertTriangle = asMuiIcon(WarningAmberIcon)
const FileText = asMuiIcon(DescriptionIcon)
const UserPlus = asMuiIcon(PersonAddIcon)
const Hospital = asMuiIcon(LocalHospitalIcon)
const LogOut = asMuiIcon(LogoutIcon)
const ChevronDown = asMuiIcon(ExpandMoreIcon)
const ChevronRight = asMuiIcon(ChevronRightIcon)
const ChevronLeft = asMuiIcon(ChevronLeftIcon)
const ClipboardList = asMuiIcon(ChecklistIcon)
const Activity = asMuiIcon(MonitorHeartIcon)
const XCircle = asMuiIcon(CancelIcon)
const CheckCircle = asMuiIcon(CheckCircleIcon)
const Clock = asMuiIcon(AccessTimeIcon)
const RefreshCw = asMuiIcon(RefreshIcon)
const Eye = asMuiIcon(VisibilityIcon)
const PlusCircle = asMuiIcon(AddCircleIcon)
const Edit2 = asMuiIcon(EditIcon)
const Wind = asMuiIcon(AirIcon)
const IndianRupee = asMuiIcon(CurrencyRupeeIcon)
const Receipt = asMuiIcon(ReceiptLongIcon)
const Trash2 = asMuiIcon(DeleteIcon)
const CreditCard = asMuiIcon(CreditCardIcon)
const Bell = asMuiIcon(NotificationsIcon)
const Phone = asMuiIcon(PhoneIcon)
const X = asMuiIcon(CloseIcon)
const Tag = asMuiIcon(LocalOfferIcon)
const User = asMuiIcon(PersonIcon)
const HeartPulse = asMuiIcon(FavoriteIcon)
const Skull = asMuiIcon(ReportIcon)
const ScrollText = asMuiIcon(ArticleIcon)
const Syringe = asMuiIcon(VaccinesIcon)
const FlaskConical = asMuiIcon(ScienceIcon)
const Pill = asMuiIcon(MedicationIcon)
const MessageSquare = asMuiIcon(MessageIcon)

const DEFAULT_PAYMENT_SLIP_PROFILE = {
  hospital_name: 'Vardraan Hospital',
  address: 'Jind, Haryana, 126102',
  pin_code: '126102',
  phone: '+91-XXXXXXXXXX',
  email: 'info@vardraanhospital.com',
  website: 'www.vardraanhospital.com',
}

const DEFAULT_RECEPTION_OPD_SETTINGS = {
  default_city: 'Jind',
  default_state: 'Haryana',
  default_doctor_user: '',
  print_with_background: true,
}

let receptionPortalSettingsCache = {
  ...DEFAULT_RECEPTION_OPD_SETTINGS,
  ...DEFAULT_PAYMENT_SLIP_PROFILE,
}

/** Discharge preview registers afterprint; bill print must not close preview (`ipd_ledger` vs `discharge`). */
let receptionistLastPrintKind = null

function clearAuthStorage() {
  useAuthStore.getState().logout()
}

function getReceptionOpdSettings() {
  return {
    default_city: receptionPortalSettingsCache.default_city || DEFAULT_RECEPTION_OPD_SETTINGS.default_city,
    default_state: receptionPortalSettingsCache.default_state || DEFAULT_RECEPTION_OPD_SETTINGS.default_state,
    default_doctor_user: receptionPortalSettingsCache.default_doctor_user || '',
    print_with_background: receptionPortalSettingsCache.print_with_background === true,
  }
}

async function loadReceptionPortalSettings() {
  try {
    const { data } = await api.get('/settings/reception-portal/')
    const row = data?.data || data || {}
    receptionPortalSettingsCache = {
      ...receptionPortalSettingsCache,
      default_city: row.default_city ?? receptionPortalSettingsCache.default_city,
      default_state: row.default_state ?? receptionPortalSettingsCache.default_state,
      default_doctor_user: row.default_doctor_user ? String(row.default_doctor_user) : '',
      hospital_name: row.hospital_name ?? receptionPortalSettingsCache.hospital_name,
      address: row.address ?? receptionPortalSettingsCache.address,
      pin_code: row.pin_code ?? receptionPortalSettingsCache.pin_code,
      phone: row.phone ?? receptionPortalSettingsCache.phone,
      email: row.email ?? receptionPortalSettingsCache.email,
      website: row.website ?? receptionPortalSettingsCache.website,
      print_with_background: row.print_with_background ?? receptionPortalSettingsCache.print_with_background,
    }
    syncHospitalBrandingFromApiRow(receptionPortalSettingsCache)
  } catch {
    // keep defaults if API fails
  }
}

async function saveReceptionOpdSettings(settings) {
  const payload = {
    default_city: settings.default_city || '',
    default_state: settings.default_state || '',
    default_doctor_user: settings.default_doctor_user || null,
    print_with_background: settings.print_with_background === true,
  }
  await api.patch('/settings/reception-portal/', payload)
  receptionPortalSettingsCache = { ...receptionPortalSettingsCache, ...payload, default_doctor_user: payload.default_doctor_user || '' }
}

function getPaymentSlipProfile() {
  return {
    hospital_name: receptionPortalSettingsCache.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name,
    address: receptionPortalSettingsCache.address || DEFAULT_PAYMENT_SLIP_PROFILE.address,
    pin_code: receptionPortalSettingsCache.pin_code || DEFAULT_PAYMENT_SLIP_PROFILE.pin_code,
    phone: receptionPortalSettingsCache.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone,
    email: receptionPortalSettingsCache.email || DEFAULT_PAYMENT_SLIP_PROFILE.email,
    website: receptionPortalSettingsCache.website || DEFAULT_PAYMENT_SLIP_PROFILE.website,
  }
}

/** Ledger / IPD receipt lines: date with time in parentheses (matches print). */
function formatReceiptDateTime(value) {
  if (value == null || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${format(d, 'd/M/yyyy')} (${format(d, 'HH:mm:ss')})`
}

function toDateTimeInputValue(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function formatApiError(err, fallback) {
  const d = err?.response?.data
  if (!d) return fallback
  if (typeof d.detail === 'string') return d.detail
  if (d.errors && typeof d.errors === 'object') {
    const first = Object.values(d.errors).flat()[0]
    if (typeof first === 'string') return first
  }
  if (d.message && typeof d.message === 'string') return d.message
  try {
    return JSON.stringify(d)
  } catch {
    return fallback
  }
}

async function savePaymentSlipProfile(profile) {
  const payload = {
    hospital_name: profile.hospital_name || '',
    address: profile.address || '',
    pin_code: profile.pin_code || '',
    phone: profile.phone || '',
    email: profile.email || '',
    website: profile.website || '',
  }
  await api.patch('/settings/reception-portal/', payload)
  receptionPortalSettingsCache = { ...receptionPortalSettingsCache, ...payload }
  syncHospitalBrandingFromApiRow(receptionPortalSettingsCache)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizePersonName(value) {
  return String(value || '').replace(/[0-9]/g, '')
}

const PRINT_WINDOW_CLOSE_SCRIPT = `<script>
  (function () {
    let finalized = false
    const finalize = () => {
      if (finalized) return
      finalized = true
      try { window.location.replace('about:blank') } catch {}
      setTimeout(() => {
        try { window.close() } catch {}
      }, 50)
    }

    window.addEventListener('afterprint', finalize, { once: true })
    window.addEventListener('focus', () => setTimeout(finalize, 200), { once: true })
    setTimeout(finalize, 120000)

    window.addEventListener('load', () => {
      setTimeout(() => {
        try { window.print() } catch { finalize() }
      }, 0)
    }, { once: true })
  })()
</script>`

function createSameTabPrintWindow(options = {}) {
  const { onComplete } = options
  let html = ''
  return {
    document: {
      write(chunk) {
        html += String(chunk || '')
      },
      close() {
        const iframe = document.createElement('iframe')
        iframe.setAttribute('aria-hidden', 'true')
        iframe.style.position = 'fixed'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        iframe.style.opacity = '0'
        iframe.style.pointerEvents = 'none'
        iframe.style.left = '-9999px'
        iframe.style.bottom = '0'
        document.body.appendChild(iframe)

        let cleaned = false
        let completed = false
        const notifyComplete = () => {
          if (completed) return
          completed = true
          if (typeof onComplete === 'function') {
            try { onComplete() } catch {}
          }
        }
        const cleanup = () => {
          if (cleaned) return
          cleaned = true
          try { iframe.remove() } catch {}
          notifyComplete()
        }

        const onFrameLoad = () => {
          const cw = iframe.contentWindow
          if (!cw) {
            cleanup()
            return
          }
          cw.addEventListener('afterprint', () => setTimeout(cleanup, 100), { once: true })
          window.addEventListener('focus', () => setTimeout(cleanup, 300), { once: true })
          setTimeout(cleanup, 120000)
        }

        iframe.addEventListener('load', onFrameLoad, { once: true })

        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) {
          cleanup()
          return
        }
        doc.open('text/html')
        doc.write(html)
        doc.close()
      },
    },
  }
}

function printUrlInSameTab(url) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.left = '-9999px'
  iframe.style.bottom = '0'
  document.body.appendChild(iframe)

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    try { iframe.remove() } catch {}
  }

  iframe.addEventListener('load', () => {
    const cw = iframe.contentWindow
    if (!cw) {
      cleanup()
      return
    }
    cw.addEventListener('afterprint', () => setTimeout(cleanup, 100), { once: true })
    window.addEventListener('focus', () => setTimeout(cleanup, 300), { once: true })
    setTimeout(cleanup, 120000)
  }, { once: true })

  iframe.src = url
}

// ─── Sidebar Nav Config ───────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'OPD',
    items: [
      { id: 'opd', label: 'Token Queue', icon: Users },
      { id: 'opd_history', label: 'OPD Slips', icon: FileText },
    ],
  },
  {
    label: 'IPD',
    items: [
      { id: 'ipd', label: 'Active Admissions', icon: Bed },
      { id: 'new_admission', label: 'New Admission', icon: PlusCircle },
    ],
  },
  {
    label: 'Emergency',
    items: [{ id: 'emergency', label: 'Emergency Cases', icon: AlertTriangle }],
  },
  {
    label: 'Patients',
    items: [
      { id: 'patients', label: 'Patient List', icon: ClipboardList },
      { id: 'register', label: 'Register Patient', icon: UserPlus },
    ],
  },
  {
    label: 'Billing',
    items: [
      { id: 'payment_slip', label: 'Payment Slip', icon: Receipt },
      { id: 'payment_slip_list', label: 'Payment Slips List', icon: FileText },
    ],
  },
  {
    label: 'Discharge',
    items: [{ id: 'discharge', label: 'Discharge Summary', icon: FileText }],
  },
  {
    label: 'Setup',
    items: [
      { id: 'settings', label: 'Settings', icon: Tag },
    ],
  },
  {
    label: 'Staff',
    items: [{ id: 'attendance', label: 'Attendance', icon: Clock }],
  },
]

// ─── Follow-Up Alert Banner ────────────────────────────────────────────────────
function FollowUpAlertBanner() {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  async function fetchAlerts() {
    try {
      const { data } = await api.get('/follow-up-alerts/');
      setAlerts(data);
    } catch { }
  }

  const visible = alerts.filter(a => !dismissed.has(a.id));
  const todayAlerts = visible.filter(a => a.is_today);
  const tomorrowAlerts = visible.filter(a => a.is_tomorrow);

  if (visible.length === 0) return null;

  return (
    <div className={`border-b shadow-sm ${
      todayAlerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className={`relative flex items-center justify-center w-7 h-7 rounded-full ${
            todayAlerts.length > 0 ? 'bg-red-500' : 'bg-amber-500'
          } text-white`}>
            <Bell size={13} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border-2 border-current text-[9px] font-black flex items-center justify-center ${
              todayAlerts.length > 0 ? 'text-red-600 border-red-500' : 'text-amber-600 border-amber-500'
            }">{visible.length}</span>
          </div>
          <span className={`text-xs font-extrabold uppercase tracking-wider ${
            todayAlerts.length > 0 ? 'text-red-700' : 'text-amber-700'
          }`}>
            {todayAlerts.length > 0 ? `🚨 ${todayAlerts.length} Follow-up Due TODAY` : ''}
            {todayAlerts.length > 0 && tomorrowAlerts.length > 0 ? '  •  ' : ''}
            {tomorrowAlerts.length > 0 ? `🔔 ${tomorrowAlerts.length} Follow-up Tomorrow` : ''}
          </span>
        </div>
        <button onClick={() => setMinimized(m => !m)}
          className="text-xs text-gray-500 hover:text-gray-800 font-bold px-2 py-1 rounded hover:bg-white/60 transition-all">
          {minimized ? 'Show ▼' : 'Hide ▲'}
        </button>
      </div>

      {/* Alert cards */}
      {!minimized && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1">
          {visible.map(alert => (
            <div key={alert.id} className={`flex-shrink-0 w-72 rounded-xl border p-3 shadow-sm relative ${
              alert.is_today
                ? 'bg-red-100 border-red-300'
                : 'bg-amber-100 border-amber-300'
            }`}>
              {/* Dismiss */}
              <button onClick={() => setDismissed(d => new Set([...d, alert.id]))}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700">
                <X size={12} />
              </button>

              <div className="flex items-start gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0 ${
                  alert.is_today ? 'bg-red-500' : 'bg-amber-500'
                }`}>
                  {alert.is_today ? '🔔' : '📅'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 truncate">{alert.patient_name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{alert.uhid}</p>
                </div>
              </div>

              <p className="text-[10px] text-gray-600 mb-1 line-clamp-2">
                {alert.visit_reason || alert.revisit_advice || 'Follow-up consultation'}
              </p>

              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  alert.is_today
                    ? 'bg-red-200 text-red-800'
                    : 'bg-amber-200 text-amber-800'
                }`}>
                  {alert.is_today ? 'DUE TODAY' : 'DUE TOMORROW'}
                </span>

                {alert.patient_phone && (
                  <a href={`tel:${alert.patient_phone}`}
                    className="flex items-center gap-1.5 text-[11px] font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-all shadow-sm">
                    <Phone size={11} /> Call
                  </a>
                )}
              </div>

              {alert.doctor_name && (
                <p className="text-[10px] text-gray-400 mt-1.5">Dr. {alert.doctor_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OPD Slip Print ──────────────────────────────────────────────────────────
function PrintSlip({ visit, onClose }) {
  const [layoutFields, setLayoutFields] = useState([])
  const [fieldValues, setFieldValues] = useState({})
  const [loadingTemplate, setLoadingTemplate] = useState(true)
  const displayToken = visit.display_token || `${visit.room?.prefix || ''}${visit.token_number || visit.queue_number || ''}`

  useEffect(() => {
    const loadOpdLayout = async () => {
      try {
        const res = await fetch('/api/templates')
        if (res.ok) {
          const data = await res.json()
          const single = (data.templates || []).find(t => t.key === 'single')
          if (single?.layout?.fields) {
            const fields = Object.keys(single.layout.fields)
            setLayoutFields(fields)
            const initValues = {}
            for (const f of fields) {
              const lowerF = f.toLowerCase()
              const gAbbr = (visit.patient_gender === 'female' ? 'F' : visit.patient_gender === 'male' ? 'M' : 'O')
              const ageSexVal = [gAbbr, visit.patient_age ? String(visit.patient_age) : ''].filter(Boolean).join(' ')
              let fullAddress = [visit.patient_address, visit.patient_city, visit.patient_state].filter(Boolean).join(', ')
              if (fullAddress.length > 35) fullAddress = fullAddress.substring(0, 32) + '...'
              // NOTE: guardian must be checked BEFORE generic 'name' check
              if (lowerF.includes('guardian') || lowerF.includes('relative') || lowerF.includes('attendant')) initValues[f] = visit.patient_guardian_name || ''
              else if (lowerF.includes('patient') && !lowerF.includes('guardian')) initValues[f] = visit.patient_name || ''
              else if (lowerF === 'name' || (lowerF.includes('name') && !lowerF.includes('guardian'))) initValues[f] = visit.patient_name || ''
              else if (lowerF.includes('date')) initValues[f] = visit.visit_date ? `${format(new Date(visit.visit_date), 'd/M/yyyy')} (${visit.created_at ? format(new Date(visit.created_at), 'HH:mm') : format(new Date(), 'HH:mm')})` : ''
              else if (lowerF.includes('reg') || lowerF.includes('uhid')) initValues[f] = visit.patient_uhid || ''
              else if (lowerF.includes('phone') || lowerF.includes('mobile') || lowerF.includes('contact')) initValues[f] = visit.patient_phone || ''
              else if (lowerF.includes('token') || lowerF.includes('queue') || lowerF.includes('opd') || lowerF.includes('no')) initValues[f] = displayToken
              else if (lowerF.includes('complaint') || lowerF.includes('reason')) initValues[f] = visit.chief_complaint || ''
              else if (lowerF.includes('doctor') || lowerF.includes('doc')) initValues[f] = visit.doc_name || ''
              else if (lowerF.includes('age') || lowerF.includes('sex')) initValues[f] = ageSexVal
              else if (lowerF.includes('gender')) initValues[f] = visit.patient_gender || ''
              else if (lowerF.includes('address')) initValues[f] = fullAddress
              else if (lowerF.includes('city') || lowerF.includes('town')) initValues[f] = visit.patient_city || ''
              else if (lowerF.includes('state')) initValues[f] = visit.patient_state || ''
              else if (lowerF.includes('amount') || lowerF.includes('fee') || lowerF.includes('charge')) {
                initValues[f] = visit.amount ? `${visit.amount} (${visit.payment_mode || 'cash'})` : ''
              }
              else initValues[f] = ''
            }
            setFieldValues(initValues)
          }
        }
      } catch (err) {
        // silently fail and fallback to basic slip
      } finally {
        setLoadingTemplate(false)
      }
    }
    loadOpdLayout()
  }, [visit])

  function printBasicSlip() {
    const w = createSameTabPrintWindow()
    const slipDateTime =
      visit.visit_date
        ? `${format(new Date(visit.visit_date), 'd/M/yyyy')} ${
            visit.created_at ? format(new Date(visit.created_at), 'HH:mm') : format(new Date(), 'HH:mm')
          }`
        : ''
    w.document.write(`
      <html><head><title>OPD Slip</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; }
        .logo { font-size: 18px; font-weight: bold; color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 12px; }
        .token { font-size: 64px; font-weight: 900; color: #1d4ed8; text-align: center; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
        .label { color: #6b7280; }
        .footer { margin-top: 16px; padding-top: 8px; border-top: 1px dashed #ccc; font-size: 11px; color: #9ca3af; text-align: center; }
      </style></head>
      <body>
      <div class="logo">🏥 HMS Hospital</div>
      <div class="token">${displayToken}</div>
      <div class="row"><span class="label">OPD No.</span><span>${displayToken}</span></div>
      <div class="row"><span class="label">UHID</span><span>${visit.patient_uhid || ''}</span></div>
      <div class="row"><span class="label">Patient</span><span>${visit.patient_name}</span></div>
      ${visit.patient_guardian_name ? `<div class="row"><span class="label">Guardian</span><span>${visit.patient_guardian_name}</span></div>` : ''}
      <div class="row"><span class="label">Date</span><span>${slipDateTime}</span></div>
      <div class="row"><span class="label">Doctor</span><span>${visit.room?.label || visit.doc_name || 'OPD'}</span></div>
      <div class="row"><span class="label">Complaint</span><span>${visit.chief_complaint || '-'}</span></div>
      ${visit.patient_city ? `<div class="row"><span class="label">City</span><span>${visit.patient_city}${visit.patient_state ? ', ' + visit.patient_state : ''}</span></div>` : ''}
      ${visit.amount ? `<div class="row"><span class="label">Amount</span><span>₹${visit.amount}</span></div>` : ''}
      <div class="footer">Please wait for your token to be called<br>Keep this slip safe</div>
      ${PRINT_WINDOW_CLOSE_SCRIPT}
      </body></html>
    `)
    w.document.close()
    onClose()
  }

  function printFullOpdSheet() {
    const opdSettings = getReceptionOpdSettings()
    const withBg = opdSettings.print_with_background === true
    const params = new URLSearchParams({ ...fieldValues, _bg: withBg ? '1' : '0' }).toString()
    printUrlInSameTab(`/print-slip?${params}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-[500] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-auto flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Printer size={18} className="text-emerald-600"/> Print Options
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle size={22} strokeWidth={1.8} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <div className="text-center mb-5 bg-blue-50/50 rounded-xl py-4 border border-blue-100/50">
            <div className="text-5xl font-black text-blue-600 mb-1">
              {displayToken}
            </div>
            <p className="font-bold text-gray-900 text-lg">{visit.patient_name}</p>
            <p className="text-sm font-medium text-gray-500">{visit.room?.label || visit.doc_name || 'OPD'}</p>
          </div>

          {loadingTemplate ? (
            <div className="flex justify-center py-4">
              <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : layoutFields.length > 0 ? (
            <div className="mt-2">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                A4 OPD Print Fields <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 text-[10px] font-bold">LIVE</span>
              </h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                These fields reflect your OPD template configuration. Fill in any missing details before printing the main OPD slip.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {layoutFields.map(f => (
                  <div key={f} className="flex flex-col">
                    <label className="text-xs font-bold text-gray-600 mb-1 capitalize tracking-tight">{f}</label>
                    <input
                      type="text"
                      className="border border-gray-200 bg-gray-50/50 rounded-lg px-3 py-2 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      value={fieldValues[f] || ''}
                      onChange={e => setFieldValues({...fieldValues, [f]: e.target.value})}
                      placeholder={f}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0 flex gap-2">
          <button onClick={printBasicSlip} className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-2">
            Thermal Slip
          </button>
          <button onClick={printFullOpdSheet} className="flex-[2] bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-md transition-colors">
            <Printer size={16} strokeWidth={2.5} /> A4 Print Sheet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── OPD Section ──────────────────────────────────────────────────────────────
function OPDSection({ rooms }) {
  const opdSettings = getReceptionOpdSettings()
  const defaultCity = opdSettings.default_city || ''
  const defaultState = opdSettings.default_state || ''
  const defaultDoctorUser = opdSettings.default_doctor_user || ''
  const [visits, setVisits] = useState([])
  const [doctors, setDoctors] = useState([])
  const [queueSearch, setQueueSearch] = useState('')
  const [printVisit, setPrintVisit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [handoverSummary, setHandoverSummary] = useState({
    opening_cash_in_hand: '0.00',
    cash_total: '0.00',
    upi_total: '0.00',
    other_total: '0.00',
    grand_total: '0.00',
  })
  const [handoverRecipients, setHandoverRecipients] = useState([])
  const [pendingHandovers, setPendingHandovers] = useState([])
  const [collectionEntries, setCollectionEntries] = useState([])

  // Unified patient+OPD form
  const buildEmptyForm = () => ({
    phone: '',
    patient_name: '',
    gender: 'male',
    age: '',
    guardian_name: '',
    address_line1: '',
    city: defaultCity,
    state: defaultState,
    doctor: defaultDoctorUser,
    amount: '',
    payment_mode: 'cash',
    chief_complaint: '',
    visit_date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [form, setForm] = useState(() => buildEmptyForm())
  const [matchedPatient, setMatchedPatient] = useState(null)  // existing patient found by phone
  const [lookupCandidates, setLookupCandidates] = useState([])
  const [opdNewPersonSamePhone, setOpdNewPersonSamePhone] = useState(false) // register different person; same mobile → family link
  const samePhoneModeDigitsRef = useRef(null)
  const [samePhoneFamilyModalOpen, setSamePhoneFamilyModalOpen] = useState(false)
  const samePhoneModalDismissedKeyRef = useRef('')
  const samePhoneFamilyUseConfirmedKeyRef = useRef('')
  /** All patients in this hospital sharing the entered mobile (from /patients/by-phone/). */
  const [samePhoneFamilyList, setSamePhoneFamilyList] = useState([])
  const [lookingUp, setLookingUp] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')
  const pollingRef = useRef(null)

  const submitActionRef = useRef('thermal')
  const [layoutFields, setLayoutFields] = useState([])
  const [templateValues, setTemplateValues] = useState({})
  const opdAmountManuallyEditedRef = useRef(false)
  const normalizeId = (value) => {
    if (value == null) return ''
    if (typeof value === 'object') {
      return String(value.id ?? value.pk ?? value.user_id ?? '')
    }
    return String(value)
  }
  const getDoctorUserId = (doctorRow) =>
    normalizeId(doctorRow?.user ?? doctorRow?.user_id ?? doctorRow?.userId ?? doctorRow?.doctor_user)
  const doctorMatchesSelectedId = (doctorRow, selectedId) => {
    const target = normalizeId(selectedId)
    if (!target) return false
    const ids = [
      doctorRow?.user,
      doctorRow?.user_id,
      doctorRow?.userId,
      doctorRow?.doctor_user,
      doctorRow?.id,
      doctorRow?.pk,
    ].map(normalizeId).filter(Boolean)
    return ids.includes(target)
  }
  const findDoctorBySelectedId = (doctorRows, selectedId) =>
    (doctorRows || []).find((doctorRow) => doctorMatchesSelectedId(doctorRow, selectedId))
  const getDoctorFee = (doctorRow) => {
    const rawFee = doctorRow?.consultation_fee ?? doctorRow?.consultationFee ?? doctorRow?.fee
    if (rawFee == null || rawFee === '') return null
    const numericFee = Number(String(rawFee).replace(/[^0-9.]/g, ''))
    return Number.isFinite(numericFee) && numericFee > 0 ? numericFee : null
  }
  const getRoomForDoctorUser = (doctorUser) => {
    const id = normalizeId(doctorUser)
    if (!id) return null
    return (rooms || []).find(r => normalizeId(r.doctor_user) === id) || null
  }
  const buildDisplayToken = (visitLike, roomOverride = null) => {
    const tokenRaw = visitLike?.token_number ?? visitLike?.queue_number ?? ''
    const tokenStr = String(tokenRaw || '')
    const roomRow = roomOverride || visitLike?.room || getRoomForDoctorUser(visitLike?.doctor_user)
    const prefix = roomRow?.prefix || ''
    return `${prefix}${tokenStr}`
  }
  const capitalizePersonName = (value) => String(value || '')
    .split(' ')
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : ''))
    .join(' ')

  const hydratePatientIntoForm = useCallback(async (pt) => {
    if (!pt?.id) return
    try {
      const detail = await api.get(`/patients/${pt.id}/`)
      const p = detail.data?.data || detail.data
      if (p) {
        setForm(f => ({
          ...f,
          patient_name: capitalizePersonName([p.first_name, p.last_name].filter(Boolean).join(' ') || ''),
          gender: p.gender || 'male',
          age: p.age != null && p.age !== '' ? String(p.age) : '',
          address_line1: p.address_line1 || '',
          city: p.city || '',
          state: p.state || '',
          guardian_name: capitalizePersonName(p.guardian_name || ''),
        }))
      }
    } catch {
      setForm(f => ({
        ...f,
        patient_name: capitalizePersonName([pt.first_name, pt.last_name].filter(Boolean).join(' ') || ''),
        gender: pt.gender || 'male',
        guardian_name: capitalizePersonName(pt.guardian_name || ''),
      }))
    }
  }, [])

  async function selectLookupCandidate(pt) {
    if (!pt?.id) return
    setMatchedPatient(pt)
    setLookupCandidates([])
    await hydratePatientIntoForm(pt)
  }

  function startAddAnotherPersonSamePhone() {
    const ten = form.phone.replace(/\D/g, '').slice(-10)
    if (ten.length < 10) return
    samePhoneModeDigitsRef.current = ten
    setSamePhoneFamilyModalOpen(false)
    setOpdNewPersonSamePhone(true)
    setMatchedPatient(null)
    setSamePhoneFamilyList([])
    samePhoneModalDismissedKeyRef.current = ''
    samePhoneFamilyUseConfirmedKeyRef.current = ''
    setForm(f => ({
      ...f,
      patient_name: '',
      gender: 'male',
      age: '',
      address_line1: '',
      city: defaultCity,
      state: defaultState,
    }))
  }

  useEffect(() => {
    fetchQueue()
    fetchDoctors()
    fetchHandoverSummary()
    pollingRef.current = setInterval(fetchQueue, 15000)

    const loadOpdLayout = async () => {
      try {
        const res = await fetch('/api/templates')
        if (res.ok) {
          const data = await res.json()
          const single = (data.templates || []).find(t => t.key === 'single')
          if (single?.layout?.fields) {
            setLayoutFields(Object.keys(single.layout.fields))
          }
        }
      } catch (err) {}
    }
    loadOpdLayout()

    return () => clearInterval(pollingRef.current)
  }, [])

  const isCustomField = f => {
    const lowerF = f.toLowerCase()
    const handled = [
      'name', 'patient', 'date', 'time', 'token', 'queue', 'complaint', 'reason',
      'doctor', 'doc', 'age', 'gender', 'sex', 'phone', 'mobile', 'contact',
      'address', 'city', 'state'
    ]
    if (lowerF === 'no' || lowerF === 'token no' || lowerF === 'queue no') return false
    return !handled.some(kw => lowerF.includes(kw))
  }
  const customFields = layoutFields.filter(isCustomField)

  async function fetchDoctors() {
    try {
      const { data } = await api.get('/doctor-profiles/?limit=500')
      setDoctors(Array.isArray(data?.data) ? data.data : (data?.results || data || []))
    } catch {}
  }

  useEffect(() => {
    // When a default doctor is preselected (from OPD settings), auto-fill fee after doctors load.
    if (!form.doctor || form.amount || opdAmountManuallyEditedRef.current) return
    const selectedDoc = findDoctorBySelectedId(doctors, form.doctor)
    const fee = getDoctorFee(selectedDoc)
    if (fee == null) return
    setForm(f => {
      if (normalizeId(f.doctor) !== normalizeId(form.doctor) || f.amount) return f
      return { ...f, amount: String(fee) }
    })
  }, [doctors, form.doctor, form.amount])

  useEffect(() => {
    // On hard refresh, settings load async. Backfill defaults into an untouched form.
    setForm((f) => {
      const next = { ...f }
      let changed = false

      if (!f.city && defaultCity) {
        next.city = defaultCity
        changed = true
      }
      if (!f.state && defaultState) {
        next.state = defaultState
        changed = true
      }
      if (!f.doctor && defaultDoctorUser) {
        next.doctor = defaultDoctorUser
        changed = true
      }

      return changed ? next : f
    })
  }, [defaultCity, defaultState, defaultDoctorUser])

  async function fetchQueue() {
    setLoading(true)
    try {
      const [v, d] = await Promise.all([
        api.get(`/opd-visits/?visit_date=${today}&limit=500`),
        api.get('/doctor-profiles/?limit=500'),
      ])
      const rawVisits = Array.isArray(v.data?.data) ? v.data.data : (v.data?.results || v.data || [])
      const doctorRows = Array.isArray(d.data?.data) ? d.data.data : (d.data?.results || d.data || [])
      setDoctors(doctorRows)
      setVisits(rawVisits.map(vis => {
        const room = getRoomForDoctorUser(vis.doctor_user)
        return {
          ...vis,
          room,
          display_token: buildDisplayToken(vis, room),
          doc_name: findDoctorBySelectedId(doctorRows, vis.doctor_user)?.name || '—',
        }
      }))
      // Keep shift collection totals in sync with newly created/updated visits.
      await fetchHandoverSummary()
    } catch {
      toast.error('Failed to load OPD queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showCollectionModal) {
      fetchHandoverSummary()
    }
  }, [showCollectionModal])

  async function fetchHandoverSummary() {
    try {
      const { data } = await api.get('/handovers/balance/')
      const payload = data?.data || {}
      setHandoverSummary(payload.collection || {
        opening_cash_in_hand: '0.00',
        cash_total: '0.00',
        upi_total: '0.00',
        other_total: '0.00',
        grand_total: '0.00',
      })
      setHandoverRecipients(Array.isArray(payload.handover_recipients) ? payload.handover_recipients : [])
      setPendingHandovers(Array.isArray(payload.pending_received) ? payload.pending_received : [])
      setCollectionEntries(Array.isArray(payload.collection_entries) ? payload.collection_entries : [])
    } catch {}
  }

  // Collection is now shift-based (includes accepted handover opening cash)
  const collectionStats = {
    cash: parseFloat(handoverSummary.cash_total) || 0,
    upi: parseFloat(handoverSummary.upi_total) || 0,
    other: parseFloat(handoverSummary.other_total) || 0,
    total: parseFloat(handoverSummary.grand_total) || 0,
    openingCash: parseFloat(handoverSummary.opening_cash_in_hand) || 0,
  }

  // Patient lookup by phone or UHID; then load full record so receptionist can edit all fields
  useEffect(() => {
    const raw = form.phone.trim()
    if (raw.length < 3) {
      setMatchedPatient(null)
      setLookupCandidates([])
      setSamePhoneFamilyList([])
      setOpdNewPersonSamePhone(false)
      samePhoneModeDigitsRef.current = null
      samePhoneModalDismissedKeyRef.current = ''
      samePhoneFamilyUseConfirmedKeyRef.current = ''
      setSamePhoneFamilyModalOpen(false)
      setForm(f => ({
        ...f,
        first_name: '',
        last_name: '',
        gender: 'male',
        age: '',
        address_line1: '',
        city: defaultCity,
        state: defaultState,
      }))
      return
    }
    const digitsOnly = raw.replace(/\D/g, '')
    const looksLikePhone = /^[\d\s\-+()]+$/.test(raw) && digitsOnly.length > 0
    if (looksLikePhone && digitsOnly.length < 10) {
      setMatchedPatient(null)
      setLookupCandidates([])
      setSamePhoneFamilyList([])
      setOpdNewPersonSamePhone(false)
      samePhoneModeDigitsRef.current = null
      samePhoneModalDismissedKeyRef.current = ''
      samePhoneFamilyUseConfirmedKeyRef.current = ''
      setSamePhoneFamilyModalOpen(false)
      return
    }

    if (opdNewPersonSamePhone && samePhoneModeDigitsRef.current) {
      const ten = digitsOnly.slice(-10)
      if (ten.length === 10 && ten !== samePhoneModeDigitsRef.current) {
        setOpdNewPersonSamePhone(false)
        samePhoneModeDigitsRef.current = null
        // fall through — phone changed; run normal search again
      } else if (ten.length === 10 && ten === samePhoneModeDigitsRef.current) {
        setLookingUp(false)
        return
      }
    }

    let cancelled = false
    const t = setTimeout(async () => {
      setLookingUp(true)
      try {
        const isTenDigitPhone =
          looksLikePhone && digitsOnly.length >= 10 && !/[a-zA-Z]/.test(raw)
        const ten = digitsOnly.slice(-10)

        let familyList = []

        if (isTenDigitPhone) {
          try {
            const bp = await api.get(`/patients/by-phone/?phone=${encodeURIComponent(ten)}`)
            familyList = Array.isArray(bp.data?.data)
              ? bp.data.data
              : Array.isArray(bp.data?.entity)
                ? bp.data.entity
                : []
          } catch { /* use fallback below */ }

          if (familyList.length === 0) {
            const { data } = await api.get(`/patients/?search=${encodeURIComponent(raw)}&limit=50`)
            const rows = Array.isArray(data?.data) ? data.data : (data?.results || data || [])
            familyList = rows.filter(row => {
              const d = String(row.phone || '').replace(/\D/g, '')
              return d.length >= 10 && d.slice(-10) === ten
            })
          }
        }

        if (cancelled) return

        if (familyList.length > 0) {
          setLookupCandidates([])
          setSamePhoneFamilyList(familyList)
          const pt = familyList[0]
          setMatchedPatient(pt)
          await hydratePatientIntoForm(pt)
        } else {
          setSamePhoneFamilyList([])
          const { data } = await api.get(`/patients/?search=${encodeURIComponent(raw)}&limit=5`)
          const rows = Array.isArray(data?.data) ? data.data : (data?.results || data || [])
          if (cancelled) return
          if (rows.length > 0) {
            setLookupCandidates(rows)
            const normalizedRaw = raw.replace(/\s+/g, '').toLowerCase()
            const exactUhidMatch = rows.find((row) => String(row.uhid || '').replace(/\s+/g, '').toLowerCase() === normalizedRaw)
            if (exactUhidMatch) {
              setMatchedPatient(exactUhidMatch)
              setLookupCandidates([])
              await hydratePatientIntoForm(exactUhidMatch)
            } else {
              setMatchedPatient(null)
            }
          } else {
            setLookupCandidates([])
            setMatchedPatient(null)
            setForm(f => ({
              ...f,
              patient_name: '',
              gender: 'male',
              age: '',
              address_line1: '',
              city: '',
              state: '',
            }))
          }
        }
      } catch {
        if (!cancelled) {
          setMatchedPatient(null)
          setLookupCandidates([])
          setSamePhoneFamilyList([])
        }
      } finally {
        if (!cancelled) setLookingUp(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [form.phone, opdNewPersonSamePhone, hydratePatientIntoForm])

  async function handleSubmit(e) {
    e.preventDefault()
    if (/\d/.test(form.patient_name || '')) {
      toast.error('Patient name cannot contain numbers')
      return
    }
    if (/\d/.test(form.guardian_name || '')) {
      toast.error('Guardian name cannot contain numbers')
      return
    }
    if (form.amount !== '' && Number(form.amount) < 0) {
      toast.error('Amount cannot be negative')
      return
    }
    setSubmitting(true)
    try {
      let patientId = matchedPatient?.id
      const rawLookup = form.phone.trim()
      const digitsOnly = rawLookup.replace(/\D/g, '')
      const looksLikeUhid = /[a-zA-Z]/.test(rawLookup) || /^[A-Z0-9]+-[A-Z0-9-]+$/i.test(rawLookup.replace(/\s/g, ''))

      // UHID typed but no match — do not create a fake patient with UHID as phone
      if (!patientId && looksLikeUhid) {
        toast.error('No patient found for this UHID. Check the number or use a mobile number to register a new patient.')
        setSubmitting(false)
        return
      }

      // Create patient if not found (phone path only)
      if (!patientId) {
        if (digitsOnly.length < 10) {
          toast.error('Enter at least 10 digits for a new patient mobile number, or a valid UHID to find an existing patient.')
          setSubmitting(false)
          return
        }
        const normalizedPatientName = capitalizePersonName(form.patient_name).trim()
        const normalizedGuardianName = capitalizePersonName(form.guardian_name).trim()
        const nameParts = normalizedPatientName.split(' ');
        const fName = nameParts[0] || 'Patient';
        const lName = nameParts.slice(1).join(' ') || '';
        const patRes = await api.post('/patients/', {
          first_name: fName,
          last_name: lName,
          phone: digitsOnly.slice(-10),
          gender: form.gender,
          patient_type: 'outpatient',
          ...(opdNewPersonSamePhone ? { link_with_existing_phone_patients: true } : {}),
          ...(form.age         ? { age: parseInt(form.age, 10) }    : {}),
          ...(form.address_line1 ? { address_line1: form.address_line1 } : {}),
          ...(form.city        ? { city: form.city }            : {}),
          ...(form.state       ? { state: form.state }          : {}),
          guardian_name: normalizedGuardianName,
        })
        patientId = (patRes.data?.data || patRes.data)?.id
      } else {
        // Existing patient — save receptionist edits before OPD
        // Only patch name if the receptionist actually filled it in
        const patch = {
          gender: form.gender,
          address_line1: form.address_line1 || '',
          city: form.city || '',
          state: form.state || '',
          guardian_name: capitalizePersonName(form.guardian_name).trim(),
        }
        const trimmedName = capitalizePersonName(form.patient_name).trim()
        if (trimmedName && trimmedName !== 'Patient') {
          const nameParts = trimmedName.split(' ')
          patch.first_name = nameParts[0]
          patch.last_name = nameParts.slice(1).join(' ') || ''
        }
        if (form.age !== '' && form.age != null) {
          const a = parseInt(form.age, 10)
          if (!Number.isNaN(a)) patch.age = a
        }
        if (digitsOnly.length >= 10 && !/[a-zA-Z]/i.test(rawLookup)) {
          patch.phone = digitsOnly.slice(-10)
        }
        await api.patch(`/patients/${patientId}/`, patch)
      }

      // Create OPD visit
      const { data } = await api.post('/opd-visits/', {
        patient: patientId,
        visit_date: form.visit_date,
        chief_complaint: form.chief_complaint,
        doctor_user: form.doctor || null,
        amount: form.amount || null,
        payment_mode: form.payment_mode || 'cash',
        status: 'waiting',
      })
      const payload = data?.data || data
      const selectedDoc = findDoctorBySelectedId(doctors, form.doctor)
      const selectedRoom = getRoomForDoctorUser(form.doctor)
      // Use form.patient_name if filled; otherwise fall back to the matched patient's name
      const ptName = capitalizePersonName((form.patient_name || '').trim()) ||
        capitalizePersonName([matchedPatient?.first_name, matchedPatient?.last_name].filter(Boolean).join(' ')) ||
        'Patient'
      const tokenNum = payload?.token_number || payload?.queue_number || ''
      const displayToken = buildDisplayToken({ ...payload, doctor_user: form.doctor, token_number: tokenNum }, selectedRoom)
      toast.success(`Token #${tokenNum} assigned!`)

      if (submitActionRef.current === 'a4') {
        let printUhid = payload?.patient_uhid || matchedPatient?.uhid || '';
        let printPhone = payload?.patient_phone || matchedPatient?.phone || '';
        let printCity = payload?.patient_city || form.city || '';
        let printState = payload?.patient_state || form.state || '';
        let printGuardian = capitalizePersonName(payload?.patient_guardian_name || form.guardian_name || '');

        const genderAbbr = form.gender === 'female' ? 'F' : form.gender === 'male' ? 'M' : 'O'
        const ageSex = [genderAbbr, form.age].filter(Boolean).join(' ')
        let ptAddress = [form.address_line1, printCity, printState].filter(Boolean).join(', ')
        if (ptAddress.length > 35) ptAddress = ptAddress.substring(0, 32) + '...'

        const finalValues = { ...templateValues }
        for (const f of layoutFields) {
          const lowerF = f.toLowerCase()
          // NOTE: guardian must be checked BEFORE generic 'name' check
          if (lowerF.includes('guardian') || lowerF.includes('relative') || lowerF.includes('attendant')) finalValues[f] = finalValues[f] || printGuardian
          else if (lowerF.includes('patient') && !lowerF.includes('guardian')) finalValues[f] = finalValues[f] || ptName
          else if (lowerF === 'name' || (lowerF.includes('name') && !lowerF.includes('guardian'))) finalValues[f] = finalValues[f] || ptName
          else if (lowerF.includes('date')) finalValues[f] = finalValues[f] || (form.visit_date ? `${format(new Date(form.visit_date), 'd/M/yyyy')} (${format(new Date(), 'HH:mm')})` : '')
          else if (lowerF.includes('reg') || lowerF.includes('uhid')) finalValues[f] = finalValues[f] || printUhid || ''
          else if (lowerF.includes('phone') || lowerF.includes('mobile') || lowerF.includes('contact')) finalValues[f] = finalValues[f] || printPhone || form.phone.replace(/\D/g, '') || ''
          else if (lowerF.includes('token') || lowerF.includes('queue') || lowerF.includes('opd') || lowerF.includes('no')) finalValues[f] = finalValues[f] || displayToken
          else if (lowerF.includes('complaint') || lowerF.includes('reason')) finalValues[f] = finalValues[f] || form.chief_complaint || ''
          else if (lowerF.includes('doctor') || lowerF.includes('doc')) finalValues[f] = finalValues[f] || selectedDoc?.name || ''
          else if (lowerF.includes('age') || lowerF.includes('sex')) finalValues[f] = finalValues[f] || ageSex
          else if (lowerF.includes('gender')) finalValues[f] = finalValues[f] || form.gender || ''
          else if (lowerF.includes('address')) finalValues[f] = finalValues[f] || ptAddress
          else if (lowerF.includes('city') || lowerF.includes('town')) finalValues[f] = finalValues[f] || printCity
          else if (lowerF.includes('state')) finalValues[f] = finalValues[f] || printState
          else if (lowerF.includes('amount') || lowerF.includes('fee') || lowerF.includes('charge')) {
             finalValues[f] = finalValues[f] || (form.amount ? `${form.amount} (${form.payment_mode})` : '')
          }
        }
        const withBg = getReceptionOpdSettings().print_with_background === true
        const params = new URLSearchParams({ ...finalValues, _bg: withBg ? '1' : '0' }).toString()
        printUrlInSameTab(`/print-slip?${params}`)
      } else {
        setPrintVisit({
          ...payload,
          patient_name: ptName,
          doc_name: selectedDoc?.name || '',
          patient_uhid: payload?.patient_uhid || matchedPatient?.uhid || '',
          patient_city: payload?.patient_city || form.city || '',
          patient_state: payload?.patient_state || form.state || '',
          patient_guardian_name: capitalizePersonName(payload?.patient_guardian_name || form.guardian_name || ''),
          room: selectedRoom || undefined,
          display_token: displayToken,
          token_number: tokenNum,
          amount: form.amount || '',
        })
      }

      setForm(buildEmptyForm())
      setTemplateValues({})
      setMatchedPatient(null)
      setOpdNewPersonSamePhone(false)
      samePhoneModeDigitsRef.current = null
      samePhoneModalDismissedKeyRef.current = ''
      samePhoneFamilyUseConfirmedKeyRef.current = ''
      setSamePhoneFamilyModalOpen(false)
      setSamePhoneFamilyList([])
      await fetchQueue()
    } catch (err) {
      const detail = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed'
      toast.error(detail)
    } finally { setSubmitting(false) }
  }

  const filteredVisits = visits.filter(v =>
    !queueSearch || (v.patient_name || '').toLowerCase().includes(queueSearch.toLowerCase()) ||
    String(v.token_number || v.queue_number || '').includes(queueSearch)
  )

  const statusBadge = {
    waiting: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    in_consultation: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-600',
  }

  const lookupRaw = form.phone.trim()
  const lookupDigits = lookupRaw.replace(/\D/g, '')
  const looksLikeUhidInput = /[a-zA-Z]/.test(lookupRaw)
  const showNewPatientHint = !matchedPatient && !opdNewPersonSamePhone && !lookingUp && lookupDigits.length >= 10 && !looksLikeUhidInput
  const showUhidNoMatchHint = !matchedPatient && !lookingUp && looksLikeUhidInput && lookupRaw.length >= 4
  const showSamePhoneNewHint = opdNewPersonSamePhone && !matchedPatient && lookupDigits.length >= 10 && !looksLikeUhidInput
  const phoneFamilySessionKey =
    !looksLikeUhidInput && lookupDigits.length >= 10
      ? `phone-${lookupDigits.slice(-10)}`
      : ''

  const canOfferSamePhoneNew = Boolean(
    (samePhoneFamilyList.length > 0 || matchedPatient) &&
      lookupDigits.length >= 10 &&
      !looksLikeUhidInput,
  )

  const showReopenSamePhoneFamilyModal = Boolean(
    phoneFamilySessionKey &&
      samePhoneFamilyList.length > 0 &&
      !samePhoneFamilyModalOpen &&
      !opdNewPersonSamePhone &&
      samePhoneModalDismissedKeyRef.current === phoneFamilySessionKey &&
      samePhoneFamilyUseConfirmedKeyRef.current !== phoneFamilySessionKey,
  )

  function closeSamePhoneFamilyModalBackdrop() {
    if (phoneFamilySessionKey && samePhoneFamilyList.length > 0) {
      samePhoneModalDismissedKeyRef.current = phoneFamilySessionKey
    }
    setSamePhoneFamilyModalOpen(false)
  }

  function confirmSamePhoneUseExistingPatient() {
    if (phoneFamilySessionKey) {
      samePhoneModalDismissedKeyRef.current = phoneFamilySessionKey
      samePhoneFamilyUseConfirmedKeyRef.current = phoneFamilySessionKey
    }
    setSamePhoneFamilyModalOpen(false)
  }

  function reopenSamePhoneFamilyModal() {
    samePhoneModalDismissedKeyRef.current = ''
    setSamePhoneFamilyModalOpen(true)
  }

  async function selectPatientFromFamilyModal(pt) {
    if (!pt?.id) return
    setMatchedPatient(pt)
    try {
      const detail = await api.get(`/patients/${pt.id}/`)
      const p = detail.data?.data || detail.data
      if (p) {
        const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ')
        setForm(f => ({
          ...f,
          patient_name: capitalizePersonName(fullName || f.patient_name),
          gender: p.gender || 'male',
          age: p.age != null && p.age !== '' ? String(p.age) : '',
          address_line1: p.address_line1 || '',
          city: p.city || '',
          state: p.state || '',
          guardian_name: capitalizePersonName(p.guardian_name || ''),
        }))
      }
    } catch {
      const fullName = [pt.first_name, pt.last_name].filter(Boolean).join(' ')
      setForm(f => ({
        ...f,
        patient_name: capitalizePersonName(fullName || f.patient_name),
        gender: pt.gender || 'male',
        guardian_name: capitalizePersonName(pt.guardian_name || ''),
      }))
    }
  }

  useEffect(() => {
    if (lookingUp || opdNewPersonSamePhone || looksLikeUhidInput) return
    const ten = lookupDigits.slice(-10)
    if (ten.length < 10) return
    if (!samePhoneFamilyList.length) return
    const key = `phone-${ten}`
    if (samePhoneModalDismissedKeyRef.current === key) return
    setSamePhoneFamilyModalOpen(true)
  }, [lookingUp, opdNewPersonSamePhone, lookupDigits, looksLikeUhidInput, samePhoneFamilyList.length])

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-base font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none'
  const lbl = 'text-sm font-bold text-gray-800 mb-1 block tracking-tight'
  // Light fill when record was loaded from lookup (receptionist sees “prefilled” fields)
  const filledBg = matchedPatient
    ? 'bg-emerald-50/90 border-emerald-200/90 ring-1 ring-inset ring-emerald-100/60 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400'
    : opdNewPersonSamePhone
      ? 'bg-amber-50/90 border-amber-200/90 ring-1 ring-inset ring-amber-100/60 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-400'
      : ''
  const inpFilled = `${inp} ${filledBg}`
  const lblFilled = matchedPatient ? `${lbl} text-emerald-900` : opdNewPersonSamePhone ? `${lbl} text-amber-900` : lbl

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">

      {/* ── Body ── */}
      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">

      {/* ── LEFT: Quick OPD Form ── */}
      <form onSubmit={handleSubmit}
        className="flex-1 w-full min-w-0 bg-white flex flex-col min-h-0 overflow-hidden">

        {/* Form header — flush under top bar; queue toggle inline */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-white shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-extrabold text-lg flex items-center gap-2"><Plus size={20} strokeWidth={2.5} /> New OPD Visit</h3>
            <p className="text-sm font-semibold text-emerald-100/95 leading-snug mt-0.5">Search by mobile or UHID, or register a new patient</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Daily Collection Capsule */}
            <button 
              type="button"
              onClick={() => setShowCollectionModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition-all group shrink-0"
            >
              <div className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                <IndianRupee size={10} strokeWidth={3} />
              </div>
              <div className="flex flex-col items-start leading-none pr-1">
                <span className="text-[9px] font-black text-emerald-50/70 uppercase tracking-tighter">Collection Summary</span>
                <span className="text-xs font-black text-white leading-tight">
                  ₹{collectionStats.total.toLocaleString('en-IN')}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowQueue(q => !q)}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-extrabold border-2 transition-all ${
                showQueue
                  ? 'bg-white text-emerald-700 border-white'
                  : 'bg-white/15 text-white border-white/50 hover:bg-white/25'
              }`}
            >
              <Activity size={16} strokeWidth={2.5} />
              Queue
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4 grid grid-cols-12 gap-x-3 gap-y-3 content-start auto-rows-min">

          {/* Phone / UHID — compact input; hints on the right in wide layout */}
          <div className="col-span-3">
            <label className={`${lblFilled} flex items-center gap-1.5`}>
              Phone or UHID *
              {showSamePhoneNewHint && (
                <span title="Registering new family member on this number" className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none">
                  <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                  New · Family link
                </span>
              )}
              {showNewPatientHint && (
                <span title="No existing record — will register as new patient" className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0.5 leading-none">
                  <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                  New patient
                </span>
              )}
              {showUhidNoMatchHint && (
                <span title="No patient found for this UHID" className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 leading-none">
                  <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                  No match
                </span>
              )}
            </label>
            <div className="relative w-full">
              <input
                value={form.phone}
                onChange={e => {
                  let v = e.target.value;
                  // If it's purely digits, cap at 10. If it has letters (UHID), allow up to 40.
                  if (/^\d+$/.test(v) && v.length > 10) v = v.slice(0, 10);
                  setForm(f => ({ ...f, phone: v }));
                }}
                placeholder="Mobile or UHID"
                maxLength={40}
                className={`${inpFilled} pr-8 w-full`}
                required
              />
              {lookingUp && (
                <span className="absolute right-2 top-2 w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              )}
              {lookupCandidates.length > 0 && !matchedPatient && (
                <ul className="absolute left-0 top-full z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {lookupCandidates.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => { void selectLookupCandidate(p) }}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50/60"
                      >
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {p.uhid || 'No UHID'} · {p.phone || 'No phone'}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {matchedPatient && looksLikeUhidInput && (
              <div className="mt-1 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 text-xs">
                <CheckCircle size={12} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                <span className="font-medium text-emerald-800 truncate">
                  {[matchedPatient.first_name, matchedPatient.last_name].filter(Boolean).join(' ')} · {matchedPatient.uhid}
                </span>
              </div>
            )}
            {showReopenSamePhoneFamilyModal && (
              <button
                type="button"
                onClick={reopenSamePhoneFamilyModal}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Family members on this number
              </button>
            )}
          </div>

          <div className="col-span-3">
            <label className={lblFilled}>Patient Name</label>
            <input value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: capitalizePersonName(sanitizePersonName(e.target.value)) }))} placeholder="Full Name" className={inpFilled} />
          </div>
          <div className="col-span-3">
            <label className={lblFilled}>Guardian / Relative Name</label>
            <input value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: capitalizePersonName(sanitizePersonName(e.target.value)) }))} placeholder="Guardian name" className={inpFilled} />
          </div>
          <div className="col-span-3">
            <label className={lblFilled}>Age</label>
            <input type="number" min="0" max="150" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="yrs" className={inpFilled} />
          </div>

          <div className="col-span-12">
            <label className={lblFilled}>Gender</label>
            <div className={`flex gap-2 max-w-md rounded-lg p-1 ${
              matchedPatient ? 'bg-emerald-50/80 ring-1 ring-inset ring-emerald-100/70'
                : opdNewPersonSamePhone ? 'bg-amber-50/80 ring-1 ring-inset ring-amber-100/70'
                : ''
            }`}>
              {[['male','Male'],['female','Female'],['other','Other']].map(([val, lblShort]) => (
                <button type="button" key={val}
                  onClick={() => setForm(f => ({ ...f, gender: val }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    form.gender === val
                      ? opdNewPersonSamePhone
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-emerald-600 text-white border-emerald-600'
                      : matchedPatient
                        ? 'bg-emerald-50/90 text-emerald-900 border-emerald-200/90'
                        : opdNewPersonSamePhone
                          ? 'bg-amber-50/90 text-amber-900 border-amber-200/90'
                          : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {lblShort}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-12">
            <label className={lblFilled}>Address</label>
            <input
              value={form.address_line1}
              onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
              placeholder="House / street / locality"
              className={`${inpFilled} mb-1`}
            />
            <div className={showQueue ? 'space-y-2' : 'grid grid-cols-2 gap-2'}>
              <input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="City / town"
                className={inpFilled}
              />
              <select
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className={inpFilled}
              >
                {[
                  'Andhra Pradesh',
                  'Arunachal Pradesh',
                  'Assam',
                  'Bihar',
                  'Chhattisgarh',
                  'Goa',
                  'Gujarat',
                  'Haryana',
                  'Himachal Pradesh',
                  'Jharkhand',
                  'Karnataka',
                  'Kerala',
                  'Madhya Pradesh',
                  'Maharashtra',
                  'Manipur',
                  'Meghalaya',
                  'Mizoram',
                  'Nagaland',
                  'Odisha',
                  'Punjab',
                  'Rajasthan',
                  'Sikkim',
                  'Tamil Nadu',
                  'Telangana',
                  'Tripura',
                  'Uttar Pradesh',
                  'Uttarakhand',
                  'West Bengal',
                  'Andaman and Nicobar Islands',
                  'Chandigarh',
                  'Dadra and Nagar Haveli and Daman and Diu',
                  'Delhi',
                  'Jammu and Kashmir',
                  'Ladakh',
                  'Lakshadweep',
                  'Puducherry',
                ].map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="col-span-2">
            <label className={lbl}>Visit date</label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={form.visit_date ? format(new Date(form.visit_date), 'd/M/yyyy') : ''}
                onClick={(e) => e.target.nextSibling.showPicker()}
                className={inp + " cursor-pointer bg-white"}
                placeholder="Select date..."
              />
              <input
                type="date"
                className="absolute inset-0 opacity-0 pointer-events-none"
                value={form.visit_date}
                onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="col-span-3">
            <label className={lbl}>Doctor</label>
            <select value={form.doctor} onChange={e => {
              opdAmountManuallyEditedRef.current = false
              const selectedDocId = e.target.value
              const selectedDoc = findDoctorBySelectedId(doctors, selectedDocId)
              const fee = getDoctorFee(selectedDoc)
              setForm(f => ({
                ...f,
                doctor: selectedDocId,
                amount: fee != null ? String(fee) : f.amount,
              }))
            }} className={inp}>
              <option value="">Walk-in / Any</option>
              {doctors.filter(d => getDoctorUserId(d)).map(d => (
                <option key={getDoctorUserId(d)} value={getDoctorUserId(d)}>
                  {d.name}{getDoctorFee(d) != null ? ` · ₹${getDoctorFee(d)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.amount}
                onKeyDown={e => {
                  if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault()
                }}
                onChange={e => {
                  opdAmountManuallyEditedRef.current = true
                  const next = e.target.value
                  if (next === '' || (/^\d+$/.test(next) && Number(next) >= 0)) {
                    setForm(f => ({ ...f, amount: next }))
                  }
                }}
                placeholder="0"
                className={`${inp} pl-7`}
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Payment</label>
            <select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className={inp}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className={lbl}>Chief complaint</label>
            <input value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))} placeholder="e.g. fever, follow-up" className={inp} />
          </div>



        </div>

        {/* Submit */}
        <div className="p-4 border-t border-gray-200 shrink-0 flex flex-col gap-2">
          <button type="submit" disabled={submitting} onClick={() => { submitActionRef.current = 'a4' }}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl text-base font-extrabold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-md">
            {submitting && submitActionRef.current === 'a4'
              ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
              : <><Printer size={18} strokeWidth={2.5} /> {matchedPatient ? 'Assign Token & Print A4 Sheet' : 'Register, Assign & Print A4 Sheet'}</>
            }
          </button>
          <button type="submit" disabled={submitting} onClick={() => { submitActionRef.current = 'thermal' }}
            className="w-full bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
            {submitting && submitActionRef.current === 'thermal'
              ? <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              : 'Assign Token & Show Thermal Option'
            }
          </button>
          <p className="text-center text-xs font-bold text-gray-500 leading-tight mt-1">
            {matchedPatient
              ? 'Patient found — edit details above if needed; saved when you assign token'
              : opdNewPersonSamePhone
                ? 'Registers a new patient on this number and links the family record (same mobile as an existing patient)'
                : 'Creates patient record if new'}
          </p>
        </div>
      </form>

      </div>{/* end body */}

      {/* ── Queue popup overlay ── */}
      {showQueue && (
        <div
          className="fixed inset-0 z-[150] flex items-start justify-end"
          onClick={() => setShowQueue(false)}
        >
          <div
            className="relative bg-white h-full w-full max-w-lg shadow-2xl flex flex-col border-l border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 bg-gray-50/80">
              <Activity size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
              <span className="font-semibold text-gray-800 text-sm flex-1">Today's OPD Queue</span>
              
              {/* Daily Collection Capsule */}
              <button 
                onClick={() => setShowCollectionModal(true)}
                className="flex items-center gap-2 px-2.5 py-1 bg-white border border-emerald-100 rounded-full shadow-sm hover:shadow-md hover:bg-emerald-50 transition-all group shrink-0"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <IndianRupee size={10} strokeWidth={3} />
                </div>
                <div className="flex flex-col items-start leading-none pr-1">
                  <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-tighter">Collection</span>
                  <span className="text-xs font-black text-emerald-700 leading-tight">
                    ₹{collectionStats.total.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>
              <Search size={15} className="text-gray-400 shrink-0" strokeWidth={2} />
              <input
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                placeholder="Search…"
                className="text-sm outline-none w-36 border-b border-gray-200 pb-0.5 focus:border-emerald-500 placeholder:text-gray-400"
              />
              <button type="button" onClick={fetchQueue} className="text-gray-400 hover:text-emerald-600">
                <RefreshCw size={15} strokeWidth={2} />
              </button>
              <button type="button" onClick={() => setShowQueue(false)} className="text-gray-400 hover:text-gray-700 ml-1">
                <XCircle size={20} strokeWidth={1.8} />
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 px-4 py-2 bg-gray-100/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wide shrink-0">
              <div className="col-span-1">Token</div>
              <div className="col-span-4">Patient</div>
              <div className="col-span-3">Doctor</div>
              <div className="col-span-2">Complaint</div>
              <div className="col-span-2 text-right">Status</div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {loading ? (
                <div className="text-center py-12 text-sm text-gray-400">Loading…</div>
              ) : filteredVisits.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Activity size={36} className="mx-auto mb-3 opacity-30" strokeWidth={2} />
                  <p className="text-sm font-medium text-gray-500">No visits today yet</p>
                </div>
              ) : filteredVisits.map(v => (
                <div key={v.id} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-gray-50 group transition-colors">
                  <div className="col-span-1">
                    <div className={`w-9 h-9 rounded-lg font-bold text-sm flex items-center justify-center ${
                      ['in_progress','in_consultation'].includes(v.status) ? 'bg-blue-600 text-white' :
                      v.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {v.token_number || v.queue_number || '—'}
                    </div>
                  </div>
                  <div className="col-span-4 pl-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {capitalizePersonName(v.patient_name || 'Patient')}
                      {v.patient_uhid && <span className="ml-1 text-[11px] font-mono text-gray-400">({v.patient_uhid})</span>}
                    </p>
                    {v.patient_guardian_name && (
                      <p className="text-[10px] text-gray-500 truncate">G: {capitalizePersonName(v.patient_guardian_name)}</p>
                    )}
                    {v.created_by_name && <p className="text-[10px] text-gray-400 font-bold">By: {v.created_by_name}</p>}
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-xs text-gray-500 truncate">{v.doc_name || '—'}</p>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="text-xs text-gray-400 truncate">{v.chief_complaint || '—'}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge[v.status] || 'bg-gray-100 text-gray-600'}`}>
                      {v.status?.replace(/_/g, ' ')}
                    </span>
                    <button onClick={() => setPrintVisit(v)}
                      className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Printer size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {printVisit && <PrintSlip visit={printVisit} onClose={() => setPrintVisit(null)} />}
      {samePhoneFamilyModalOpen && samePhoneFamilyList.length > 0 && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="same-phone-family-title"
          onClick={closeSamePhoneFamilyModalBackdrop}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: 'min(90vh, 30rem)' }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <div>
                <p id="same-phone-family-title" className="text-base font-semibold text-gray-900">
                  {samePhoneFamilyList.length === 1 ? 'Patient on this number' : `${samePhoneFamilyList.length} patients on this number`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Select a patient or register a new one</p>
              </div>
              <button
                type="button"
                onClick={closeSamePhoneFamilyModalBackdrop}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <XCircle size={20} strokeWidth={1.8} />
              </button>
            </div>

            {/* ── Patient list ── */}
            <ul className="px-4 py-3 space-y-2 overflow-y-auto flex-1 min-h-0">
              {samePhoneFamilyList.map((p, idx) => {
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient'
                const genderLabel = p.gender === 'female' ? 'Female' : p.gender === 'male' ? 'Male' : 'Other'
                const genderColor = p.gender === 'female'
                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                  : p.gender === 'male'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                const selected = matchedPatient?.id === p.id
                const initials = ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase() || '#'
                const avatarColor = [
                  'bg-emerald-100 text-emerald-700',
                  'bg-violet-100 text-violet-700',
                  'bg-amber-100 text-amber-700',
                  'bg-sky-100 text-sky-700',
                  'bg-rose-100 text-rose-700',
                ][idx % 5]
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectPatientFromFamilyModal(p)}
                      onDoubleClick={async () => {
                        await selectPatientFromFamilyModal(p);
                        confirmSamePhoneUseExistingPatient();
                      }}
                      className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all border ${
                        selected
                          ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                          : 'border-gray-100 bg-gray-50/60 hover:border-emerald-200 hover:bg-emerald-50/40'
                      }`}
                    >
                      {/* Avatar */}
                      <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${avatarColor}`}>
                        {initials}
                      </span>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm truncate ${selected ? 'font-semibold text-gray-900' : 'font-normal text-gray-800'}`}>
                            {name}
                          </p>
                          {selected && <CheckCircle size={14} className="text-emerald-500 shrink-0" strokeWidth={2.5} />}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{p.uhid}</p>
                      </div>
                      {/* Gender badge */}
                      <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${genderColor}`}>
                        {genderLabel}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* ── Actions ── */}
            <div className="px-4 pb-4 pt-2 space-y-2 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={confirmSamePhoneUseExistingPatient}
                disabled={!matchedPatient}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle size={16} strokeWidth={2} />
                Continue with selected patient
              </button>
              <button
                type="button"
                onClick={startAddAnotherPersonSamePhone}
                className="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus size={16} strokeWidth={2} className="text-emerald-600" />
                Register new person on this number
              </button>
            </div>
          </div>
        </div>
      )}

      {showCollectionModal && (
        <CollectionSummaryModal 
          stats={collectionStats} 
          entries={collectionEntries}
          recipients={handoverRecipients}
          pendingHandovers={pendingHandovers}
          onHandoverSuccess={fetchHandoverSummary}
          onClose={() => setShowCollectionModal(false)} 
        />
      )}
      </div>
    </>
  )
}

function CollectionSummaryModal({ stats, entries, recipients, pendingHandovers, onHandoverSuccess, onClose }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState('')
  const [declaredCashAmount, setDeclaredCashAmount] = useState(stats.cash > 0 ? String(stats.cash) : '')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const itemsPerPage = 10
  
  const paidEntries = (entries || []).filter(v => parseFloat(v.amount) > 0)
  const totalPages = Math.ceil(paidEntries.length / itemsPerPage)
  
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentItems = paidEntries.slice(startIndex, startIndex + itemsPerPage)

  async function submitHandover() {
    if (!selectedRecipient) {
      toast.error('Select recipient first')
      return
    }
    setActionLoading(true)
    try {
      await api.post('/handovers/initiate/', {
        to_user_id: selectedRecipient,
        declared_cash_amount: declaredCashAmount || '0',
        notes: handoverNotes,
      })
      toast.success('Handover request sent')
      setDeclaredCashAmount('')
      setHandoverNotes('')
      setSelectedRecipient('')
      if (onHandoverSuccess) await onHandoverSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.errors?.detail?.[0] || 'Failed to initiate handover')
    } finally {
      setActionLoading(false)
    }
  }

  async function verifyPending(handoverId, action) {
    setActionLoading(true)
    try {
      await api.post('/handovers/verify/', { handover_id: handoverId, action })
      toast.success(action === 'accept' ? 'Handover accepted' : 'Handover rejected')
      if (onHandoverSuccess) await onHandoverSuccess()
    } catch {
      toast.error('Failed to process handover')
    } finally {
      setActionLoading(false)
    }
  }

  const hasOpeningCash = Number(stats.openingCash || 0) > 0
  
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <Receipt size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-tight">Daily Collection Summary</h2>
              <p className="text-emerald-100 text-xs font-bold tracking-wide uppercase">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHandoverModal(true)}
              className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-black uppercase tracking-wide hover:bg-white/25 transition-colors"
            >
              Shift Handover
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors">
              <XCircle size={24} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <div className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center"><CreditCard size={14} /></div>
                <span className="text-[11px] font-black uppercase tracking-wider">Cash Total</span>
              </div>
              <p className="text-2xl font-black text-gray-900 leading-none">₹{stats.cash.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center"><RefreshCw size={14} /></div>
                <span className="text-[11px] font-black uppercase tracking-wider">UPI Total</span>
              </div>
              <p className="text-2xl font-black text-gray-900 leading-none">₹{stats.upi.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm border-emerald-500 bg-emerald-50/20">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center"><Tag size={14} /></div>
                <span className="text-[11px] font-black uppercase tracking-wider">Other Total</span>
              </div>
              <p className="text-2xl font-black text-gray-900 leading-none">₹{stats.other.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-700 flex items-center gap-2">
                <Activity size={16} className="text-emerald-500" />
                Transaction List
              </h3>
              <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">{paidEntries.length} Payments</span>
            </div>
            <div className="divide-y divide-gray-100/50 overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/50">
                <div className="col-span-1">TKN</div>
                <div className="col-span-4">Patient Name</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-2 text-right">Mode</div>
                <div className="col-span-3 text-right">Created By</div>
              </div>
              <div className="max-h-[450px] overflow-y-auto">
                {paidEntries.length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-400 italic text-sm">No collections recorded today</div>
                ) : (
                  <>
                    {hasOpeningCash && (
                      <div className="grid grid-cols-12 px-4 py-2.5 items-center bg-emerald-50/60 border-b border-emerald-100 text-sm">
                        <div className="col-span-1 font-mono font-bold text-emerald-700">#--</div>
                        <div className="col-span-4 font-bold text-emerald-800 truncate">Opening Cash In Hand</div>
                        <div className="col-span-2 text-right font-black text-emerald-900">₹{Number(stats.openingCash || 0).toLocaleString('en-IN')}</div>
                        <div className="col-span-2 text-right">
                          <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                            opening
                          </span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">handover</span>
                        </div>
                      </div>
                    )}
                    {currentItems.map(v => (
                      <div key={v.id} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-white text-sm transition-colors group">
                        <div className="col-span-1 font-mono font-bold text-gray-400 group-hover:text-emerald-600 transition-colors">
                          {v.entry_type === 'payment' ? 'P' : `#${v.token_number || v.queue_number || '--'}`}
                        </div>
                        <div className="col-span-4 font-bold text-gray-800 truncate">{v.patient_name}</div>
                        <div className="col-span-2 text-right font-black text-gray-900">₹{v.amount}</div>
                        <div className="col-span-2 text-right">
                          <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${
                            v.payment_mode === 'upi' ? 'bg-blue-100 text-blue-700' :
                            v.payment_mode === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {v.payment_mode || 'cash'}
                          </span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{v.created_by_name || '—'}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center justify-between">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, paidEntries.length)} of {paidEntries.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-all"
                  >
                    <ChevronLeft size={16} strokeWidth={3} />
                  </button>
                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                          currentPage === i + 1
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-all"
                  >
                    <ChevronRight size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 italic">Totals represent unsettled shift collection.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-500 uppercase">Grand Total:</span>
            <span className="text-xl font-black text-emerald-700">₹{stats.total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
      {showHandoverModal && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={() => setShowHandoverModal(false)}>
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 bg-emerald-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black leading-tight">Shift Handover</h3>
                <p className="text-[11px] font-bold text-emerald-100 uppercase tracking-wide">Transfer and verify cash responsibility</p>
              </div>
              <button type="button" onClick={() => setShowHandoverModal(false)} className="p-1.5 rounded-full hover:bg-white/10">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Current Cash In Hand</p>
                <p className="text-xl font-black text-emerald-800">₹{Number(stats.cash || 0).toLocaleString('en-IN')}</p>
              </div>

              {pendingHandovers?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-700">Pending Verification</p>
                  {pendingHandovers.map(h => (
                    <div key={h.id} className="rounded-lg bg-white border border-amber-100 p-3">
                      <p className="text-sm font-bold text-gray-800">
                        {h.from_user_name} is handing over ₹{Number(h.declared_cash_amount || 0).toLocaleString('en-IN')} cash
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        System Cash: ₹{Number(h.system_cash_amount || 0).toLocaleString('en-IN')} | UPI: ₹{Number(h.system_upi_amount || 0).toLocaleString('en-IN')}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => verifyPending(h.id, 'accept')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Verify & Accept
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => verifyPending(h.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-gray-600">Initiate Handover</p>
                <select
                  value={selectedRecipient}
                  onChange={e => setSelectedRecipient(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Select recipient</option>
                  {(recipients || []).map(r => <option key={r.id} value={r.id}>{r.name} ({r.email})</option>)}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={declaredCashAmount}
                  onChange={e => setDeclaredCashAmount(e.target.value)}
                  placeholder="Physical Cash Counted"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <input
                  type="text"
                  value={handoverNotes}
                  onChange={e => setHandoverNotes(e.target.value)}
                  placeholder="Optional note (shortage/excess remarks)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={submitHandover}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  Send Handover Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Staff Attendance ────────────────────────────────────────────────────────
function StaffAttendanceSection() {
  const [staff, setStaff] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [sRes, aRes] = await Promise.all([
        api.get('/staff/?limit=1000&employment_status=active'),
        api.get(`/attendance/daily-records/?attendance_date=${today}&limit=1000`)
      ])
      // Backend returns { success: true, data: [...] } or results: [...]
      const sData = sRes.data?.data || sRes.data?.results || sRes.data || []
      const aData = aRes.data?.data || aRes.data?.results || aRes.data || []
      setStaff(Array.isArray(sData) ? sData : [])
      setRecords(Array.isArray(aData) ? aData : [])
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  async function handlePunch(staffId, action) {
    try {
      await api.post(`/attendance/daily-records/${action}/`, { staff_id: staffId })
      toast.success(action === 'check-in' ? 'Staff clocked in' : 'Staff clocked out')
      fetchData()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Punch failed')
    }
  }

  const filteredStaff = staff.filter(s => 
    !search || 
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    (s.employee_code || '').toLowerCase().includes(search.toLowerCase())
  )

  const staffWithStatus = filteredStaff.map(s => {
    const record = records.find(r => r.staff === s.id)
    return { ...s, record }
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
            <Clock size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-extrabold text-gray-800 tracking-tight">Staff Attendance</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest opacity-60">
              {format(new Date(), 'EEEE, dd MMMM')}
            </p>
          </div>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-gray-700 shadow-sm transition-all"
          />
        </div>
        <button onClick={fetchData} className="p-2 text-gray-400 hover:text-emerald-600 transition-colors">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold uppercase tracking-widest opacity-50">Syncing Records...</p>
          </div>
        ) : staffWithStatus.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-60">
            <Users size={48} className="mb-4" />
            <p className="text-lg font-bold">No Staff Found</p>
            <p className="text-sm">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {staffWithStatus.map(s => {
              const checkedIn = s.record?.check_in_at
              const checkedOut = s.record?.check_out_at
              const initials = ((s.first_name?.[0] || '') + (s.last_name?.[0] || '')).toUpperCase()
              return (
                <div key={s.id} className={`group rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col ${
                  checkedIn ? 'bg-white border-emerald-200 ring-4 ring-emerald-50 shadow-lg shadow-emerald-100/50 scale-[1.02] z-10' :
                  'bg-white border-gray-100 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-50 hover:-translate-y-1'
                }`}>
                  {/* Status Indicator Bar */}
                  <div className={`h-1 w-full absolute top-0 left-0 transition-colors ${
                    checkedIn ? 'bg-emerald-500' : 'bg-red-400'
                  }`} />

                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all shadow-md ${
                          checkedIn ? 'bg-emerald-600 text-white rotate-3 group-hover:rotate-0' :
                          'bg-red-600 text-white -rotate-3 group-hover:rotate-0'
                        }`}>
                          {initials || <User size={20} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-gray-800 text-sm truncate leading-tight">
                            {s.first_name} {s.last_name}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mt-0.5 truncate">
                            {s.designation_name || s.employee_code || 'Staff'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm ${
                        checkedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600 border border-red-100'
                      }`}>
                        {checkedIn ? 'Present' : 'Absent'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-gray-50/80 rounded-xl p-2 border border-gray-100 text-center transition-colors group-hover:bg-white group-hover:shadow-inner">
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-tighter mb-0.5 opacity-60 text-left">Shift Start</p>
                        <p className={`text-sm font-black ${checkedIn ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {checkedIn ? format(new Date(checkedIn), 'HH:mm') : '--:--'}
                        </p>
                      </div>
                      <div className="bg-gray-50/80 rounded-xl p-2 border border-gray-100 text-center transition-colors group-hover:bg-white group-hover:shadow-inner">
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-tighter mb-0.5 opacity-60 text-left">Shift End</p>
                        <p className={`text-sm font-black ${checkedOut ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {checkedOut ? format(new Date(checkedOut), 'HH:mm') : '--:--'}
                        </p>
                      </div>
                    </div>

                    {!checkedOut ? (
                      <button
                        onClick={() => handlePunch(s.id, checkedIn ? 'check-out' : 'check-in')}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border-2 ${
                          checkedIn 
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600'
                            : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 shadow-lg shadow-emerald-100'
                        }`}
                      >
                        {checkedIn ? <LogOut size={14} /> : <Clock size={14} />}
                        {checkedIn ? 'Punch Out' : 'Punch In Now'}
                      </button>
                    ) : (
                      <div className="py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center gap-2">
                        <CheckCircle size={14} className="text-green-500" /> Complete
                      </div>
                    )}
                  </div>

                  {checkedIn && !checkedOut && (
                    <div className="px-4 py-2 bg-emerald-600 text-[9px] text-white font-black text-center uppercase tracking-widest">
                      Session Active
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** When ward and room match (e.g. bed picker sets room = ward), show one label + bed, not "Ward / Ward / Bed". */
function formatIpdBedAllocationLine(wardName, roomName, bedCode) {
  const w = String(wardName ?? '').trim()
  const r = String(roomName ?? '').trim()
  const b = String(bedCode ?? '').trim()
  if (w && r && w.toLowerCase() === r.toLowerCase()) {
    return `${w || '--'} / ${b || '--'}`
  }
  return `${w || '--'} / ${r || '--'} / ${b || '--'}`
}

function formatWardRoomReceiptLabel(wardName, roomName) {
  const w = String(wardName ?? '').trim()
  const r = String(roomName ?? '').trim()
  if (w && r && w.toLowerCase() === r.toLowerCase()) return w
  if (!w && !r) return '—'
  return `${w || '—'} / ${r || '—'}`
}

/** IPD admit slip: use `ipdNo` (ledger IPD ID), not the admission UUID. */
function printIpdAdmitSlip({
  ipdNo,
  admissionDate,
  patientName,
  patientUhid,
  patientPhone,
  doctorName,
  department,
  wardName,
  roomName,
  bedCode,
  bedPrice,
  diagnosis,
  notes,
}) {
  const w = createSameTabPrintWindow()
  const slipProfile = getPaymentSlipProfile()
  const hospitalName = slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name
  const address = slipProfile.address || DEFAULT_PAYMENT_SLIP_PROFILE.address
  const pinCode = slipProfile.pin_code || DEFAULT_PAYMENT_SLIP_PROFILE.pin_code
  const phone = slipProfile.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone
  const email = slipProfile.email || DEFAULT_PAYMENT_SLIP_PROFILE.email
  const website = slipProfile.website || DEFAULT_PAYMENT_SLIP_PROFILE.website
  const now = format(new Date(), 'd/M/yyyy HH:mm:ss')
  const admitDate = admissionDate ? format(new Date(admissionDate), 'd/M/yyyy') : format(new Date(), 'd/M/yyyy')
  const bedPriceNum = Number(String(bedPrice || '').replace(/,/g, ''))
  const hasBedPrice = Number.isFinite(bedPriceNum) && bedPriceNum > 0
  const bedPriceFixed = hasBedPrice ? bedPriceNum.toFixed(2) : '0.00'
  const safe = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const bedAllocationLine = formatIpdBedAllocationLine(wardName, roomName, bedCode)

  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>IPD Admit Slip — ${safe(ipdNo || 'New')}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #111; width: 210mm; background: #fff; }
      .slip { width: 210mm; min-height: 148.5mm; padding: 6mm 8mm 5mm; display: flex; flex-direction: column; border-bottom: 2px dashed #aaa; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 4mm; border-bottom: 2px solid #111; margin-bottom: 3mm; }
      .hosp-name { font-size: 22px; font-weight: 900; color: #1a6b3f; letter-spacing: -0.5px; line-height: 1; margin-bottom: 2px; }
      .hosp-tag { font-size: 9px; color: #555; letter-spacing: 0.5px; text-transform: uppercase; }
      .address { text-align: right; font-size: 9.5px; color: #333; line-height: 1.55; }
      .address strong { font-size: 10px; }
      .receipt-title { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #111; padding-bottom: 2mm; margin-bottom: 2.5mm; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5mm 4mm; margin-bottom: 2.5mm; font-size: 10px; }
      .info-cell { display: flex; flex-direction: column; gap: 1px; }
      .info-label { color: #666; font-size: 9px; }
      .info-val { font-weight: 700; color: #111; word-break: break-word; }
      table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 2.5mm; }
      thead tr { background: #1a6b3f; color: #fff; }
      th { padding: 3px 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
      th.c { text-align: center; width: 26px; }
      th.l { text-align: left; }
      th.r { text-align: right; width: 80px; }
      tbody tr { border-bottom: 1px solid #e5e7eb; }
      tbody tr:last-child { border-bottom: 1.5px solid #111; }
      td { padding: 3px 5px; }
      td.c { text-align: center; color: #555; }
      td.l { text-align: left; }
      td.r { text-align: right; font-weight: 700; }
      .totals { margin-left: auto; width: 170px; margin-top: 1.5mm; font-size: 10.5px; }
      .t-row { display: flex; justify-content: space-between; padding: 1px 5px; }
      .t-row.disc { color: #dc2626; }
      .t-row.final { font-weight: 800; font-size: 12px; border-top: 2px solid #111; padding-top: 2px; margin-top: 2px; color: #1a6b3f; }
      .section-wrap { margin-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
      .section { margin-top: 0; }
      .section-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 700; letter-spacing: .4px; }
      .section-val { margin-top: 1.5mm; font-size: 11.5px; color: #111; line-height: 1.6; white-space: pre-wrap; }
      .footer { margin-top: auto; padding-top: 2.5mm; border-top: 1px dashed #aaa; display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; font-size: 9px; color: #555; }
      .note { max-width: 62%; line-height: 1.5; }
      .status-box { border: 2px solid #1a6b3f; color: #1a6b3f; font-weight: 900; font-size: 12px; padding: 2px 10px; border-radius: 4px; letter-spacing: 1.5px; }
      .sig { text-align: right; margin-top: 6mm; }
      .sig-line { width: 45mm; border-top: 1px solid #9ca3af; margin-left: auto; margin-bottom: 2px; }
    </style>
  </head><body>
    <div class="slip">
      <div class="top">
        <div>
          <div class="hosp-name">${safe(hospitalName)}</div>
          <div class="hosp-tag">Healthcare &amp; Diagnostics</div>
        </div>
        <div class="address">
          <strong>${safe(address)}</strong><br/>
          Pincode: ${safe(pinCode)}<br/>
          Phone: ${safe(phone)}<br/>
          Email: ${safe(email)}${website ? `<br/>Website: ${safe(website)}` : ''}
        </div>
      </div>

      <div class="receipt-title">IPD Admission Slip</div>

        <div class="info-grid">
        <div class="info-cell"><span class="info-label">IPD ID</span><span class="info-val">${safe(ipdNo || '--')}</span></div>
        <div class="info-cell"><span class="info-label">Admission Date</span><span class="info-val">${safe(admitDate)}</span></div>
        <div class="info-cell"><span class="info-label">Generated At</span><span class="info-val">${safe(now)}</span></div>
        <div class="info-cell"><span class="info-label">Patient Name</span><span class="info-val">${safe(patientName || 'Patient')}</span></div>
        <div class="info-cell"><span class="info-label">UHID</span><span class="info-val">${safe(patientUhid || '--')}</span></div>
        <div class="info-cell"><span class="info-label">Mobile No.</span><span class="info-val">${safe(patientPhone || '--')}</span></div>
        <div class="info-cell"><span class="info-label">Department</span><span class="info-val">${safe(department || '--')}</span></div>
        <div class="info-cell"><span class="info-label">Assigned Doctor</span><span class="info-val">${safe(doctorName || '--')}</span></div>
        <div class="info-cell"><span class="info-label">Bed Allocation</span><span class="info-val">${safe(bedAllocationLine)}</span></div>
          <div class="info-cell"><span class="info-label">Bed Price (Per Day)</span><span class="info-val">₹${hasBedPrice ? bedPriceFixed : '--'}</span></div>
      </div>

      <div class="section-wrap">
        <div class="section">
          <div class="section-lbl">Admission Diagnosis</div>
          <div class="section-val">${safe(diagnosis || '--')}</div>
        </div>
        <div class="section">
          <div class="section-lbl">Admission Notes</div>
          <div class="section-val">${safe(notes || '--')}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="c">SL No.</th>
            <th class="l">Charge Head</th>
            <th class="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="c">1</td>
            <td class="l">Bed Charge (Per Day)</td>
            <td class="r">₹${bedPriceFixed}</td>
          </tr>
        </tbody>
      </table>
      <div class="totals">
        <div class="t-row"><span>Total Amount:</span><span>₹${bedPriceFixed}</span></div>
        <div class="t-row disc"><span>Discount:</span><span>₹0.00</span></div>
        <div class="t-row final"><span>Net Amount:</span><span>₹${bedPriceFixed}</span></div>
      </div>

      <div class="footer">
        <div class="note">
          <strong>Note:</strong> Please keep this slip for IPD desk verification, billing, and internal ward handover records.
        </div>
        <div>
          <div class="status-box">ADMITTED</div>
          <div class="sig">
            <div class="sig-line"></div>
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
    ${PRINT_WINDOW_CLOSE_SCRIPT}
  </body></html>`)
  w.document.close()
}

// ─── IPD Admissions ───────────────────────────────────────────────────────────
function IPDSection({ mode, initialAdmissionDraft }) {
  const [admissions, setAdmissions] = useState([])
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [bedPriceMap, setBedPriceMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    setPage(0)
  }, [search])

  const [form, setForm] = useState({
    patient: '', assigned_doctor: '', department: '', ward_name: '', bed_code: '',
    admission_date: format(new Date(), 'yyyy-MM-dd'), admission_diagnosis: '', admission_notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState(null)
  const [autoDischarge, setAutoDischarge] = useState(false)
  const [showBedPicker, setShowBedPicker] = useState(false)
  const [pickedBed, setPickedBed] = useState(null)

  const [ptSearch, setPtSearch] = useState('')
  const [ptResults, setPtResults] = useState([])
  const [ptSearching, setPtSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newPt, setNewPt] = useState({ name: '', phone: '', address: '', gender: '' })

  const [showPayments, setShowPayments] = useState(null) // admission object
  const [showAddCharge, setShowAddCharge] = useState(null) // admission object
  const [editingAdmission, setEditingAdmission] = useState(null)
  const [autoPrintAdmitSlip, setAutoPrintAdmitSlip] = useState(false)
  const [timelineFor, setTimelineFor] = useState(null)
  const lastAppliedDraftRef = useRef('')
  const splitName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
    }
  }

  useEffect(() => {
    fetchAdmissions()
    fetchPatients()
    fetchDoctors()
    fetchDepartments()
    fetchBedPrices()
  }, [mode])

  useEffect(() => {
    if (mode !== 'new_admission') return
    const draft = initialAdmissionDraft
    if (!draft?.id) return
    const draftKey = String(draft.id)
    if (lastAppliedDraftRef.current === draftKey) return

    const nameParts = splitName(draft.patient_name)
    const instantPatient = {
      id: draft.patient_id || '',
      uhid: draft.patient_uhid || '',
      phone: draft.patient_phone || '',
      first_name: nameParts.first_name,
      last_name: nameParts.last_name,
    }

    // Instant prefill: do not wait for full patient list API.
    setSelectedPatient(instantPatient)
    setIsAddingNew(false)
    setPtSearch('')
    setPtResults([])
    setForm((prev) => ({
      ...prev,
      patient: draft.patient_id || prev.patient || '',
      assigned_doctor: draft.doctor_user || prev.assigned_doctor || '',
      admission_date: format(new Date(), 'yyyy-MM-dd'),
      admission_diagnosis: draft.visit_reason || prev.admission_diagnosis || '',
      admission_notes: draft.notes || prev.admission_notes || '',
    }))
    lastAppliedDraftRef.current = draftKey

    // Optional enrichment in background (when patient list arrives).
    const matchedPatient = patients.find((p) => String(p.id) === String(draft.patient_id))
      || patients.find((p) => String(p.uhid || '').toLowerCase() === String(draft.patient_uhid || '').toLowerCase())
    if (matchedPatient) {
      setSelectedPatient(matchedPatient)
      setForm((prev) => ({ ...prev, patient: matchedPatient.id }))
    }
  }, [mode, initialAdmissionDraft, patients])

  async function fetchAdmissions() {
    setLoading(true)
    try {
      const { data } = await api.get('/ipd-admissions/?status=admitted&limit=500')
      setAdmissions(data?.data || data?.results || data || [])
    } catch { toast.error('Failed to load IPD admissions') }
    finally { setLoading(false) }
  }

  async function fetchPatients() {
    try {
      const { data } = await api.get('/patients/?limit=500')
      setPatients(data?.data || data?.results || data || [])
    } catch {}
  }

  async function fetchDoctors() {
    try {
      const { data } = await api.get('/doctor-profiles/?limit=500')
      setDoctors(data?.data || data?.results || data || [])
    } catch {}
  }

  async function fetchDepartments() {
    try {
      const { data } = await api.get('/departments/?limit=500')
      setDepartments(Array.isArray(data?.data) ? data.data : (data?.results || data || []))
    } catch {}
  }

  async function fetchBedPrices() {
    try {
      const { data } = await api.get('/beds/beds/by-floor/')
      const floors = Array.isArray(data?.data) ? data.data : (data || [])
      const priceByCode = {}
      for (const floor of floors) {
        for (const room of (floor?.rooms || [])) {
          const roomCharge = Number(room?.daily_charge || 0)
          for (const bed of (room?.beds || [])) {
            if (bed?.bed_code) priceByCode[String(bed.bed_code)] = roomCharge
          }
        }
      }
      setBedPriceMap(priceByCode)
    } catch {}
  }

  useEffect(() => {
    if (ptSearch.trim().length < 2) { setPtResults([]); return }
    const t = setTimeout(async () => {
      setPtSearching(true)
      try {
        const { data } = await api.get(`/patients/?search=${encodeURIComponent(ptSearch)}&limit=8`)
        setPtResults(Array.isArray(data?.data) ? data.data : (data?.results || []))
      } catch { setPtResults([]) }
      finally { setPtSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [ptSearch])

  function handleBedSelect(bedInfo) {
    setPickedBed(bedInfo)
    setForm(f => ({
      ...f,
      bed_code: bedInfo.bed_code,
      ward_name: bedInfo.ward_name,
      room_name: bedInfo.room_name,
    }))
  }

  async function submitAdmission(e) {
    e.preventDefault()
    
    let targetPatientId = selectedPatient?.id
    let currentPatient = selectedPatient

    if (isAddingNew) {
      if (!newPt.name.trim()) { toast.error('Patient name is required'); return }
      if (/\d/.test(newPt.name || '')) { toast.error('Patient name cannot contain numbers'); return }
      if (!newPt.gender) { toast.error('Please select patient gender'); return }
      if ((newPt.phone || '').replace(/\D/g, '').length >= 10) {
        try {
          const ten = (newPt.phone || '').replace(/\D/g, '').slice(-10)
          const existingByPhone = await api.get(`/patients/by-phone/?phone=${encodeURIComponent(ten)}`)
          const matches = Array.isArray(existingByPhone.data?.data) ? existingByPhone.data.data : []
          if (matches.length > 0) {
            toast.error(`Patient already exists with this phone. Select existing patient UHID ${matches[0].uhid}.`)
            setIsAddingNew(false)
            setPtSearch(newPt.phone)
            setPtResults(matches)
            setSubmitting(false)
            return
          }
        } catch {}
      }
      setSubmitting(true)
      try {
        const parts = newPt.name.trim().split(/\s+/)
        const payload = {
          first_name: parts[0] || 'New',
          last_name: parts.slice(1).join(' ') || 'Patient',
          gender: newPt.gender,
          phone: newPt.phone || '',
          address_line1: newPt.address || '',
        }
        const { data } = await api.post('/patients/', payload)
        const created = data?.data || data?.entity || data
        targetPatientId = created.id
        currentPatient = created
      } catch (err) {
        toast.error('Failed to create new patient'); setSubmitting(false); return
      }
    }

    if (!targetPatientId) { toast.error('Select or Register a patient first'); return }
    if (!form.department) { toast.error('Select department'); return }
    if (!form.bed_code) { toast.error('Select a bed first'); return }

    setSubmitting(true)
    try {
      const { data } = await api.post('/ipd-admissions/', { ...form, patient: targetPatientId })
      const admitted = data?.data || data?.entity || data
      if (autoPrintAdmitSlip) {
        const doc = doctors.find(d => (d.user || d.id) === form.assigned_doctor)
        printIpdAdmitSlip({
          ipdNo: admitted?.ipd_no,
          admissionDate: admitted?.admission_date || form.admission_date,
          patientName: [currentPatient?.first_name, currentPatient?.last_name].filter(Boolean).join(' ') || currentPatient?.name,
          patientUhid: currentPatient?.uhid,
          patientPhone: currentPatient?.phone || newPt.phone,
          doctorName: doc?.name || [doc?.first_name, doc?.last_name].filter(Boolean).join(' '),
          department: form.department,
          wardName: form.ward_name,
          roomName: form.room_name,
          bedCode: form.bed_code,
          bedPrice: pickedBed?.daily_charge ? Number(pickedBed.daily_charge).toLocaleString('en-IN') : '--',
          diagnosis: form.admission_diagnosis,
          notes: form.admission_notes,
        })
      }
      toast.success('Patient admitted successfully!')
      setForm({
        patient: '', assigned_doctor: '', department: '', ward_name: '', bed_code: '',
        admission_date: format(new Date(), 'yyyy-MM-dd'), admission_diagnosis: '', admission_notes: '',
      })
      setAutoPrintAdmitSlip(false)
      setSelectedPatient(null)
      setIsAddingNew(false)
      setNewPt({ name: '', phone: '', address: '', gender: '' })
      setPickedBed(null)
      fetchAdmissions()
    } catch (err) {
      const patientErr = err?.response?.data?.patient?.[0] || err?.response?.data?.errors?.patient?.[0]
      toast.error(patientErr || err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Error admitting patient')
    } finally { setSubmitting(false) }
  }

  function reprintAdmitSlip(admission) {
    const patientRow = patients.find(p => String(p.id) === String(admission.patient))
    const doc = doctors.find(d => (d.user || d.id) === admission.assigned_doctor)
    const bedPrice = bedPriceMap[String(admission.bed_code || '')]
    printIpdAdmitSlip({
      ipdNo: admission.ipd_no,
      admissionDate: admission.admission_date,
      patientName: admission.patient_name || [patientRow?.first_name, patientRow?.last_name].filter(Boolean).join(' '),
      patientUhid: admission.patient_uhid || patientRow?.uhid,
      patientPhone: patientRow?.phone || '',
      doctorName: doc?.name || [doc?.first_name, doc?.last_name].filter(Boolean).join(' ') || admission.assigned_doctor_email,
      department: admission.department,
      wardName: admission.ward_name,
      roomName: admission.room_name,
      bedCode: admission.bed_code,
      bedPrice: Number.isFinite(bedPrice) && bedPrice > 0 ? Number(bedPrice).toLocaleString('en-IN') : '--',
      diagnosis: admission.admission_diagnosis,
      notes: admission.admission_notes,
    })
  }

  // Removed old simple discharge function

  const statusColors = {
    admitted: 'bg-blue-100 text-blue-700',
    discharged: 'bg-green-100 text-green-700',
    transferred: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  if (mode === 'new_admission') {
    return (
      <div className="max-w-2xl">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <PlusCircle size={20} className="text-blue-500" /> New IPD Admission
        </h2>
        <form onSubmit={submitAdmission} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-xs text-gray-500 mb-1 block">Patient *</label>
              
              {selectedPatient ? (
                <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                    {(selectedPatient.first_name?.[0] || '') + (selectedPatient.last_name?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{[selectedPatient.first_name, selectedPatient.last_name].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-gray-400">{selectedPatient.uhid} · {selectedPatient.phone || 'No phone'}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedPatient(null)} className="text-gray-300 hover:text-red-500">
                    <XCircle size={16} />
                  </button>
                </div>
              ) : isAddingNew ? (
                <div className="space-y-2 border-2 border-blue-500/20 bg-blue-50/20 rounded-xl p-3 shadow-inner">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">New Registration Mode</p>
                    <button type="button" onClick={() => { setIsAddingNew(false); setPtSearch(newPt.name) }} className="text-[10px] text-gray-400 font-bold hover:text-red-500 underline uppercase tracking-widest leading-none">Cancel</button>
                  </div>
                  <input className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-gray-50/50" value={newPt.name} readOnly />
                  <input className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                    type="tel" maxLength={10}
                    value={newPt.phone} onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewPt(p => ({ ...p, phone: v }));
                    }} placeholder="10-digit Mobile" />
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={newPt.gender}
                    onChange={e => setNewPt(p => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="">Select Gender *</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <input className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                    value={newPt.address} onChange={e => setNewPt(p => ({ ...p, address: e.target.value }))} placeholder="Address (Optional)" />
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    value={ptSearch}
                    onChange={e => setPtSearch(e.target.value)}
                    placeholder="Search by name or UHID..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                    autoComplete="off"
                  />
                  {ptSearching && <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />}
                  
                  {(ptResults.length > 0 || (ptSearch.length > 1 && !ptSearching)) && (
                    <ul className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-2xl border border-gray-100 divide-y divide-gray-50 max-h-60 overflow-y-auto">
                      {ptResults.map(p => (
                        <li key={p.id}>
                          <button type="button" onClick={() => { setSelectedPatient(p); setPtSearch(''); setPtResults([]) }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50/50 flex items-center gap-3 group">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center font-bold text-xs uppercase transition-all shrink-0">
                              {(p.first_name?.[0] || '') + (p.last_name?.[0] || '')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800">{[p.first_name, p.last_name].filter(Boolean).join(' ')}</p>
                              <p className="text-[10px] text-gray-400 font-mono italic">{p.uhid} · {p.phone || 'No phone'}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                      <li className="bg-blue-50/50">
                        <button type="button" onClick={() => { setIsAddingNew(true); setNewPt({ name: ptSearch, phone: '', address: '', gender: '' }); setPtSearch(''); setPtResults([]) }}
                          className="w-full text-left px-3 py-3 flex items-center gap-3 group transition-all">
                          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Plus size={16} strokeWidth={3} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Register & Admit As New</p>
                            <p className="text-xs text-blue-600 font-bold italic truncate opacity-70">"{ptSearch}"</p>
                          </div>
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assigned Doctor</label>
              <select value={form.assigned_doctor} onChange={e => setForm(f => ({ ...f, assigned_doctor: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">-- Select doctor --</option>
                {doctors.map(d => (
                  <option key={d.user || d.id} value={d.user || d.id}>
                    {d.name || [d.first_name, d.last_name].filter(Boolean).join(' ') || d.user}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Department *</label>
              <select
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              >
                <option value="">-- Select department --</option>
                {departments.map(dep => (
                  <option key={dep.id} value={dep.name || dep.code || ''}>
                    {dep.name || dep.code}
                  </option>
                ))}
              </select>
            </div>
            {/* Bed picker */}
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Bed Assignment *</label>
              {pickedBed ? (
                <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-300 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Bed size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">
                      {pickedBed.bed_code} · {pickedBed.room_name}
                      {pickedBed.is_ac && (
                        <span className="ml-2 text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-semibold">
                          <Wind size={9} className="inline mr-0.5" />AC
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pickedBed.floor_name} ·{' '}
                      <span className="text-emerald-600 font-semibold">₹{Number(pickedBed.daily_charge).toLocaleString()}/day</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => { setPickedBed(null); setForm(f => ({ ...f, bed_code: '', ward_name: '' })) }}
                    className="text-gray-400 hover:text-red-500"><XCircle size={18} /></button>
                  <button type="button" onClick={() => setShowBedPicker(true)}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-200">
                    Change
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowBedPicker(true)}
                  className="w-full border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 rounded-xl py-4 text-sm text-blue-600 font-semibold flex items-center justify-center gap-2 transition-all hover:border-blue-400">
                  <Bed size={16} /> Select Floor & Bed
                </button>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Admission Date *</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={form.admission_date ? format(new Date(form.admission_date), 'd/M/yyyy') : ''}
                  onClick={(e) => e.target.nextSibling.showPicker()}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white"
                  placeholder="Select admission date..."
                />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 pointer-events-none"
                  value={form.admission_date}
                  onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Admission Diagnosis</label>
              <input value={form.admission_diagnosis} onChange={e => setForm(f => ({ ...f, admission_diagnosis: e.target.value }))}
                placeholder="Primary diagnosis"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Admission Notes</label>
            <textarea value={form.admission_notes} onChange={e => setForm(f => ({ ...f, admission_notes: e.target.value }))}
              rows={3} placeholder="Additional notes..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              checked={autoPrintAdmitSlip}
              onChange={e => setAutoPrintAdmitSlip(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Print admit slip automatically
          </label>
          <button type="submit" disabled={submitting || (!selectedPatient && !isAddingNew) || !form.department || !form.bed_code}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2">
            <Bed size={16} /> {submitting ? 'Processing…' : isAddingNew ? 'Register & Admit Patient' : 'Admit Patient'}
          </button>
        </form>

        {showBedPicker && (
          <BedSelector
            onSelect={handleBedSelect}
            onClose={() => setShowBedPicker(false)}
          />
        )}
      </div>
    )
  }

  // Active admissions list
  const filtered = admissions.filter(a => {
    if (a.status !== 'admitted') return false;
    const q = search.toLowerCase()
    return !q || (a.patient_name || '').toLowerCase().includes(q) || (a.bed_code || '').toLowerCase().includes(q) || (a.ward_name || '').toLowerCase().includes(q)
  })

  // Pagination calculations
  const total = filtered.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs text-blue-500 font-semibold">Admitted</p>
          <p className="text-2xl font-black text-blue-700">{admissions.filter(a => a.status === 'admitted').length}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <p className="text-xs text-amber-500 font-semibold">Expected Discharge Today</p>
          <p className="text-2xl font-black text-amber-700">
            {admissions.filter(a => a.expected_discharge_date === format(new Date(), 'yyyy-MM-dd')).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[calc(100vh-320px)]">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <Search size={16} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, bed, ward…"
            className="flex-1 text-sm outline-none" />
          <button onClick={fetchAdmissions} className="text-gray-400 hover:text-blue-600"><RefreshCw size={14} /></button>
          <span className="text-xs text-gray-400">{filtered.length} patients</span>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No active IPD admissions</div>
        ) : (
          <div className="divide-y divide-gray-50 flex-1">
            {paginated.map(a => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Bed size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.patient_name || a.patient}</p>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {a.department || 'No Dept'} · {a.ward_name || 'No Ward'} · Bed {a.bed_code || '—'} · Admitted {a.admission_date ? `${format(new Date(a.admission_date), 'd/M/yyyy')} (${format(new Date(a.created_at || Date.now()), 'HH:mm')})` : '—'}
                  </p>
                  {a.admission_diagnosis && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">Dx: {a.admission_diagnosis}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!a.patient_uhid) {
                      toast.error('UHID not available for this patient')
                      return
                    }
                    const parts = String(a.patient_name || '').trim().split(/\s+/).filter(Boolean)
                    setTimelineFor({
                      uhid: a.patient_uhid,
                      first_name: parts[0] || '',
                      last_name: parts.slice(1).join(' ') || '',
                    })
                  }}
                  disabled={!a.patient_uhid}
                  className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200 font-semibold flex items-center gap-1 disabled:opacity-50"
                >
                  <FileText size={12} /> Timeline
                </button>
                {a.status === 'admitted' && (
                  <button onClick={() => { setSelected(a); setAutoDischarge(true); }}
                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 font-semibold flex items-center gap-1">
                    <CheckCircle size={12} /> Discharge
                  </button>
                )}
                <button
                  onClick={() => setEditingAdmission(a)}
                  className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-200 font-semibold flex items-center gap-1"
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button
                  onClick={() => reprintAdmitSlip(a)}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200 font-semibold flex items-center gap-1"
                >
                  <Printer size={12} /> Print Slip
                </button>
                <button onClick={() => setSelected(selected?.id === a.id ? null : a)}
                  className="shrink-0 text-gray-400 hover:text-blue-500 rounded-xl px-2">
                  <div className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 px-3 py-1.5 rounded-lg font-bold transition-colors">
                    <FileText size={14} /> Open Ledger / Pay
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && !loading && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-sm text-gray-400 font-medium">
            {total === 0 ? 'No admissions found' : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <span className="text-sm text-gray-500 font-medium px-1">
              Page {page + 1} of {totalPages || 1}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || totalPages === 0}
              className="px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <AdmissionLedgerModal 
          admission={selected} 
          onClose={() => { setSelected(null); setAutoDischarge(false); }} 
          autoDischarge={autoDischarge}
          onDischargeInitiated={() => setAutoDischarge(false)}
        />
      )}
      {editingAdmission && (
        <EditAdmissionModal
          admission={editingAdmission}
          doctors={doctors}
          departments={departments}
          onClose={() => setEditingAdmission(null)}
          onSaved={() => {
            setEditingAdmission(null)
            fetchAdmissions()
          }}
        />
      )}
      {timelineFor && (
        <PatientLifetimeTimelineModal
          patient={timelineFor}
          onClose={() => setTimelineFor(null)}
        />
      )}
    </div>
  )
}

/** Values for `<input type="date" />` must be YYYY-MM-DD (API may return ISO datetime strings). */
function toHtmlDateInputValue(v) {
  if (v == null || v === '') return ''
  const s = String(v).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'yyyy-MM-dd')
}

/** IPD API expects YYYY-MM-DD; optional fields should be `null`, not `''`. */
function toApiDateOrNull(v) {
  if (v == null || String(v).trim() === '') return null
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return format(d, 'yyyy-MM-dd')
}

const EMPTY_PATIENT_FORM = {
  first_name: '',
  last_name: '',
  phone: '',
  age: '',
  gender: '',
  guardian_name: '',
  address_line1: '',
  city: '',
  state: '',
}

function mapPatientApiToForm(p) {
  if (!p || typeof p !== 'object') return { ...EMPTY_PATIENT_FORM }
  return {
    first_name: String(p.first_name ?? '').trim(),
    last_name: String(p.last_name ?? '').trim(),
    phone: String(p.phone ?? '').trim(),
    age: p.age != null && p.age !== '' ? String(p.age) : '',
    gender: String(p.gender ?? '').trim(),
    guardian_name: String(p.guardian_name ?? '').trim(),
    address_line1: String(p.address_line1 ?? '').trim(),
    city: String(p.city ?? '').trim(),
    state: String(p.state ?? '').trim(),
  }
}

function fallbackPatientFormFromAdmissionName(patientName) {
  const parts = String(patientName || '').trim().split(/\s+/).filter(Boolean)
  return {
    ...EMPTY_PATIENT_FORM,
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || '',
  }
}

function EditAdmissionModal({ admission, doctors, departments, onClose, onSaved }) {
  const [submitting, setSubmitting] = useState(false)
  const [patientSubmitting, setPatientSubmitting] = useState(false)
  const [showBedPicker, setShowBedPicker] = useState(false)
  const [showPatientEditModal, setShowPatientEditModal] = useState(false)
  const [patientPreview, setPatientPreview] = useState({
    patient_name: admission.patient_name || '--',
    patient_uhid: admission.patient_uhid || 'UHID unavailable',
  })
  const [form, setForm] = useState({
    assigned_doctor: admission.assigned_doctor || '',
    department: admission.department || '',
    ward_name: admission.ward_name || '',
    room_name: admission.room_name || '',
    bed_code: admission.bed_code || '',
    admission_date: toHtmlDateInputValue(admission.admission_date) || format(new Date(), 'yyyy-MM-dd'),
    expected_discharge_date: toHtmlDateInputValue(admission.expected_discharge_date),
    admission_diagnosis: admission.admission_diagnosis || '',
    admission_notes: admission.admission_notes || '',
  })
  const [bedBaseline] = useState(() => ({
    bed_code: admission.bed_code || '',
    room_name: admission.room_name || '',
    ward_name: admission.ward_name || '',
  }))
  const bedAssignmentDirty = useMemo(() => {
    const n = (s) => String(s ?? '').trim()
    return (
      n(form.bed_code) !== n(bedBaseline.bed_code) ||
      n(form.room_name) !== n(bedBaseline.room_name) ||
      n(form.ward_name) !== n(bedBaseline.ward_name)
    )
  }, [form.bed_code, form.room_name, form.ward_name, bedBaseline])
  const [patientForm, setPatientForm] = useState(() => ({ ...EMPTY_PATIENT_FORM }))
  const [baselinePatientForm, setBaselinePatientForm] = useState(() => ({ ...EMPTY_PATIENT_FORM }))
  const [patientDetailLoading, setPatientDetailLoading] = useState(false)

  useEffect(() => {
    if (!admission?.patient) {
      const fb = fallbackPatientFormFromAdmissionName(admission?.patient_name)
      setPatientForm(fb)
      setBaselinePatientForm(fb)
      return
    }
    let cancelled = false
    setPatientDetailLoading(true)
    ;(async () => {
      try {
        const { data } = await api.get(`/patients/${admission.patient}/`)
        const p = data?.data ?? data ?? {}
        if (cancelled) return
        const next = mapPatientApiToForm(p)
        setPatientForm(next)
        setBaselinePatientForm(next)
      } catch {
        if (!cancelled) {
          const fb = fallbackPatientFormFromAdmissionName(admission.patient_name)
          setPatientForm(fb)
          setBaselinePatientForm(fb)
        }
      } finally {
        if (!cancelled) setPatientDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [admission.patient, admission.id, showPatientEditModal])

  function handleBedSelect(bedInfo) {
    setForm(f => ({
      ...f,
      bed_code: bedInfo.bed_code,
      ward_name: bedInfo.ward_name || '',
      room_name: bedInfo.room_name || '',
    }))
    setShowBedPicker(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.department) { toast.error('Department is required'); return }
    if (!form.bed_code) { toast.error('Bed assignment is required'); return }
    const admissionDate = toApiDateOrNull(form.admission_date)
    if (!admissionDate) {
      toast.error('Admission date must be a valid date (YYYY-MM-DD)')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        assigned_doctor: form.assigned_doctor || null,
        department: form.department,
        ward_name: form.ward_name,
        room_name: form.room_name,
        bed_code: form.bed_code,
        admission_date: admissionDate,
        expected_discharge_date: toApiDateOrNull(form.expected_discharge_date),
        admission_diagnosis: form.admission_diagnosis || '',
        admission_notes: form.admission_notes || '',
      }
      await api.patch(`/ipd-admissions/${admission.id}/`, payload)
      toast.success('Admission details updated')
      onSaved()
    } catch (err) {
      const apiErrors = err?.response?.data?.errors
      const firstFieldError =
        apiErrors && typeof apiErrors === 'object'
          ? Object.values(apiErrors).flat().find(Boolean)
          : null
      toast.error(firstFieldError || err?.response?.data?.detail || 'Failed to update admission')
    } finally {
      setSubmitting(false)
    }
  }

  async function savePatientDetails() {
    if (!admission.patient) {
      toast.error('Patient id not found for this admission')
      return
    }
    setPatientSubmitting(true)
    try {
      const patientPayload = {}
      const patientKeys = ["first_name", "last_name", "phone", "age", "gender", "guardian_name", "address_line1", "city", "state"]
      patientKeys.forEach((key) => {
        const nextVal = String(patientForm[key] ?? '').trim()
        const prevVal = String(baselinePatientForm[key] ?? '').trim()
        if (nextVal !== prevVal) {
          if (key === 'age') {
            if (nextVal === '') return
            const parsed = parseInt(nextVal, 10)
            if (!Number.isNaN(parsed) && parsed >= 0) patientPayload.age = parsed
            return
          }
          patientPayload[key] = nextVal
        }
      })
      if (Object.keys(patientPayload).length === 0) {
        setShowPatientEditModal(false)
        return
      }
      await api.patch(`/patients/${admission.patient}/`, patientPayload)
      const fullName = [patientForm.first_name, patientForm.last_name].filter(Boolean).join(' ').trim()
      setPatientPreview((p) => ({ ...p, patient_name: fullName || p.patient_name }))
      setBaselinePatientForm({ ...patientForm })
      toast.success('Patient details updated')
      setShowPatientEditModal(false)
      onSaved()
    } catch (err) {
      const apiErrors = err?.response?.data?.errors
      const firstFieldError =
        apiErrors && typeof apiErrors === 'object'
          ? Object.values(apiErrors).flat().find(Boolean)
          : null
      toast.error(firstFieldError || err?.response?.data?.detail || 'Failed to update patient')
    } finally {
      setPatientSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[520] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="font-black text-lg tracking-tight">Edit Active Admission</h3>
            <p className="text-amber-100 text-xs font-medium">{admission.patient_name || admission.patient} · Bed {admission.bed_code || '--'}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Patient</p>
                  <p className="text-sm font-bold text-slate-900">{patientPreview.patient_name || '--'}</p>
                  <p className="text-xs text-slate-500">{patientPreview.patient_uhid || 'UHID unavailable'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPatientEditModal(true)}
                  className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-200"
                >
                  Edit Patient
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assigned Doctor</label>
              <select value={form.assigned_doctor} onChange={e => setForm(f => ({ ...f, assigned_doctor: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                <option value="">-- Select doctor --</option>
                {doctors.map(d => (
                  <option key={d.user || d.id} value={d.user || d.id}>
                    {d.name || [d.first_name, d.last_name].filter(Boolean).join(' ') || d.user}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Department *</label>
              <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" required>
                <option value="">-- Select department --</option>
                {departments.map(dep => (
                  <option key={dep.id} value={dep.name || dep.code || ''}>
                    {dep.name || dep.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Bed Assignment *</label>
              <div className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 border ${bedAssignmentDirty ? 'bg-amber-50 border-amber-400/70' : 'bg-amber-50 border-amber-200'}`}>
                <div className="min-w-0 flex-1">
                  {bedAssignmentDirty ? (
                    <>
                      <p className="font-black text-amber-900 mb-1.5 uppercase tracking-wide text-[10px]">Bed assignment changed</p>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-start text-xs">
                        <span className="text-amber-600 font-bold shrink-0">From</span>
                        <div className="min-w-0">
                          <p className="font-bold text-amber-900">{bedBaseline.bed_code || '—'} · {bedBaseline.room_name || '—'}</p>
                          <p className="text-amber-800/90">{bedBaseline.ward_name || 'Ward not set'}</p>
                        </div>
                        <span className="text-amber-600 font-bold shrink-0">To</span>
                        <div className="min-w-0">
                          <p className="font-bold text-amber-900">{form.bed_code || '—'} · {form.room_name || '—'}</p>
                          <p className="text-amber-800/90">{form.ward_name || 'Ward not set'}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-amber-900">{form.bed_code || '--'} · {form.room_name || '--'}</p>
                      <p className="text-xs text-amber-700">{form.ward_name || 'Ward not set'}</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowBedPicker(true)}
                  className="shrink-0 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-200"
                >
                  Change Bed
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Admission Date *</label>
              <input type="date" value={form.admission_date} onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" required />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Expected Discharge Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="date"
                value={form.expected_discharge_date || ''}
                onChange={e => setForm(f => ({ ...f, expected_discharge_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Admission Diagnosis</label>
              <input value={form.admission_diagnosis} onChange={e => setForm(f => ({ ...f, admission_diagnosis: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="Primary diagnosis" />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Admission Notes</label>
              <textarea rows={4} value={form.admission_notes} onChange={e => setForm(f => ({ ...f, admission_notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                placeholder="Additional notes..." />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {showBedPicker && (
        <BedSelector onSelect={handleBedSelect} onClose={() => setShowBedPicker(false)} />
      )}
      {showPatientEditModal && (
        <div className="fixed inset-0 z-[530] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 flex items-center justify-between text-white">
              <h4 className="font-black text-base">Edit Patient Details</h4>
              <button onClick={() => setShowPatientEditModal(false)} className="text-white/80 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 relative">
              {patientDetailLoading && admission.patient && (
                <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-b-2xl">
                  <span className="text-sm font-semibold text-blue-600">Loading patient…</span>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">First Name</label>
                <input value={patientForm.first_name} onChange={e => setPatientForm(p => ({ ...p, first_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Last Name</label>
                <input value={patientForm.last_name} onChange={e => setPatientForm(p => ({ ...p, last_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                <input value={patientForm.phone} onChange={e => setPatientForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Age</label>
                <input type="number" min="0" value={patientForm.age} onChange={e => setPatientForm(p => ({ ...p, age: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                <select value={patientForm.gender} onChange={e => setPatientForm(p => ({ ...p, gender: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">-- Select gender --</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Guardian</label>
                <input value={patientForm.guardian_name} onChange={e => setPatientForm(p => ({ ...p, guardian_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Address</label>
                <input value={patientForm.address_line1} onChange={e => setPatientForm(p => ({ ...p, address_line1: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">City</label>
                <input value={patientForm.city} onChange={e => setPatientForm(p => ({ ...p, city: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">State</label>
                <input value={patientForm.state} onChange={e => setPatientForm(p => ({ ...p, state: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="px-5 pb-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowPatientEditModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button type="button" disabled={patientSubmitting} onClick={savePatientDetails}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {patientSubmitting ? 'Saving...' : 'Save Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddChargeModal({ admission, onClose }) {
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!desc || !amount) return
    setSubmitting(true)
    try {
      await api.post(`/ipd-admissions/${admission.id}/add-charge/`, {
        description: desc, amount
      })
      toast.success('Charge added successfully!')
      onClose()
    } catch { toast.error('Failed to add charge') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-bold">Add Service Charge</h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={20} /></button>
        </div>
        <form onSubmit={handleAdd} className="p-6 space-y-4">
          <div>
            <div className="bg-blue-50 p-3 rounded-2xl mb-4 border border-blue-100">
              <p className="text-[10px] font-bold text-blue-400 uppercase">Patient</p>
              <p className="text-sm font-bold text-blue-900">{admission.patient_name}</p>
            </div>
            <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">Service Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} required placeholder="e.g. Surgery Fee, Nursing Charge..."
              className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00"
              className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 active:scale-95">
            {submitting ? 'Adding...' : <><Plus size={18} /> Confirm Charge</>}
          </button>
        </form>
      </div>
    </div>
  )
}

function AdmissionPaymentsModal({ admission, onClose }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('cash')
  const [ref, setRef] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchPayments() }, [admission.id])

  async function fetchPayments() {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd-admissions/${admission.id}/payments/`)
      setPayments(data)
    } catch { toast.error('Failed to load payments') }
    finally { setLoading(false) }
  }

  async function handleAddAdvance(e) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setSubmitting(true)
    try {
      await api.post(`/ipd-admissions/${admission.id}/capture-advance/`, {
        amount, payment_mode: mode, reference: ref
      })
      toast.success('Advance captured successfully!')
      setAmount(''); setRef('')
      fetchPayments()
    } catch (err) { toast.error('Failed to capture advance') }
    finally { setSubmitting(false) }
  }

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <IndianRupee size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight">{admission.patient_name}</h3>
              <p className="text-amber-100 text-xs">IPD Payments & Advances · {admission.bed_code}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <XCircle size={26} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* History Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Clock size={16} className="text-amber-500" /> Payment History
              </h4>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">
                Total Paid: ₹{totalPaid.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2 pr-2 custom-scrollbar">
              {loading ? (
                <div className="py-10 text-center text-xs text-gray-400">Loading history...</div>
              ) : payments.length === 0 ? (
                <div className="py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                  <p className="text-xs text-gray-400">No payments recorded yet</p>
                </div>
              ) : (
                payments.map(p => (
                  <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center justify-between group hover:border-amber-200 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-gray-800">₹{parseFloat(p.amount).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">{format(new Date(p.created_at), 'dd MMM, HH:mm')}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-gray-500 uppercase px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100">{p.payment_mode}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* New Advance Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <PlusCircle size={16} className="text-emerald-500" /> Record New Advance
            </h4>
            <form onSubmit={handleAddAdvance} className="bg-gray-50/50 rounded-2xl border border-gray-200 p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase mb-1.5 block">Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                  <input
                    type="number" value={amount} onChange={e => setAmount(e.target.value)} required
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase mb-1.5 block">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'upi', 'card'].map(m => (
                    <button
                      key={m} type="button" onClick={() => setMode(m)}
                      className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                        mode === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase mb-1.5 block">Reference / Remarks</label>
                <input
                  value={ref} onChange={e => setRef(e.target.value)}
                  placeholder="Txn ID, Cheque no, etc."
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit" disabled={submitting || !amount}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} strokeWidth={2.5} />
                {submitting ? 'Processing...' : 'Confirm Payment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Emergency Cases ──────────────────────────────────────────────────────────
function EmergencySection() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ patient_name: '', gender: '', contact: '', complaint: '', triage: 'yellow' })
  const [selectedCase, setSelectedCase] = useState(null)
  const [admitCase, setAdmitCase] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [showBedPicker, setShowBedPicker] = useState(false)
  const [pickedBed, setPickedBed] = useState(null)
  const [admitting, setAdmitting] = useState(false)
  const [chargeCase, setChargeCase] = useState(null)
  const [charging, setCharging] = useState(false)
  const [admitForm, setAdmitForm] = useState({
    assigned_doctor: '',
    department: '',
    admission_diagnosis: '',
    admission_notes: '',
    auto_print_admit_slip: false,
  })
  const [chargeForm, setChargeForm] = useState({
    description: 'Emergency Consultation',
    amount: '',
    payment_mode: 'cash',
    auto_print: false,
  })
  const [autoPrintEmergencySlip, setAutoPrintEmergencySlip] = useState(true)

  useEffect(() => {
    loadCases()
    fetchDoctors()
    fetchDepartments()
  }, [])

  async function fetchDoctors() {
    try {
      const { data } = await api.get('/doctor-profiles/?limit=500')
      setDoctors(Array.isArray(data?.data) ? data.data : (data?.results || data || []))
    } catch {}
  }

  async function fetchDepartments() {
    try {
      const { data } = await api.get('/departments/?limit=500')
      setDepartments(Array.isArray(data?.data) ? data.data : (data?.results || data || []))
    } catch {}
  }

  async function loadCases() {
    setLoading(true)
    try {
      const { data } = await api.get('/emergency/cases/?limit=500')
      const rows = Array.isArray(data?.data) ? data.data : (data?.results || data || [])
      setCases(rows)
    } catch {
      toast.error('Failed to load emergency cases')
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  async function addCase(e) {
    e.preventDefault()
    if (!form.gender) {
      toast.error('Please select patient gender')
      return
    }
    try {
      const { data } = await api.post('/emergency/cases/', {
        patient_name: form.patient_name,
        gender: form.gender,
        contact: form.contact || '',
        complaint: form.complaint || '',
        triage: form.triage || 'yellow',
        status: 'waiting',
      })
      const entry = data?.data || data || {}
      setCases((prev) => [entry, ...prev])
      toast.success('Emergency case logged')
      if (autoPrintEmergencySlip) {
        printEmergencyCaseSlip(entry)
      }
      setForm({ patient_name: '', gender: '', contact: '', complaint: '', triage: 'yellow' })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to log emergency case')
    }
  }

  async function updateStatus(id, status) {
    try {
      await api.patch(`/emergency/cases/${id}/`, { status })
      setCases((prev) => prev.map(c => c.id === id ? { ...c, status } : c))
    } catch {
      toast.error('Failed to update emergency status')
    }
  }

  function openChargeModal(c) {
    setChargeCase(c)
    setChargeForm({
      description: 'Emergency Consultation',
      amount: '',
      payment_mode: 'cash',
      auto_print: false,
    })
  }

  function printEmergencyReceipt({ invoiceNo, slipNumber, patientName, patientGender, patientUhid, patientPhone, description, amount, paymentMode }) {
    const w = createSameTabPrintWindow()
    const slipProfile = getPaymentSlipProfile()
    const hospitalName = escapeHtml(slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name)
    const address = escapeHtml(slipProfile.address || DEFAULT_PAYMENT_SLIP_PROFILE.address)
    const pinCode = escapeHtml(slipProfile.pin_code || DEFAULT_PAYMENT_SLIP_PROFILE.pin_code)
    const phone = escapeHtml(slipProfile.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone)
    const email = escapeHtml(slipProfile.email || DEFAULT_PAYMENT_SLIP_PROFILE.email)
    const website = escapeHtml(slipProfile.website || DEFAULT_PAYMENT_SLIP_PROFILE.website)
    const dateTimeStr = format(new Date(), 'd/M/yyyy HH:mm:ss')
    const upPatient = (patientName || 'PATIENT').toUpperCase()
    const payModeLabel =
      paymentMode === 'cash'
        ? 'Cash Payment'
        : paymentMode === 'card'
          ? 'Card Payment'
          : paymentMode === 'upi'
            ? 'UPI Payment'
            : (paymentMode || 'Payment').toUpperCase()
    const genderLabel = patientGender === 'female' ? 'Female' : patientGender === 'male' ? 'Male' : patientGender === 'other' ? 'Other' : ''
    const amountFixed = Number(amount || 0).toFixed(2)

    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Receipt — ${invoiceNo || 'Payment'}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; width: 210mm; background: #fff; }
        .slip { width: 210mm; height: 148.5mm; padding: 6mm 8mm 4mm; display: flex; flex-direction: column; border-bottom: 2px dashed #aaa; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 4mm; border-bottom: 2px solid #111; margin-bottom: 3mm; }
        .hosp-name { font-size: 22px; font-weight: 900; color: #1a6b3f; letter-spacing: -0.5px; line-height: 1; margin-bottom: 2px; }
        .hosp-tag { font-size: 9px; color: #555; letter-spacing: 0.5px; text-transform: uppercase; }
        .address { text-align: right; font-size: 9.5px; color: #333; line-height: 1.55; }
        .address strong { font-size: 10px; }
        .receipt-title { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #111; padding-bottom: 2mm; margin-bottom: 2.5mm; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5mm 4mm; margin-bottom: 2.5mm; font-size: 10px; }
        .info-cell { display: flex; flex-direction: column; gap: 1px; }
        .info-label { color: #666; font-size: 9px; }
        .info-val { font-weight: 700; color: #111; }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        thead tr { background: #1a6b3f; color: #fff; }
        th { padding: 3px 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
        th.c { text-align: center; width: 26px; }
        th.l { text-align: left; }
        th.r { text-align: right; width: 52px; }
        tbody tr { border-bottom: 1px solid #e5e7eb; }
        tbody tr:last-child { border-bottom: 1.5px solid #111; }
        td { padding: 3px 5px; }
        td.c { text-align: center; color: #555; }
        td.l { text-align: left; }
        td.r { text-align: right; font-weight: 600; }
        .totals { margin-left: auto; width: 160px; margin-top: 1mm; font-size: 10.5px; }
        .t-row { display: flex; justify-content: space-between; padding: 1px 5px; }
        .t-row.disc { color: #dc2626; }
        .t-row.final { font-weight: 800; font-size: 12px; border-top: 2px solid #111; padding-top: 2px; margin-top: 2px; color: #1a6b3f; }
        .footer { margin-top: auto; padding-top: 2mm; border-top: 1px dashed #aaa; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; color: #555; }
        .note { max-width: 65%; line-height: 1.5; }
        .paid-box { border: 2px solid #1a6b3f; color: #1a6b3f; font-weight: 900; font-size: 13px; padding: 2px 10px; border-radius: 4px; letter-spacing: 2px; }
      </style>
    </head><body>
      <div class="slip">
        <div class="top">
          <div>
            <div class="hosp-name">${hospitalName}</div>
            <div class="hosp-tag">Healthcare &amp; Diagnostics</div>
          </div>
          <div class="address">
            <strong>${address}</strong><br/>
            Pincode: ${pinCode}<br/>
            Phone: ${phone}<br/>
            Email: ${email}${website ? `<br/>Website: ${website}` : ''}
          </div>
        </div>
        <div class="receipt-title">Receipt</div>
        <div class="info-grid">
          <div class="info-cell"><span class="info-label">Slip Number</span><span class="info-val">${slipNumber || '--'}</span></div>
          <div class="info-cell"><span class="info-label">Invoice Number</span><span class="info-val">${invoiceNo || '--'}</span></div>
          <div class="info-cell"><span class="info-label">Name</span><span class="info-val">${upPatient}</span></div>
          <div class="info-cell"><span class="info-label">Gender / Age</span><span class="info-val">${genderLabel || '—'}</span></div>
          <div class="info-cell"><span class="info-label">Pay Mode</span><span class="info-val">${payModeLabel}</span></div>
          <div class="info-cell"><span class="info-label">Mobile No.</span><span class="info-val">${patientPhone || '—'}</span></div>
          <div class="info-cell"><span class="info-label">Date</span><span class="info-val">${dateTimeStr}</span></div>
        </div>
        <table>
          <thead><tr><th class="c">SL No.</th><th class="l">Test Type / Service</th><th class="r">Amount</th></tr></thead>
          <tbody><tr><td class="c">1</td><td class="l">${description || 'Payment'}</td><td class="r">₹${amountFixed}</td></tr></tbody>
        </table>
        <div class="totals">
          <div class="t-row"><span>Total Amount:</span><span>₹${amountFixed}</span></div>
          <div class="t-row disc"><span>Discount:</span><span>₹0.00</span></div>
          <div class="t-row final"><span>Net Amount:</span><span>₹${amountFixed}</span></div>
        </div>
        <div class="footer">
          <div class="note"><strong>Note:</strong> Your reports will be preserved only for 6 months.<br/>Please retain this receipt for future reference.</div>
          <div class="paid-box">✓ PAID</div>
        </div>
      </div>
      ${PRINT_WINDOW_CLOSE_SCRIPT}
    </body></html>`)
    w.document.close()
  }

  /** ER registration / triage slip (no payment) — given to patient at triage. */
  function printEmergencyCaseSlip(c) {
    const esc = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const w = createSameTabPrintWindow()
    const slipProfile = getPaymentSlipProfile()
    const hospitalName = escapeHtml(slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name)
    const address = escapeHtml(slipProfile.address || DEFAULT_PAYMENT_SLIP_PROFILE.address)
    const pinCode = escapeHtml(slipProfile.pin_code || DEFAULT_PAYMENT_SLIP_PROFILE.pin_code)
    const phone = escapeHtml(slipProfile.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone)
    const email = escapeHtml(slipProfile.email || DEFAULT_PAYMENT_SLIP_PROFILE.email)
    const website = escapeHtml(slipProfile.website || DEFAULT_PAYMENT_SLIP_PROFILE.website)
    const arrived = c.arrived_at ? format(new Date(c.arrived_at), 'd/M/yyyy HH:mm:ss') : format(new Date(), 'd/M/yyyy HH:mm:ss')
    const caseRef = `ER-${c.id}`
    const triageLabel =
      c.triage === 'red' ? 'CRITICAL (Red)' : c.triage === 'green' ? 'Minor (Green)' : 'Moderate (Yellow)'
    const patientUp = esc((c.patient_name || 'PATIENT').toUpperCase())
    const complaintEsc = esc(c.complaint || '—')
    const contactEsc = esc(c.contact || '—')
    const statusEsc = esc((c.status || 'waiting').replace(/_/g, ' ').toUpperCase())

    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Emergency Slip — ${caseRef}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; width: 210mm; background: #fff; }
        .slip { width: 210mm; min-height: 148.5mm; padding: 6mm 8mm 4mm; display: flex; flex-direction: column; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 4mm; border-bottom: 2px solid #b91c1c; margin-bottom: 3mm; }
        .hosp-name { font-size: 22px; font-weight: 900; color: #b91c1c; letter-spacing: -0.5px; line-height: 1; margin-bottom: 2px; }
        .hosp-tag { font-size: 9px; color: #555; letter-spacing: 0.5px; text-transform: uppercase; }
        .er-badge { background: #b91c1c; color: #fff; font-weight: 900; font-size: 11px; padding: 4px 10px; border-radius: 4px; letter-spacing: 1px; }
        .address { text-align: right; font-size: 9.5px; color: #333; line-height: 1.55; }
        .address strong { font-size: 10px; }
        .slip-title { text-align: center; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #111; padding-bottom: 2mm; margin-bottom: 3mm; color: #991b1b; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 5mm; margin-bottom: 3mm; font-size: 10.5px; }
        .info-cell { display: flex; flex-direction: column; gap: 2px; }
        .info-cell.full { grid-column: 1 / -1; }
        .info-label { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
        .info-val { font-weight: 700; color: #111; word-break: break-word; }
        .complaint-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 3mm; margin-top: 1mm; font-size: 10.5px; line-height: 1.45; min-height: 18mm; }
        .footer { margin-top: auto; padding-top: 3mm; border-top: 1px dashed #aaa; font-size: 9px; color: #555; line-height: 1.5; }
        .note-strong { color: #991b1b; font-weight: 700; }
      </style>
    </head><body>
      <div class="slip">
        <div class="top">
          <div>
            <div class="hosp-name">${hospitalName}</div>
            <div class="hosp-tag">Emergency &amp; Trauma</div>
            <div style="margin-top:6px"><span class="er-badge">EMERGENCY</span></div>
          </div>
          <div class="address">
            <strong>${address}</strong><br/>
            Pincode: ${pinCode}<br/>
            Phone: ${phone}<br/>
            Email: ${email}${website ? `<br/>Website: ${website}` : ''}
          </div>
        </div>
        <div class="slip-title">Emergency registration slip</div>
        <div class="info-grid">
          <div class="info-cell"><span class="info-label">Case reference</span><span class="info-val">${caseRef}</span></div>
          <div class="info-cell"><span class="info-label">Date &amp; time</span><span class="info-val">${arrived}</span></div>
          <div class="info-cell"><span class="info-label">Patient name</span><span class="info-val">${patientUp}</span></div>
          <div class="info-cell"><span class="info-label">Contact</span><span class="info-val">${contactEsc}</span></div>
          <div class="info-cell"><span class="info-label">Triage category</span><span class="info-val">${triageLabel}</span></div>
          <div class="info-cell"><span class="info-label">Queue status</span><span class="info-val">${statusEsc}</span></div>
          <div class="info-cell full">
            <span class="info-label">Chief complaint</span>
            <div class="complaint-box">${complaintEsc}</div>
          </div>
        </div>
        <div class="footer">
          <p class="note-strong">Please keep this slip until you are seen by the doctor.</p>
          <p>Show this slip at billing if any emergency charges apply. This is not a payment receipt.</p>
        </div>
      </div>
      ${PRINT_WINDOW_CLOSE_SCRIPT}
    </body></html>`)
    w.document.close()
  }

  async function resolveEmergencyPatient(caseRow) {
    const digits = String(caseRow?.contact || '').replace(/\D/g, '').slice(-10)
    if (digits.length === 10) {
      try {
        const { data } = await api.get(`/patients/?search=${encodeURIComponent(digits)}&limit=10`)
        const rows = Array.isArray(data?.data) ? data.data : (data?.results || [])
        const exact = rows.find(p => String(p.phone || '').replace(/\D/g, '').slice(-10) === digits)
        if (exact?.id) return exact
      } catch {}
    }

    const parts = String(caseRow?.patient_name || 'Emergency Patient').trim().split(/\s+/)
    const payload = {
      first_name: parts[0] || 'Emergency',
      last_name: parts.slice(1).join(' ') || 'Patient',
      gender: caseRow?.gender || 'other',
      phone: digits || '',
    }
    const { data } = await api.post('/patients/', payload)
    return data?.data || data?.entity || data
  }

  async function saveChargeAndAttend(e) {
    e.preventDefault()
    if (!chargeCase) return
    const amount = parseFloat(chargeForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Enter valid charge amount')
      return
    }

    setCharging(true)
    try {
      const patient = await resolveEmergencyPatient(chargeCase)
      if (!patient?.id) {
        toast.error('Could not resolve patient for payment slip')
        setCharging(false)
        return
      }

      const invoicePayload = {
        patient: patient.id,
        // Backend does not support "emergency" encounter_type; use OPD bucket for ER slips.
        encounter_type: 'opd',
        status: 'finalized',
        discount_amount: '0.00',
        items: [{
          description: chargeForm.description?.trim() || 'Emergency Service',
          quantity: 1,
          unit_price: amount,
        }],
      }
      const { data } = await api.post('/invoices/', invoicePayload)
      const inv = data?.data || data?.entity || data

      const paymentRes = await api.post('/payments/', {
        invoice: inv.id,
        payment_mode: chargeForm.payment_mode || 'cash',
        amount: amount.toFixed(2),
        status: 'success',
      })
      const payment = paymentRes?.data?.data || paymentRes?.data?.entity || paymentRes?.data

      const patchData = {
        status: 'attended',
        attended_at: new Date().toISOString(),
        charge_amount: amount.toFixed(2),
        charge_invoice_no: inv.invoice_no || '',
      }
      await api.patch(`/emergency/cases/${chargeCase.id}/`, patchData)
      setCases((prev) => prev.map(c => c.id === chargeCase.id ? { ...c, ...patchData } : c))

      if (chargeForm.auto_print) {
        printEmergencyReceipt({
          invoiceNo: inv.invoice_no,
          slipNumber: payment?.slip_number || '',
          patientName: [patient.first_name, patient.last_name].filter(Boolean).join(' '),
          patientGender: patient.gender,
          patientUhid: patient.uhid,
          patientPhone: patient.phone,
          description: chargeForm.description,
          amount,
          paymentMode: chargeForm.payment_mode,
        })
      }

      toast.success(`Payment slip generated: ${inv.invoice_no || 'Saved'}`)
      toast.success('Emergency case marked attended')
      setChargeCase(null)
    } catch (err) {
      toast.error(err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Failed to generate payment slip')
    } finally {
      setCharging(false)
    }
  }

  function handleBedSelect(bedInfo) {
    setPickedBed(bedInfo)
  }

  function openAdmitModal(c) {
    setAdmitCase(c)
    setAdmitForm({
      assigned_doctor: '',
      department: '',
      admission_diagnosis: c.complaint || '',
      admission_notes: '',
      auto_print_admit_slip: false,
    })
    setPickedBed(null)
  }

  async function admitToIpd(e) {
    e.preventDefault()
    if (!admitCase) return
    if (!pickedBed?.bed_code) {
      toast.error('Select a bed first')
      return
    }
    if (!admitForm.department) {
      toast.error('Select department')
      return
    }
    setAdmitting(true)
    try {
      const digits = String(admitCase.contact || '').replace(/\D/g, '').slice(-10)
      let patientId = null
      let patientRecord = null

      if (digits.length === 10) {
        try {
          const { data } = await api.get(`/patients/?search=${encodeURIComponent(digits)}&limit=10`)
          const rows = Array.isArray(data?.data) ? data.data : (data?.results || [])
          const exact = rows.find(p => String(p.phone || '').replace(/\D/g, '').slice(-10) === digits)
          if (exact?.id) {
            patientId = exact.id
            patientRecord = exact
          }
        } catch {}
      }

      if (!patientId) {
        const parts = String(admitCase.patient_name || 'Emergency Patient').trim().split(/\s+/)
        const payload = {
          first_name: parts[0] || 'Emergency',
          last_name: parts.slice(1).join(' ') || 'Patient',
          gender: admitCase?.gender || 'other',
          phone: digits || '',
        }
        const { data } = await api.post('/patients/', payload)
        const created = data?.data || data?.entity || data
        patientId = created?.id
        patientRecord = created
      }

      if (!patientId) {
        toast.error('Could not resolve patient for admission')
        setAdmitting(false)
        return
      }
      const diagnosis = admitForm.admission_diagnosis?.trim() || admitCase.complaint || 'Emergency admission'
      const notes = [
        admitForm.admission_notes?.trim(),
        `Emergency triage: ${(admitCase.triage || '').toUpperCase()}`,
        `Arrival: ${admitCase.arrived_at ? format(new Date(admitCase.arrived_at), 'd/M/yyyy HH:mm') : 'N/A'}`,
        admitCase.complaint ? `Chief complaint: ${admitCase.complaint}` : '',
      ].filter(Boolean).join('\n')

      const { data } = await api.post('/ipd-admissions/', {
        patient: patientId,
        assigned_doctor: admitForm.assigned_doctor || null,
        department: admitForm.department,
        ward_name: pickedBed.ward_name,
        room_name: pickedBed.room_name,
        bed_code: pickedBed.bed_code,
        admission_date: format(new Date(), 'yyyy-MM-dd'),
        admission_diagnosis: diagnosis,
        admission_notes: notes,
      })
      const admitted = data?.data || data?.entity || data

      if (admitForm.auto_print_admit_slip) {
        const doc = doctors.find(d => (d.user || d.id) === admitForm.assigned_doctor)
        printIpdAdmitSlip({
          ipdNo: admitted?.ipd_no,
          admissionDate: admitted?.admission_date || format(new Date(), 'yyyy-MM-dd'),
          patientName: [patientRecord?.first_name, patientRecord?.last_name].filter(Boolean).join(' ') || admitCase.patient_name,
          patientUhid: patientRecord?.uhid,
          patientPhone: patientRecord?.phone || admitCase.contact,
          doctorName: doc?.name || [doc?.first_name, doc?.last_name].filter(Boolean).join(' '),
          department: admitForm.department,
          wardName: pickedBed.ward_name,
          roomName: pickedBed.room_name,
          bedCode: pickedBed.bed_code,
          bedPrice: pickedBed?.daily_charge ? Number(pickedBed.daily_charge).toLocaleString('en-IN') : '--',
          diagnosis,
          notes,
        })
      }

      const patchData = {
        status: 'admitted',
        admitted_at: new Date().toISOString(),
        admitted_bed: pickedBed.bed_code,
      }
      await api.patch(`/emergency/cases/${admitCase.id}/`, patchData)
      setCases((prev) => prev.map(c => c.id === admitCase.id ? { ...c, ...patchData } : c))

      toast.success('Emergency patient admitted to IPD')
      setAdmitCase(null)
      setPickedBed(null)
    } catch (err) {
      const patientErr = err?.response?.data?.patient?.[0] || err?.response?.data?.errors?.patient?.[0]
      toast.error(patientErr || err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Failed to admit patient')
    } finally {
      setAdmitting(false)
    }
  }

  const triageColors = {
    red: 'bg-red-100 text-red-700 border-red-200',
    yellow: 'bg-amber-100 text-amber-700 border-amber-200',
    green: 'bg-green-100 text-green-700 border-green-200',
  }

  const triageDot = { red: 'bg-red-500', yellow: 'bg-amber-400', green: 'bg-green-500' }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {['red', 'yellow', 'green'].map(t => (
          <div key={t} className={`rounded-2xl p-4 border ${triageColors[t]}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${triageDot[t]}`} />
              <p className="text-xs font-bold capitalize">{t === 'red' ? 'Critical' : t === 'yellow' ? 'Moderate' : 'Minor'}</p>
            </div>
            <p className="text-2xl font-black">{cases.filter(c => c.triage === t && c.status === 'waiting').length}</p>
          </div>
        ))}
      </div>

      <form onSubmit={addCase} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" /> Log Emergency Case
        </h3>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Patient Name *</label>
            <input value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} required
              placeholder="Enter patient name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Gender *</label>
            <select
              value={form.gender}
              onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Contact</label>
            <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
              placeholder="Phone number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Triage Level</label>
            <select value={form.triage} onChange={e => setForm(f => ({ ...f, triage: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
              <option value="red">🔴 Critical</option>
              <option value="yellow">🟡 Moderate</option>
              <option value="green">🟢 Minor</option>
            </select>
          </div>
          <div className="col-span-4">
            <label className="text-xs text-gray-500 mb-1 block">Chief Complaint *</label>
            <input value={form.complaint} onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))} required
              placeholder="Brief complaint description"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none" />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoPrintEmergencySlip}
            onChange={(e) => setAutoPrintEmergencySlip(e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Print emergency registration slip after logging (A4 / browser print)
        </label>
        <button type="submit"
          className="mt-3 bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 flex items-center gap-2">
          <AlertTriangle size={14} /> Log Case
        </button>
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Active Emergency Cases ({cases.filter(c => c.status === 'waiting').length})</p>
        </div>
        <div className="divide-y divide-gray-50 custom-scrollbar">
          {cases.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No emergency cases</div>
          ) : cases.map(c => (
            <div key={c.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${triageDot[c.triage]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{c.patient_name}</p>
                <p className="text-xs text-gray-400">{c.complaint} · {format(new Date(c.arrived_at), 'd/M/yyyy (HH:mm)')} · {c.contact || 'No contact'}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${triageColors[c.triage]}`}>
                {c.triage === 'red' ? 'Critical' : c.triage === 'yellow' ? 'Moderate' : 'Minor'}
              </span>
              <button
                onClick={() => setSelectedCase(c)}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-semibold hover:bg-blue-200"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => printEmergencyCaseSlip(c)}
                className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg font-semibold hover:bg-rose-100 flex items-center gap-1"
                title="Print ER registration slip"
              >
                <Printer size={12} strokeWidth={2.5} /> Print slip
              </button>
              {c.status === 'waiting' && (
                <button
                  onClick={() => openAdmitModal(c)}
                  className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-semibold hover:bg-indigo-200"
                >
                  Admit to IPD
                </button>
              )}
              {c.status === 'waiting' ? (
                <button onClick={() => openChargeModal(c)}
                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold hover:bg-green-200">
                  Mark Attended
                </button>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg capitalize">{c.status}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedCase && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40" onClick={() => setSelectedCase(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white flex items-center justify-between">
              <div>
                <p className="text-lg font-bold leading-tight">{selectedCase.patient_name}</p>
                <p className="text-red-100 text-xs">Emergency Case Details</p>
              </div>
              <button onClick={() => setSelectedCase(null)} className="text-white/80 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 uppercase">Contact</p>
                <p className="text-sm font-semibold text-gray-800">{selectedCase.contact || 'No contact'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 uppercase">Gender</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">{selectedCase.gender || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 uppercase">Triage</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">{selectedCase.triage}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                <p className="text-[11px] text-gray-400 uppercase">Complaint</p>
                <p className="text-sm font-semibold text-gray-800">{selectedCase.complaint || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 uppercase">Arrived At</p>
                <p className="text-sm font-semibold text-gray-800">{selectedCase.arrived_at ? format(new Date(selectedCase.arrived_at), 'd/M/yyyy (HH:mm)') : '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 uppercase">Status</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">{selectedCase.status || 'waiting'}</p>
              </div>
            </div>
            <div className="px-5 pb-4 flex flex-wrap gap-2">
              <button onClick={() => setSelectedCase(null)} className="flex-1 min-w-[100px] py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Close
              </button>
              <button
                type="button"
                onClick={() => printEmergencyCaseSlip(selectedCase)}
                className="flex-1 min-w-[120px] py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-semibold hover:bg-rose-100 flex items-center justify-center gap-1.5"
              >
                <Printer size={16} strokeWidth={2.5} /> Print ER slip
              </button>
              {selectedCase.status === 'waiting' && (
                <button
                  onClick={() => {
                    setSelectedCase(null)
                    openAdmitModal(selectedCase)
                  }}
                  className="flex-1 min-w-[120px] py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                >
                  Admit to IPD
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {admitCase && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-black/50" onClick={() => setAdmitCase(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-blue-700 text-white flex items-center justify-between">
              <div>
                <p className="text-lg font-bold leading-tight">Admit Emergency Patient</p>
                <p className="text-indigo-100 text-xs">{admitCase.patient_name} · {admitCase.contact || 'No contact'}</p>
              </div>
              <button onClick={() => setAdmitCase(null)} className="text-white/80 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={admitToIpd} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Assigned Doctor</label>
                  <select
                    value={admitForm.assigned_doctor}
                    onChange={e => setAdmitForm(f => ({ ...f, assigned_doctor: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Select doctor --</option>
                    {doctors.map(d => (
                      <option key={d.user || d.id} value={d.user || d.id}>
                        {d.name || [d.first_name, d.last_name].filter(Boolean).join(' ') || d.user}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Department *</label>
                  <select
                    value={admitForm.department}
                    onChange={e => setAdmitForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Select department --</option>
                    {departments.map(dep => (
                      <option key={dep.id} value={dep.name || dep.code || ''}>
                        {dep.name || dep.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Admission Diagnosis</label>
                  <input
                    value={admitForm.admission_diagnosis}
                    onChange={e => setAdmitForm(f => ({ ...f, admission_diagnosis: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Primary diagnosis"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bed Assignment *</label>
                {pickedBed ? (
                  <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Bed size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{pickedBed.bed_code} · {pickedBed.room_name}</p>
                      <p className="text-xs text-gray-500">{pickedBed.floor_name} · ₹{Number(pickedBed.daily_charge || 0).toLocaleString()}/day</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBedPicker(true)}
                      className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-200"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBedPicker(true)}
                    className="w-full border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl py-3 text-sm text-indigo-700 font-semibold"
                  >
                    Select Floor & Bed
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Admission Notes</label>
                <textarea
                  rows={3}
                  value={admitForm.admission_notes}
                  onChange={e => setAdmitForm(f => ({ ...f, admission_notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                  placeholder="Additional admission notes..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={admitForm.auto_print_admit_slip}
                  onChange={e => setAdmitForm(f => ({ ...f, auto_print_admit_slip: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Print admit slip automatically
              </label>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setAdmitCase(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={admitting || !admitForm.department || !pickedBed?.bed_code}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {admitting ? 'Admitting…' : 'Admit to IPD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBedPicker && (
        <BedSelector
          onSelect={handleBedSelect}
          onClose={() => setShowBedPicker(false)}
          zIndexClass="z-[360]"
        />
      )}

      {chargeCase && (
        <div className="fixed inset-0 z-[330] flex items-center justify-center p-4 bg-black/50" onClick={() => setChargeCase(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-green-700 text-white flex items-center justify-between">
              <div>
                <p className="text-lg font-bold leading-tight">Mark Attended & Create Slip</p>
                <p className="text-emerald-100 text-xs">{chargeCase.patient_name}</p>
              </div>
              <button onClick={() => setChargeCase(null)} className="text-white/80 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={saveChargeAndAttend} className="p-5 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Service Description</label>
                <input
                  value={chargeForm.description}
                  onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Emergency Consultation"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Charge Amount (INR) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={chargeForm.amount}
                  onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                <select
                  value={chargeForm.payment_mode}
                  onChange={e => setChargeForm(f => ({ ...f, payment_mode: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={chargeForm.auto_print}
                  onChange={e => setChargeForm(f => ({ ...f, auto_print: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Print slip automatically after attending
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setChargeCase(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={charging}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {charging ? 'Saving…' : 'Create Slip & Attend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── OPD Receipt Print ────────────────────────────────────────────────────────
function PrintOpdReceipt({ visit, patient, onClose }) {
  const slipProfile = getPaymentSlipProfile()
  const hospitalName = (slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name).toUpperCase()
  const address = slipProfile.address || DEFAULT_PAYMENT_SLIP_PROFILE.address
  const phone = slipProfile.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone
  const now = format(new Date(), 'd/M/yyyy (HH:mm)')
  const patientName = [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || patient?.uhid || '—'
  const visitDateDisplay =
    visit.visit_date
      ? `${format(new Date(visit.visit_date), 'd/M/yyyy')}${
          visit.created_at ? ` ${format(new Date(visit.created_at), 'HH:mm')}` : ''
        }`
      : '—'

  useEffect(() => {
    const t = setTimeout(() => window.print(), 800)
    function after() { onClose() }
    window.addEventListener('afterprint', after)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', after) }
  }, [])

  const content = (
    <div id="__opd_receipt_root" className="fixed inset-0 z-[700] bg-white overflow-y-auto print:static print:h-auto print:overflow-visible">
      <div className="flex justify-end p-4 print:hidden">
        <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold text-sm">✕ Close</button>
      </div>
      
      <div className="shadow-2xl print:shadow-none" style={{ width: '210mm', height: '148.5mm', margin: '0 auto', background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', padding: '10mm 12mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', borderBottom: '2px dashed #aaa' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: '3mm', marginBottom: '4mm' }}>
           <div>
             <p style={{ fontSize: 24, fontWeight: 900, color: '#1a6b3f', margin: 0 }}>{hospitalName}</p>
             <p style={{ fontSize: 9, color: '#555', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>OPD Consultation Receipt</p>
           </div>
           <div style={{ textAlign: 'right', fontSize: 10, color: '#333' }}>
             <p><strong>{address}</strong></p>
             <p>Contact: {phone}</p>
             <p style={{ marginTop: 2, fontWeight: 700 }}>{now}</p>
           </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, borderBottom: '1px solid #111', paddingBottom: '2mm', marginBottom: '4mm' }}>Payment Receipt</p>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2mm 5mm', marginBottom: '4mm', fontSize: '11px' }}>
          {[
            ['Patient Name', patientName.toUpperCase()],
            ['UHID', patient?.uhid || '—'],
            ['Token No', visit.queue_number || '—'],
            ['Consultant', visit.doctor_name || '—'],
            ['Visit Date', visitDateDisplay],
            ['Payment Mode', (visit.payment_mode || '—').toUpperCase()],
          ].map(([l, v]) => (
            <div key={l}>
              <p style={{ color: '#666', fontSize: '9px', marginBottom: 1 }}>{l}</p>
              <p style={{ fontWeight: 700 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1a6b3f', color: '#fff' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', textTransform: 'uppercase' }}>Description</th>
              <th style={{ padding: '6px 10px', textAlign: 'right', textTransform: 'uppercase', width: '30%' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1.5px solid #111' }}>
              <td style={{ padding: '10px' }}>OPD Consultation & Registration Charges</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{parseFloat(visit.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0fdf4' }}>
              <td style={{ padding: '8px 10px', fontWeight: 800 }}>TOTAL PAID</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#16a34a' }}>₹ {parseFloat(visit.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', paddingTop: '5mm' }}>
           <div style={{ textAlign: 'center', width: '35%' }}>
             <div style={{ borderTop: '1px solid #111', paddingTop: 4, fontSize: 10, fontWeight: 700 }}>Patient / Guardian</div>
           </div>
           <div style={{ textAlign: 'center', width: '35%' }}>
             <div style={{ borderTop: '1px solid #111', paddingTop: 4, fontSize: 10, fontWeight: 700 }}>Authorized Signatory</div>
           </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background: #fff !important; height: auto !important; overflow: visible !important; }
          body > *:not(#__opd_receipt_root) { display: none !important; }
          #__opd_receipt_root { 
            position: static !important; display: block !important; overflow: visible !important; 
            height: auto !important; padding: 0 !important; margin: 0 !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
  return createPortal(content, document.body)
}

// ─── Patient List ─────────────────────────────────────────────────────────────
function PatientLifetimeTimelineModal({ patient, onClose }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [ledgerByAdmission, setLedgerByAdmission] = useState({})
  const [loadingLedger, setLoadingLedger] = useState({})
  const [expandedAdmissions, setExpandedAdmissions] = useState({})
  const [expandedOpds, setExpandedOpds] = useState({})
  const [expandedSubs, setExpandedSubs] = useState({}) // { [admId_section]: bool }
  const [printTarget, setPrintTarget] = useState(null)
  const [tlPayCancel, setTlPayCancel] = useState(null)
  const [tlPayCancelReason, setTlPayCancelReason] = useState('')
  const [tlPayCancelling, setTlPayCancelling] = useState(false)
  const [tlPayEdit, setTlPayEdit] = useState(null)
  const [tlPaySaving, setTlPaySaving] = useState(false)

  const fullName = [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || patient?.uhid || 'Patient'

  useEffect(() => {
    let cancelled = false
    async function fetchTimeline() {
      if (!patient?.uhid) {
        toast.error('UHID not available for this patient')
        return
      }
      setLoading(true)
      setLedgerByAdmission({})
      try {
        const { data: payload } = await api.get(`/patients/lifetime-timeline/?uhid=${encodeURIComponent(patient.uhid)}`)
        if (!cancelled) setData(payload?.data || payload)
      } catch {
        if (!cancelled) {
          toast.error('Failed to load patient timeline')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTimeline()
    return () => { cancelled = true }
  }, [patient?.uhid])

  async function loadLedger(admissionId) {
    if (!admissionId || ledgerByAdmission[admissionId] || loadingLedger[admissionId]) return
    setLoadingLedger(prev => ({ ...prev, [admissionId]: true }))
    try {
      const { data: payload } = await api.get(`/ipd-admissions/${admissionId}/ledger/`)
      setLedgerByAdmission(prev => ({ ...prev, [admissionId]: payload }))
    } catch { toast.error('Failed to load IPD ledger') }
    finally { setLoadingLedger(prev => ({ ...prev, [admissionId]: false })) }
  }

  async function reloadLedgerAdmission(admissionId) {
    if (!admissionId) return
    setLoadingLedger(prev => ({ ...prev, [admissionId]: true }))
    try {
      const { data: payload } = await api.get(`/ipd-admissions/${admissionId}/ledger/`)
      setLedgerByAdmission(prev => ({ ...prev, [admissionId]: payload }))
    } catch {
      toast.error('Failed to refresh IPD ledger')
    } finally {
      setLoadingLedger(prev => ({ ...prev, [admissionId]: false }))
    }
  }

  async function openTimelineLedgerEditPayment(admissionId, paymentId) {
    if (!paymentId) return
    setTlPaySaving(true)
    try {
      const { data } = await api.get(`/payments/${paymentId}/`)
      const row = data?.data || data
      setTlPayEdit({ ...row, admissionId, paid_at: toDateTimeInputValue(row.paid_at) })
    } catch {
      toast.error('Failed to load payment')
    } finally {
      setTlPaySaving(false)
    }
  }

  async function submitTlPayCancel() {
    if (!tlPayCancel?.paymentTransactionId) return
    const reason = tlPayCancelReason.trim()
    if (!reason) {
      toast.error('Please enter cancellation reason')
      return
    }
    setTlPayCancelling(true)
    try {
      const ref = `CANCEL:${reason}`.slice(0, 120)
      await api.patch(`/payments/${tlPayCancel.paymentTransactionId}/`, {
        status: 'cancelled',
        transaction_reference: ref,
      })
      toast.success('Payment receipt cancelled')
      const admId = tlPayCancel.admissionId
      setTlPayCancel(null)
      setTlPayCancelReason('')
      await reloadLedgerAdmission(admId)
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to cancel payment'))
    } finally {
      setTlPayCancelling(false)
    }
  }

  async function handleTlPayEditSave(e) {
    e.preventDefault()
    if (!tlPayEdit?.id) return
    const admId = tlPayEdit.admissionId
    setTlPaySaving(true)
    try {
      await api.patch(`/payments/${tlPayEdit.id}/`, {
        payment_mode: tlPayEdit.payment_mode || 'cash',
        amount: tlPayEdit.amount || 0,
        transaction_reference: tlPayEdit.transaction_reference || '',
        receipt_no: tlPayEdit.receipt_no || '',
        status: tlPayEdit.status || 'success',
        paid_at: tlPayEdit.paid_at || null,
      })
      toast.success('Payment slip updated!')
      setTlPayEdit(null)
      await reloadLedgerAdmission(admId)
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to update payment slip'))
    } finally {
      setTlPaySaving(false)
    }
  }

  function toggleAdmission(id) {
    setExpandedAdmissions(prev => ({ ...prev, [id]: !prev[id] }))
    if (!ledgerByAdmission[id]) loadLedger(id)
  }

  function toggleOpd(id) { setExpandedOpds(prev => ({ ...prev, [id]: !prev[id] })) }

  const fmt = (d) => d ? format(new Date(d), 'd/M/yyyy') : '—'
  const fmtM = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const sBadge = (s) => ({ admitted: 'bg-blue-100 text-blue-700', discharged: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700', completed: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700' }[s?.toLowerCase()] || 'bg-gray-100 text-gray-600')

  return (
    <>
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[93vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-lg shrink-0">
            {(fullName[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight truncate">{fullName}</p>
            <p className="text-indigo-200 text-xs font-mono">{patient?.uhid} · Patient Lifetime Timeline</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors shrink-0"><XCircle size={22} /></button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Loading timeline…</p>
            </div>
          ) : !data ? (
            <div className="text-center py-20 text-gray-400 text-sm">No timeline data found.</div>
          ) : (<>

            {/* Patient Profile Card */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center shrink-0"><User size={13} className="text-white" /></div>
                <p className="font-black text-slate-800 text-sm">Patient Profile Details</p>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {[
                  ['Full Name', fullName],
                  ['UHID', data.patient?.uhid],
                  ['Gender', data.patient?.gender],
                  ['Age / DOB', `${data.patient?.age || '—'} yrs (${data.patient?.dob ? format(new Date(data.patient.dob), 'd/M/yyyy') : '—'})`],
                  ['Phone', data.patient?.phone],
                  ['Email', data.patient?.email],
                  ['Blood Group', data.patient?.blood_group],
                  ['Guardian', data.patient?.guardian_name],
                  ['Address', [data.patient?.address_line1, data.patient?.city, data.patient?.state].filter(Boolean).join(', ')],
                  ['Patient Type', data.patient?.patient_type],
                  ['Registration', data.patient?.created_at ? format(new Date(data.patient.created_at), 'd/M/yyyy') : '—'],
                  ['Status', data.patient?.status]
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">{l}</p>
                    <p className="font-bold text-gray-800 break-words">{v || '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── OPD History ── */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><ClipboardList size={13} className="text-white" /></div>
                <p className="font-black text-emerald-800 text-sm">OPD History</p>
                <span className="ml-auto text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{(data.opd_visits||[]).length} visits</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(data.opd_visits||[]).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">No OPD visits recorded.</p>
                ) : (data.opd_visits||[]).map(v => {
                  const open = expandedOpds[v.id]
                  return (
                    <div key={v.id}>
                      <button type="button" onClick={() => toggleOpd(v.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50/60 transition-colors text-left group">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-black border border-emerald-200">{v.queue_number || '—'}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 group-hover:text-emerald-700 transition-colors">{fmt(v.visit_date)}</p>
                          <p className="text-xs text-gray-500 truncate">{v.visit_reason || 'OPD Visit'} · Dr. {v.doctor_name || '—'}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize shrink-0 ${sBadge(v.status)}`}>{v.status}</span>
                        {v.amount && <span className="text-xs font-bold text-gray-700 shrink-0 bg-gray-100 px-2 py-0.5 rounded-lg">₹{fmtM(v.amount)}</span>}
                        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180':''}`} />
                      </button>
                      {open && (
                        <div className="px-4 pb-4 pt-1 bg-emerald-50/30 space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {[['Token No.',v.queue_number||'—'],['Doctor',v.doctor_name||'—'],['Diagnosis',v.diagnosis||'—'],['Visit Reason',v.visit_reason||'—'],['Payment Mode',(v.payment_mode||'—').toUpperCase()],['Amount Paid',v.amount?`₹${fmtM(v.amount)}`:'₹0.00']].map(([l,val]) => (
                              <div key={l} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                                <p className="text-gray-400 text-[10px] uppercase font-semibold tracking-wide">{l}</p>
                                <p className="font-bold text-gray-800 truncate mt-0.5">{val}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            {v.amount && (
                              <button type="button" onClick={() => setPrintTarget({ type:'opd_receipt', visit: { ...v, patient_name: [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || patient?.uhid } })}
                                className="flex items-center gap-1.5 text-[10px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                                <Printer size={11} /> Receipt
                              </button>
                            )}
                            <button type="button" 
                              onClick={() => setPrintTarget({ 
                                type:'opd_slip', 
                                visit: { 
                                  ...v, 
                                  doc_name: v.doctor_name,
                                  patient_name: [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || patient?.uhid,
                                  patient_uhid: patient?.uhid,
                                  patient_age: patient?.age,
                                  patient_gender: patient?.gender,
                                  patient_address: patient?.address,
                                  patient_guardian_name: patient?.guardian_name
                                } 
                              })}
                              className="flex items-center gap-1.5 text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm">
                              <Printer size={11} /> Print OPD Slip
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── IPD History ── */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0"><Bed size={13} className="text-white" /></div>
                <p className="font-black text-blue-800 text-sm">IPD Admissions</p>
                <span className="ml-auto text-[11px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{(data.ipd_admissions||[]).length} admissions</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(data.ipd_admissions||[]).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">No IPD admissions recorded.</p>
                ) : (data.ipd_admissions||[]).map(a => {
                  const open = expandedAdmissions[a.id]
                  const ledger = ledgerByAdmission[a.id]
                  const isLL = loadingLedger[a.id]
                  const balVal = parseFloat(ledger?.balance_due || 0)
                  const isDischarged = a.status === 'discharged'
                  const admObj = { patient_name:fullName, patient_uhid:patient?.uhid, ward_name:a.ward_name, room_name:a.room_name, bed_code:a.bed_code, admission_date:a.admission_date, created_at:a.created_at, ipd_no:a.id, admission_diagnosis:a.admission_diagnosis }
                  return (
                    <div key={a.id}>
                      {/* Admission row */}
                      <button type="button" onClick={() => toggleAdmission(a.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/60 transition-colors text-left group">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200"><Bed size={15} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
                            Admitted {fmt(a.admission_date)}{isDischarged && a.discharged_at ? ` → Discharged ${fmt(a.discharged_at)}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{a.department||'—'} · {a.ward_name||'—'} · Bed {a.bed_code||'—'} · Dr. {a.assigned_doctor_name||'—'}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize shrink-0 ${sBadge(a.status)}`}>{a.status}</span>
                        {isLL && <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />}
                        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${open?'rotate-180':''}`} />
                      </button>

                      {open && (
                        <div className="px-4 pb-5 pt-2 space-y-4 bg-blue-50/20">
                          {/* Admission details grid */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {[['Department',a.department||'—'],['Ward / Bed',`${a.ward_name||'—'} / ${a.bed_code||'—'}`],['Doctor',a.assigned_doctor_name||'—'],['Diagnosis',a.admission_diagnosis||'—'],['Admitted',fmt(a.admission_date)],['Discharged',isDischarged&&a.discharged_at?fmt(a.discharged_at):'Still Admitted']].map(([l,val])=>(
                              <div key={l} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                                <p className="text-gray-400 text-[10px] uppercase font-semibold tracking-wide">{l}</p>
                                <p className="font-bold text-gray-800 truncate mt-0.5">{val}</p>
                              </div>
                            ))}
                          </div>

                          {/* Ledger */}
                          {isLL ? (
                            <div className="flex items-center gap-2 text-xs text-blue-600 py-2 font-medium">
                              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading ledger…
                            </div>
                          ) : ledger ? (<div className="space-y-2">

                            {/* Summary cards always visible */}
                            <div className="grid grid-cols-3 gap-2">
                              {[{l:'Total Charges',v:ledger.total_charges,c:'border-gray-200 bg-white text-gray-800'},{l:'Total Paid',v:ledger.total_paid,c:'border-emerald-200 bg-emerald-50 text-emerald-700'},{l:'Balance Due',v:ledger.balance_due,c:balVal>0?'border-red-200 bg-red-50 text-red-600':'border-emerald-200 bg-emerald-50 text-emerald-700'}].map(({l,v,c})=>(
                                <div key={l} className={`rounded-xl border p-3 ${c}`}>
                                  <p className="text-[10px] font-semibold uppercase opacity-70 tracking-wide">{l}</p>
                                  <p className="text-base font-black mt-0.5">₹{fmtM(v)}</p>
                                </div>
                              ))}
                            </div>

                            {/* ── Sub-section 1: Charges ── */}
                            {(ledger.charges||[]).filter(c=>c.type!=='payment'&&c.type!=='pharmacy_payment').length>0 && (() => {
                              const subKey = `${a.id}_charges`
                              const subOpen = expandedSubs[subKey]
                              const rawCharges = (ledger.charges||[]).filter(c=>c.type!=='payment'&&c.type!=='pharmacy_payment')
                              
                              // Grouping logic
                              const groupedMap = {}
                              rawCharges.forEach(c => {
                                let desc = c.description || 'Service'
                                let key = desc.trim()
                                
                                // Normalize Bed/Room charges to group manual + auto entries
                                const lower = key.toLowerCase()
                                if (lower.includes('room rent') || lower.includes('bed charge') || lower.includes('room charge')) {
                                  key = 'Room Rent / Bed Charges'
                                  desc = 'Room Rent / Bed Charges'
                                }

                                // One row per billing invoice (same desc on two invoices must not merge)
                                const invPart = c.invoice_id != null && String(c.invoice_id) !== '' ? String(c.invoice_id) : String(c.id || '')
                                key = `${key}::__inv__${invPart}`

                                if (!groupedMap[key]) {
                                  groupedMap[key] = { ...c, description: desc, qty: 1, total_amount: parseFloat(c.amount || 0), invoice_status: c.invoice_status }
                                } else {
                                  groupedMap[key].qty += 1
                                  groupedMap[key].total_amount += parseFloat(c.amount || 0)
                                  if (c.date && new Date(c.date) > new Date(groupedMap[key].date)) {
                                    groupedMap[key].date = c.date
                                  }
                                }
                              })
                              const chargeRows = Object.values(groupedMap).sort((a, b) => {
                                const ca = String(a.invoice_status || '').toLowerCase() === 'cancelled'
                                const cb = String(b.invoice_status || '').toLowerCase() === 'cancelled'
                                if (ca !== cb) return ca ? 1 : -1
                                const da = a.date ? new Date(a.date).getTime() : 0
                                const db = b.date ? new Date(b.date).getTime() : 0
                                return da - db
                              })

                              return (
                                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                  <button type="button" onClick={() => setExpandedSubs(prev=>({...prev,[subKey]:!prev[subKey]}))}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                                    <IndianRupee size={12} className="text-gray-500 shrink-0" />
                                    <span className="font-black text-gray-700 text-xs flex-1">Charges</span>
                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{chargeRows.length} items</span>
                                    <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${subOpen?'rotate-180':''}`} />
                                  </button>
                                  {subOpen && (
                                    <div className="overflow-x-auto border-t border-gray-100">
                                      <table className="w-full text-xs">
                                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-semibold">Description</th>
                                            <th className="px-3 py-2 text-center font-semibold">Qty</th>
                                            <th className="px-3 py-2 text-left font-semibold">Date</th>
                                            <th className="px-3 py-2 text-right font-semibold">Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {chargeRows.map((c,i)=>(
                                            <tr key={i} className={`hover:bg-gray-50/80 ${String(c.invoice_status || '').toLowerCase() === 'cancelled' ? 'bg-slate-50/90' : ''}`}>
                                              <td className="px-3 py-2.5 font-medium text-gray-800">
                                                <span>{c.description}</span>
                                                {String(c.invoice_status || '').toLowerCase() === 'cancelled' ? (
                                                  <span className="ml-1.5 text-[9px] font-black uppercase tracking-wide text-red-700 bg-red-100 px-1.5 py-0.5 rounded">Cancelled</span>
                                                ) : null}
                                              </td>
                                              <td className="px-3 py-2.5 text-center text-gray-600 font-bold">{c.qty}</td>
                                              <td className="px-3 py-2.5 text-gray-500">{c.date?format(new Date(c.date),'d/M/yy'):'—'}</td>
                                              <td className="px-3 py-2.5 text-right font-bold text-gray-900">₹{fmtM(c.total_amount)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="border-t-2 border-gray-200">
                                          <tr className="bg-gray-50">
                                            <td colSpan={3} className="px-3 py-2 font-black text-gray-700 text-xs text-right">Total</td>
                                            <td className="px-3 py-2 text-right font-black text-gray-900">₹{fmtM(ledger.total_charges)}</td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* ── Sub-section 2: Payment Receipts ── */}
                            {(ledger.payments||[]).length>0 && (() => {
                              const subKey = `${a.id}_payments`
                              const subOpen = expandedSubs[subKey]
                              const payRows = [...(ledger.payments || [])].sort((a, b) => {
                                const voidA = String(a?.type || '') === 'pharmacy_payment' ? false : (String(a?.status || '').toLowerCase() === 'cancelled' || String(a?.invoice_status || '').toLowerCase() === 'cancelled')
                                const voidB = String(b?.type || '') === 'pharmacy_payment' ? false : (String(b?.status || '').toLowerCase() === 'cancelled' || String(b?.invoice_status || '').toLowerCase() === 'cancelled')
                                if (voidA !== voidB) return voidA ? 1 : -1
                                return new Date(a.date) - new Date(b.date)
                              })
                              return (
                                <div className="border border-emerald-200 rounded-xl overflow-hidden bg-white">
                                  <button type="button" onClick={() => setExpandedSubs(prev=>({...prev,[subKey]:!prev[subKey]}))}
                                    className="w-full flex flex-nowrap items-center gap-2 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left min-w-0">
                                    <CreditCard size={12} className="text-emerald-600 shrink-0" />
                                    <span className="font-black text-emerald-700 text-xs flex-1 min-w-0 truncate">Payment Receipts</span>
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">{payRows.length} payments</span>
                                    <button type="button" onClick={e=>{e.stopPropagation();setPrintTarget({type:'full_bill',admission:admObj,ledger})}}
                                      className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-md font-bold hover:bg-indigo-700 inline-flex items-center gap-1 shrink-0">
                                      <Printer size={9} /> Full Bill
                                    </button>
                                    <ChevronDown size={13} className={`text-emerald-400 shrink-0 transition-transform duration-200 ${subOpen?'rotate-180':''}`} />
                                  </button>
                                  {subOpen && (
                                    <div className="overflow-x-auto border-t border-emerald-100">
                                      <table className="w-full text-xs">
                                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase">
                                          <tr><th className="px-3 py-2 text-left font-semibold">Description</th><th className="px-3 py-2 text-left font-semibold">Date &amp; time</th><th className="px-3 py-2 text-right font-semibold">Amount</th><th className="px-3 py-2 text-center font-semibold">Status</th><th className="px-3 py-2 text-center font-semibold">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {payRows.map((p,i)=>{
                                            const md=(p.description||'').toUpperCase().includes('UPI')?'upi':(p.description||'').toUpperCase().includes('CREDIT')?'credit':'cash'
                                            const isAdv=(p.description||'').toLowerCase().includes('advance')
                                            const rawPid = p?.id != null ? String(p.id) : ''
                                            const isPharmacy = p?.type === 'pharmacy_payment' || rawPid.startsWith('pharmacy-paid-')
                                            const payId = isPharmacy ? '' : rawPid
                                            const isPayCancelled = (p?.status || 'success') === 'cancelled'
                                            const invStPay = String(p?.invoice_status || 'finalized').toLowerCase()
                                            const isPayReadOnly = isPayCancelled || invStPay === 'cancelled'
                                            const canMutateTimelinePay = payId && !isPharmacy && !isPayReadOnly && invStPay === 'finalized'
                                            const slip = p?.slip_number || ''
                                            return (
                                              <tr key={i} className={`hover:bg-emerald-50/40 ${isPayReadOnly ? 'bg-slate-50/80 opacity-90' : ''}`}>
                                                <td className="px-3 py-2.5 font-medium text-gray-800">{p.description}</td>
                                                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatReceiptDateTime(p.date)}</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-emerald-700">₹{fmtM(p.amount)}</td>
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                  {isPayReadOnly ? (
                                                    <span className="text-[9px] font-black uppercase tracking-wide text-red-700 bg-red-100 px-1.5 py-0.5 rounded">Cancelled</span>
                                                  ) : (
                                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                  <div className="inline-flex flex-nowrap items-center justify-center gap-1.5 max-w-full overflow-x-auto py-0.5">
                                                    <button type="button"
                                                      onClick={()=>setPrintTarget({type:'ipd_receipt',admission:admObj,receiptData:{description:p.description,amount:p.amount,mode:md,invoice_no:p.invoice_no,paid_at:p.date,slip_number:slip},receiptType:isAdv?'advance':'service',viewOnly:true})}
                                                      title="View"
                                                      aria-label="View receipt"
                                                      className="h-8 w-8 hover:w-[72px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition-all duration-150 border border-indigo-100 shadow-sm hover:shadow-md active:scale-95 group"
                                                    >
                                                      <Eye size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                                      <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[40px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">View</span>
                                                    </button>
                                                    <button type="button"
                                                      onClick={()=>setPrintTarget({type:'ipd_receipt',admission:admObj,receiptData:{description:p.description,amount:p.amount,mode:md,invoice_no:p.invoice_no,paid_at:p.date,slip_number:slip},receiptType:isAdv?'advance':'service',viewOnly:isPayReadOnly})}
                                                      title="Print"
                                                      aria-label="Print receipt"
                                                      className="h-8 w-8 hover:w-[74px] shrink-0 flex items-center justify-center gap-1 overflow-hidden rounded-lg transition-all duration-150 border shadow-sm hover:shadow-md active:scale-95 group text-sky-600 hover:text-white bg-sky-50 hover:bg-sky-600 border-sky-100"
                                                    >
                                                      <Printer size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                                      <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[44px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Print</span>
                                                    </button>
                                                    {canMutateTimelinePay ? (
                                                      <>
                                                        <button type="button"
                                                          onClick={() => openTimelineLedgerEditPayment(a.id, payId)}
                                                          title="Edit"
                                                          aria-label="Edit payment"
                                                          className="h-8 w-8 hover:w-[68px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 rounded-lg transition-all duration-150 border border-emerald-100 shadow-sm hover:shadow-md active:scale-95 group"
                                                        >
                                                          <Edit2 size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                                          <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[36px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Edit</span>
                                                        </button>
                                                        <button type="button"
                                                          onClick={() => {
                                                            setTlPayCancel({
                                                              admissionId: a.id,
                                                              paymentTransactionId: payId,
                                                              invoice_no: p.invoice_no,
                                                              amount: parseFloat(String(p.amount || '0')),
                                                            })
                                                            setTlPayCancelReason('')
                                                          }}
                                                          title="Cancel"
                                                          aria-label="Cancel payment"
                                                          className="h-8 w-8 hover:w-[84px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-red-600 hover:text-white bg-red-50 hover:bg-red-600 rounded-lg transition-all duration-150 border border-red-100 shadow-sm hover:shadow-md active:scale-95 group"
                                                        >
                                                          <X size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                                          <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[52px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Cancel</span>
                                                        </button>
                                                      </>
                                                    ) : null}
                                                  </div>
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                        <tfoot className="border-t-2 border-gray-200">
                                          <tr className="bg-emerald-50">
                                            <td colSpan={2} className="px-3 py-2 font-black text-emerald-700 text-xs">Total Paid</td>
                                            <td className="px-3 py-2 text-right font-black text-emerald-700">₹{fmtM(ledger.total_paid)}</td>
                                            <td />
                                            <td />
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* ── Sub-section 3: Discharge Summary ── */}
                            {isDischarged && a.discharge_summary && (() => {
                              const subKey = `${a.id}_discharge`
                              const subOpen = expandedSubs[subKey]
                              return (
                                <div className="border border-teal-200 rounded-xl overflow-hidden bg-white">
                                  <button type="button" onClick={() => setExpandedSubs(prev=>({...prev,[subKey]:!prev[subKey]}))}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-teal-50 hover:bg-teal-100 transition-colors text-left">
                                    <CheckCircle size={12} className="text-teal-600 shrink-0" />
                                    <span className="font-black text-teal-700 text-xs flex-1">Discharge Summary</span>
                                    {isDischarged && (
                                      <button type="button" onClick={e=>{e.stopPropagation();setPrintTarget({type:'discharge',rec:{...a.discharge_summary},admission:a})}}
                                        className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded-md font-bold hover:bg-teal-700 flex items-center gap-1 mr-1">
                                        <Printer size={9} /> Print
                                      </button>
                                    )}
                                    <ChevronDown size={13} className={`text-teal-400 transition-transform duration-200 ${subOpen?'rotate-180':''}`} />
                                  </button>
                                  {subOpen && (
                                    <div className="p-3 space-y-2 border-t border-teal-100">
                                      {[['Condition at Discharge',a.discharge_summary.condition_at_discharge],['Treatment Given',a.discharge_summary.treatment_given],['Medications on Discharge',a.discharge_summary.medications_on_discharge],['Follow-up Advice',a.discharge_summary.follow_up_advice]].filter(([,v])=>v).map(([l,val])=>(
                                        <div key={l} className="flex gap-2 text-xs">
                                          <span className="text-teal-600 font-bold shrink-0 w-44">{l}:</span>
                                          <span className="text-gray-700">{val}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>) : (
                            <button type="button" onClick={() => loadLedger(a.id)}
                              className="flex items-center gap-2 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm">
                              <Receipt size={12} /> Load Full Ledger
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>

    {tlPayCancel && (
      <div className="fixed inset-0 z-[340] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { if (!tlPayCancelling) { setTlPayCancel(null); setTlPayCancelReason('') } }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 bg-red-600 text-white flex items-center justify-between">
            <h3 className="font-bold">Cancel payment receipt</h3>
            <button type="button" onClick={() => { if (!tlPayCancelling) { setTlPayCancel(null); setTlPayCancelReason('') } }} className="text-white/80 hover:text-white" disabled={tlPayCancelling}><X size={18} /></button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700">
              Cancelling payment for <span className="font-black">{tlPayCancel.invoice_no || '—'}</span>
              {' · '}
              <span className="font-semibold">₹{parseFloat(tlPayCancel.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Cancellation reason *</label>
              <textarea value={tlPayCancelReason} onChange={e => setTlPayCancelReason(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none" disabled={tlPayCancelling} placeholder="Enter reason" />
            </div>
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
            <button type="button" onClick={() => { if (!tlPayCancelling) { setTlPayCancel(null); setTlPayCancelReason('') } }} disabled={tlPayCancelling} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200">Close</button>
            <button type="button" onClick={submitTlPayCancel} disabled={tlPayCancelling} className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700">{tlPayCancelling ? 'Cancelling…' : 'Confirm cancel'}</button>
          </div>
        </div>
      </div>
    )}

    {tlPayEdit && (
      <div className="fixed inset-0 z-[340] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !tlPaySaving && setTlPayEdit(null)}>
        <form onSubmit={handleTlPayEditSave} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between text-white">
            <h2 className="font-bold">Edit payment slip</h2>
            <button type="button" onClick={() => !tlPaySaving && setTlPayEdit(null)}><X size={18} /></button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Paid at</label>
              <input type="datetime-local" value={tlPayEdit.paid_at || ''} onChange={e => setTlPayEdit({ ...tlPayEdit, paid_at: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Amount</label>
                <input type="number" step="0.01" value={tlPayEdit.amount ?? ''} onChange={e => setTlPayEdit({ ...tlPayEdit, amount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Mode</label>
                <select value={tlPayEdit.payment_mode || 'cash'} onChange={e => setTlPayEdit({ ...tlPayEdit, payment_mode: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Transaction reference</label>
              <input type="text" value={tlPayEdit.transaction_reference || ''} onChange={e => setTlPayEdit({ ...tlPayEdit, transaction_reference: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Receipt number</label>
              <input type="text" value={tlPayEdit.receipt_no || ''} onChange={e => setTlPayEdit({ ...tlPayEdit, receipt_no: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
              <select value={tlPayEdit.status || 'success'} onChange={e => setTlPayEdit({ ...tlPayEdit, status: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
            <button type="button" onClick={() => !tlPaySaving && setTlPayEdit(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200">Close</button>
            <button type="submit" disabled={tlPaySaving} className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700">{tlPaySaving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    )}

    {/* ── Print portals ── */}
    {printTarget?.type==='opd_receipt' && <PrintOpdReceipt visit={printTarget.visit} patient={printTarget.visit} onClose={()=>setPrintTarget(null)} />}
    {printTarget?.type==='opd_slip' && <PrintSlip visit={printTarget.visit} onClose={()=>setPrintTarget(null)} />}
    {printTarget?.type==='full_bill' && <PrintIpdLedger admission={printTarget.admission} ledger={printTarget.ledger} onClose={()=>setPrintTarget(null)} />}
    {printTarget?.type==='discharge' && <PrintDischargeSummary rec={printTarget.rec} admission={printTarget.admission} onClose={()=>setPrintTarget(null)} />}
    {printTarget?.type==='ipd_receipt' && (
      <PrintMiniReceipt
        admission={printTarget.admission}
        data={printTarget.receiptData}
        type={printTarget.receiptType}
        viewOnly={!!printTarget.viewOnly}
        onClose={()=>setPrintTarget(null)}
      />
    )}
    </>
  )
}

function PatientListSection() {
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [timelineFor, setTimelineFor] = useState(null)
  const PAGE_SIZE = 10
  const debounceRef = useRef(null)
  const isSearchFetchScheduledRef = useRef(false)

  useEffect(() => {
    setPage(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    isSearchFetchScheduledRef.current = true
    debounceRef.current = setTimeout(() => {
      isSearchFetchScheduledRef.current = false
      fetchPatients(0, search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      isSearchFetchScheduledRef.current = false
    }
  }, [search])

  useEffect(() => {
    // When `search` changes, we reset `page` to 0 and schedule a debounced fetch.
    // Prevent the `page` effect from firing the immediate second fetch for offset=0.
    if (isSearchFetchScheduledRef.current && page === 0) return
    fetchPatients(page, search)
  }, [page])

  async function fetchPatients(pg = 0, q = '') {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE })
      if (q.trim()) params.set('search', q.trim())
      const { data } = await api.get(`/patients/?${params}`)
      setPatients(data?.data || data?.results || data || [])
      setTotal(data?.count ?? data?.total ?? (data?.data?.length ?? 0))
    } catch { toast.error('Failed to load patients') }
    finally { setLoading(false) }
  }

  function pName(p) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.uhid || 'Patient'
  }

  function calcAge(dob) {
    if (!dob) return null
    const d = new Date(dob), t = new Date()
    let age = t.getFullYear() - d.getFullYear()
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--
    return age
  }

  const genderColor = { male: 'bg-blue-50 text-blue-700 border-blue-200', female: 'bg-pink-50 text-pink-700 border-pink-200', other: 'bg-purple-50 text-purple-700 border-purple-200' }
  const genderLabel = { male: 'Male', female: 'Female', other: 'Other' }
  const avatarColor = ['bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700']
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function openTimeline(patient) {
    if (!patient?.uhid) {
      toast.error('UHID not available for this patient')
      return
    }
    setTimelineFor(patient)
  }

  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {[['Total Patients', total, 'text-gray-900'], ['Showing', total === 0 ? '0' : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)}`, 'text-emerald-600']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{l}</p>
              <p className={`text-2xl font-black ${c}`}>{v}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search bar */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/60">
          <Search size={15} className="text-gray-400 shrink-0" strokeWidth={2} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, UHID, phone…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          />
          {loading && <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />}
          <button onClick={() => fetchPatients(page, search)} className="text-gray-400 hover:text-emerald-600 shrink-0">
            <RefreshCw size={14} strokeWidth={2} />
          </button>
          <span className="text-xs text-gray-400 shrink-0">{total} total</span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 px-4 py-2 bg-gray-100/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-4">Patient</div>
          <div className="col-span-3">UHID</div>
          <div className="col-span-2">Phone</div>
          <div className="col-span-1 text-center">Gender</div>
          <div className="col-span-1 text-center">Age</div>
          <div className="col-span-1 text-right">Registered</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50 flex-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : patients.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No patients found</div>
          ) : patients.map((p, idx) => {
            const initials = ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase() || '?'
            const age = p.age ?? calcAge(p.dob)
            const regDate = p.created_at ? format(new Date(p.created_at), 'd/M/yyyy') : '—'
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-emerald-50/40 cursor-pointer group transition-colors"
              >
                <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor[idx % 5]}`}>
                    {initials}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-emerald-800">{pName(p)}</p>
                </div>
                <div className="col-span-3 text-xs text-gray-500 font-mono truncate">{p.uhid}</div>
                <div className="col-span-2 text-xs text-gray-500">{p.phone || '—'}</div>
                <div className="col-span-1 flex justify-center">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${genderColor[p.gender] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {genderLabel[p.gender]?.[0] || '—'}
                  </span>
                </div>
                <div className="col-span-1 text-center text-xs text-gray-500">{age ?? '—'}</div>
                <div className="col-span-1 text-right text-xs text-gray-400">{regDate}</div>
                <div className="col-span-12 mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openTimeline(p) }}
                    className="text-[10px] bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md font-bold hover:bg-indigo-200"
                  >
                    View Timeline
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1 py-1">
        {/* Left: showing count */}
        <span className="text-sm text-gray-400 font-medium">
          {total === 0
            ? 'No patients found'
            : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
        </span>

        {/* Right: prev / page info / next */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 font-medium px-1">
            Page {page + 1} of {totalPages || 1}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || totalPages === 0}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>


      {/* ── Patient detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shrink-0 ${avatarColor[0]}`}>
                {((selected.first_name?.[0] || '') + (selected.last_name?.[0] || '')).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-lg truncate">{pName(selected)}</p>
                <p className="text-emerald-100 text-sm">{selected.uhid}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white shrink-0">
                <XCircle size={22} strokeWidth={1.8} />
              </button>
            </div>

            {/* Details grid */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Phone', selected.phone || '—', '📞'],
                  ['Gender', genderLabel[selected.gender] || selected.gender || '—', '🧬'],
                  ['Age', (selected.age ?? calcAge(selected.dob) ?? '—') + (selected.age || calcAge(selected.dob) ? ' yrs' : ''), '🎂'],
                  ['Date of Birth', selected.dob || '—', '📅'],
                  ['Blood Group', selected.blood_group || '—', '🩸'],
                  ['Email', selected.email || '—', '✉️'],
                  ['Address', [selected.address_line1, selected.city, selected.state].filter(Boolean).join(', ') || '—', '📍'],
                  ['Registered', selected.created_at ? format(new Date(selected.created_at), 'd/M/yyyy') : '—', '🗓️'],
                ].map(([label, value, icon]) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selected.emergency_tags && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected.emergency_tags.split(',').filter(Boolean).map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">{t.trim()}</span>
                  ))}
                </div>
              )}

              {String(selected.registration_note || '').trim() !== '' && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50/90 border border-amber-100">
                  <p className="text-[11px] font-semibold text-amber-900/80 uppercase tracking-wide mb-1.5">Registration note</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{selected.registration_note}</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-4">
              <button onClick={() => setSelected(null)}
                className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {timelineFor && (
        <PatientLifetimeTimelineModal
          patient={timelineFor}
          onClose={() => setTimelineFor(null)}
        />
      )}
    </div>
  )
}

// ─── Register Patient ─────────────────────────────────────────────────────────
function RegisterPatientSection() {
  const EMPTY = { first_name: '', last_name: '', dob: '', gender: 'male', phone: '', email: '', blood_group: '', registration_note: '' }
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        gender: form.gender,
        dob: form.dob || undefined,
        phone: form.phone,
        email: form.email,
        blood_group: form.blood_group,
        registration_note: form.registration_note?.trim() || undefined,
      }
      const { data } = await api.post('/patients/', payload)
      const patient = data?.data || data
      toast.success(`Patient registered! UHID: ${patient?.uhid || '—'}`)
      setForm(EMPTY)
    } catch (err) {
      const errData = err.response?.data
      const msg = errData?.detail || (errData?.errors ? JSON.stringify(errData.errors) : null) || 'Registration failed'
      toast.error(msg)
    } finally { setSubmitting(false) }
  }

  const tf = (label, key, type = 'text', placeholder = '', required = false) => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}{required && ' *'}</label>
      {type === 'date' ? (
        <div className="relative">
          <input
            type="text"
            readOnly
            value={form[key] ? format(new Date(form[key]), 'd/M/yyyy') : ''}
            onClick={(e) => e.target.nextSibling.showPicker()}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer bg-white"
            placeholder={placeholder || "Select date..."}
          />
          <input
            type="date"
            className="absolute inset-0 opacity-0 pointer-events-none"
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            required={required}
          />
        </div>
      ) : (
        <input type={type} 
          value={form[key]} 
          onChange={e => {
            let v = e.target.value;
            if (type === 'tel') v = v.replace(/\D/g, '').slice(0, 10);
            setForm(f => ({ ...f, [key]: v }));
          }}
          maxLength={type === 'tel' ? 10 : undefined}
          placeholder={placeholder} required={required}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
      )}
    </div>
  )

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <UserPlus size={20} className="text-emerald-500" /> Register New Patient
      </h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {tf('First Name', 'first_name', 'text', 'First name', true)}
          {tf('Last Name', 'last_name', 'text', 'Last name', true)}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Gender</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          {tf('Date of Birth', 'dob', 'date')}
          {tf('Phone', 'phone', 'tel', '10-digit mobile number')}
          {tf('Email', 'email', 'email', 'optional')}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Blood Group</label>
            <select value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <option value="">Unknown</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Registration note</label>
          <textarea
            value={form.registration_note}
            onChange={e => setForm(f => ({ ...f, registration_note: e.target.value }))}
            rows={4}
            maxLength={2000}
            placeholder="Optional — why this patient is being registered (visible on their record)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-y min-h-[88px]"
          />
          <p className="text-[11px] text-gray-400 mt-1">{form.registration_note?.length || 0} / 2000</p>
        </div>
        <button type="submit" disabled={submitting}
          className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
          <UserPlus size={14} /> {submitting ? 'Registering…' : 'Register Patient'}
        </button>
      </form>
    </div>
  )
}

function PrintDischargeSummary({ rec, admission: admissionProp, onClose, onPrintBill, externalPrintBillLoading = false, onBeforePrintDocument }) {
  const printRef = useRef(null)
  const slipProfile = getPaymentSlipProfile()
  const hospitalName = (slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name).toUpperCase()
  const address = slipProfile.address || DEFAULT_PAYMENT_SLIP_PROFILE.address
  const pinCode = slipProfile.pin_code || DEFAULT_PAYMENT_SLIP_PROFILE.pin_code
  const phone = slipProfile.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone
  const email = slipProfile.email || DEFAULT_PAYMENT_SLIP_PROFILE.email
  const website = slipProfile.website || DEFAULT_PAYMENT_SLIP_PROFILE.website
  const adm = admissionProp || {}

  const [billPrintTarget, setBillPrintTarget] = useState(null)
  const [billPrintLoading, setBillPrintLoading] = useState(false)

  function resolveAdmissionIdForBill() {
    const raw = rec?.admission ?? adm?.id ?? adm
    if (raw && typeof raw === 'object' && raw !== null && 'id' in raw) return raw.id
    return raw
  }

  async function handlePrintBillFromPreview() {
    if (onPrintBill) {
      onPrintBill(rec)
      return
    }
    const admissionId = resolveAdmissionIdForBill()
    if (!admissionId) {
      toast.error('Missing admission for billing')
      return
    }
    setBillPrintLoading(true)
    try {
      const [{ data: admission }, { data: ledger }] = await Promise.all([
        api.get(`/ipd-admissions/${admissionId}/`),
        api.get(`/ipd-admissions/${admissionId}/ledger/`),
      ])
      setBillPrintTarget({ admission, ledger })
    } catch {
      toast.error('Could not load bill for printing')
    } finally {
      setBillPrintLoading(false)
    }
  }

  const billBtnBusy = onPrintBill ? externalPrintBillLoading : billPrintLoading

  const fmtDischargeWhen = () => {
    if (rec.discharge_date) {
      try {
        let s = format(new Date(`${rec.discharge_date}T12:00:00`), 'd/M/yyyy')
        if (rec.discharge_time) {
          const t = String(rec.discharge_time)
          s += ` ${t.slice(0, 5)}`
        }
        return s
      } catch {
        return '—'
      }
    }
    return rec.created_at ? format(new Date(rec.created_at), 'd/M/yyyy HH:mm') : '—'
  }

  const vitals = rec.vitals_at_discharge && typeof rec.vitals_at_discharge === 'object' ? rec.vitals_at_discharge : {}
  
  useEffect(() => {
    function handleAfterPrint() {
      if (receptionistLastPrintKind === 'ipd_ledger') {
        receptionistLastPrintKind = null
        return
      }
      receptionistLastPrintKind = null
      onClose()
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [onClose])

  const surgeryRows = Array.isArray(rec.surgery_rows) && rec.surgery_rows.length > 0
    ? rec.surgery_rows
    : (
      (rec.procedure_surgery || rec.surgery_date || rec.surgeon_name || rec.anaesthetist_name || rec.anaesthesia_type || rec.operative_findings || rec.intra_op_complications)
        ? [{
            surgery_date: rec.surgery_date || '',
            procedure_name: rec.procedure_surgery || '',
            surgeon_name: rec.surgeon_name || '',
            assistant_name: rec.assistant_name || '',
            anaesthetist_name: rec.anaesthetist_name || '',
            anaesthesia_type: rec.anaesthesia_type || '',
            operative_findings: rec.operative_findings || '',
            intra_op_complications: rec.intra_op_complications || '',
          }]
        : []
    )

  const clinicalSections = [
    { label: 'Chief complaints', val: rec.chief_complaints },
    { label: 'Reason for admission', val: rec.reason_for_admission },
    { label: 'Diagnosis', val: rec.diagnosis },
    { label: 'Co-morbidities', val: rec.co_morbidities },
    { label: 'Allergies', val: rec.allergies },
    { label: 'Medical history', val: rec.medical_history },
    { label: 'Family history', val: rec.family_history },
    { label: 'Personal history', val: rec.personal_history },
    { label: 'Physical examination', val: rec.physical_examination },
    { label: 'Treatment given', val: rec.treatment_given },
    {
      label: 'Procedure / surgery (summary)',
      val: rec.procedure_surgery || surgeryRows.map((r) => r.procedure_name || r.procedure_surgery || '').filter(Boolean).join('; ')
    },
    { label: 'Investigations (notes)', val: rec.investigations },
    { label: 'Course in hospital', val: rec.course_in_hospital },
    { label: 'Complications during stay', val: rec.complications_during_stay },
    { label: 'Blood transfusion', val: rec.blood_transfusion_details },
    { label: 'Implants', val: rec.implants_used },
    { label: 'Indwelling devices', val: rec.indwelling_devices_on_discharge },
    { label: 'Vaccination', val: rec.vaccination_given },
  ].filter(s => s.val && String(s.val).trim() !== '')

  const labRows = (rec.investigation_rows || []).filter(r => (r.category || 'lab') === 'lab')
  const imgRows = (rec.investigation_rows || []).filter(r => r.category === 'imaging')
  const medRows = rec.medication_rows || []
  const showOperative = surgeryRows.length > 0

  const content = (
    <div id="__discharge_doc_root" className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center print:static print:p-0 print:block print:bg-transparent">
      <div className="w-full max-w-[1120px] max-h-[94vh] bg-white rounded-2xl shadow-2xl overflow-hidden print:max-h-none print:rounded-none print:shadow-none">
        <div className="print:hidden sticky top-0 z-20 px-4 py-3 border-b border-gray-200 bg-white/95 backdrop-blur flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrintBillFromPreview}
            disabled={billBtnBusy}
            title="Print IPD bill (A4)"
            className="inline-flex items-center gap-2 bg-teal-50 text-teal-900 border border-teal-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-teal-100 disabled:opacity-50 shrink-0"
          >
            <Receipt size={16} /> Print bill
          </button>
          <button
            type="button"
            onClick={() => {
              onBeforePrintDocument?.()
              setTimeout(() => {
                receptionistLastPrintKind = 'discharge'
                window.print()
              }, 0)
            }}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 shrink-0"
          >
            Print Document
          </button>
          <button type="button" onClick={onClose} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 shrink-0">Close Preview</button>
        </div>

        <div className="overflow-y-auto max-h-[calc(94vh-56px)] print:overflow-visible print:max-h-none p-3 sm:p-5 print:p-0">
      <div ref={printRef} className="mx-auto w-full max-w-[210mm] text-black bg-white print:shadow-none shadow-sm">
        
        {/* ── PAGE 1: CLINICAL DISCHARGE SUMMARY (MEDANTA STYLE) ── */}
        <div className="p-4 sm:p-[15mm] print:p-0 min-h-screen print:min-h-[281mm] flex flex-col relative">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center font-black text-2xl text-gray-400">LOGO</div>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-black tracking-tight">{hospitalName}</h1>
              <p className="text-sm text-gray-600 font-medium">{address}, PIN: {pinCode}</p>
              <h2 className="text-xl font-bold mt-2 uppercase tracking-widest border-t border-gray-100 pt-1 inline-block">Discharge Summary</h2>
            </div>
            <div className="w-16" aria-hidden />
          </div>

          {/* Patient & meta */}
          <div className="border border-gray-800 p-3 mb-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs break-inside-avoid">
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Patient</span> <span className="uppercase text-right">{rec.patient_name}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">UHID</span> <span className="font-mono">{rec.patient_uhid || '—'}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">ABHA / Insurance</span> <span className="text-right text-[10px]">{[rec.abha_id, rec.insurance_provider, rec.policy_number].filter(Boolean).join(' · ') || '—'}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">IPD / Ward / Bed</span> <span className="text-right">{rec.admission_ipd_no || '—'} / {adm.ward_name || '—'} / {adm.bed_code || '—'}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Department</span> <span>{adm.department || '—'}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Discharge type</span> <span className="font-bold uppercase">{(rec.discharge_type || 'routine').replace(/_/g, ' ')}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Admission</span> <span>{rec.admission_date ? format(new Date(rec.admission_date), 'd/M/yyyy') : '—'}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Discharge</span> <span>{fmtDischargeWhen()}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Printed at</span> <span>{format(new Date(), 'd/M/yyyy HH:mm')}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Treating consultant</span> <span className="text-right">{rec.treating_consultant || adm.assigned_doctor_name || '—'}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-0.5"><span className="font-bold">Reg. no. / RMO</span> <span className="text-right text-[10px]">{[rec.consultant_registration_no, rec.rmo_signed_by].filter(Boolean).join(' · ') || '—'}</span></div>
            <div className="col-span-2 flex justify-between border-b border-gray-200 py-0.5"><span className="font-bold">Condition at discharge</span> <span className="font-bold text-right">{rec.condition_at_discharge || '—'}</span></div>
          </div>

          {(vitals.bp || vitals.pulse || vitals.spo2 || vitals.temp || vitals.weight || vitals.rbs) && (
            <div className="mb-4 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] border border-gray-200 rounded-lg p-2 break-inside-avoid">
              {[{ k: 'bp', l: 'BP' }, { k: 'pulse', l: 'Pulse' }, { k: 'spo2', l: 'SpO₂' }, { k: 'temp', l: 'Temp' }, { k: 'weight', l: 'Wt' }, { k: 'rbs', l: 'RBS' }].map(({ k, l }) => (
                vitals[k] ? (
                  <div key={k} className="text-center border border-gray-100 rounded px-1 py-1 bg-gray-50"><span className="font-black text-gray-500 block">{l}</span>{vitals[k]}</div>
                ) : null
              ))}
            </div>
          )}

          <div className="space-y-4 text-sm flex-1">
            {clinicalSections.map((sec, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <h3 className="font-black uppercase tracking-tight text-gray-800 text-xs underline decoration-gray-200">{sec.label} :</h3>
                <div className="whitespace-pre-wrap break-words pl-2 border-l-2 border-emerald-100 leading-relaxed text-gray-700 text-xs">{sec.val}</div>
              </div>
            ))}

            {showOperative && (
              <div className="border border-gray-200 rounded-lg p-3 break-inside-avoid">
                <h3 className="font-black uppercase text-xs mb-2">Operative details</h3>
                <div className="space-y-3">
                  {surgeryRows.map((row, idx) => (
                    <div key={`print-surgery-${idx}`} className="border border-gray-100 rounded-md p-2">
                      <p className="font-bold text-xs mb-1">Surgery #{idx + 1}: {row.procedure_name || row.procedure_surgery || 'Procedure'}</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                        {row.surgery_date && <div><span className="font-bold">Date:</span> {format(new Date(`${row.surgery_date}T12:00:00`), 'd/M/yyyy')}</div>}
                        {row.surgeon_name && <div><span className="font-bold">Surgeon:</span> {row.surgeon_name}</div>}
                        {row.assistant_name && <div><span className="font-bold">Assistant:</span> {row.assistant_name}</div>}
                        {row.anaesthetist_name && <div><span className="font-bold">Anaesthetist:</span> {row.anaesthetist_name}</div>}
                        {row.anaesthesia_type && <div><span className="font-bold">Anaesthesia:</span> {row.anaesthesia_type}</div>}
                      </div>
                      {(row.operative_findings || row.intra_op_complications) && (
                        <div className="mt-2 space-y-1 text-xs whitespace-pre-wrap">
                          {row.operative_findings && <p><span className="font-bold">Findings:</span> {row.operative_findings}</p>}
                          {row.intra_op_complications && <p><span className="font-bold">Intra-op complications:</span> {row.intra_op_complications}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(labRows.length > 0 || imgRows.length > 0) && (
              <div className="space-y-3 break-inside-avoid">
                <h3 className="font-black uppercase text-xs">Investigations</h3>
                {labRows.length > 0 && (
                  <table className="w-full border-collapse border border-gray-800 text-[11px]">
                    <thead><tr className="bg-gray-100"><th className="border border-gray-800 px-2 py-1 text-left">Lab test</th><th className="border border-gray-800 px-2 py-1">Value</th><th className="border border-gray-800 px-2 py-1">Ref.</th><th className="border border-gray-800 px-2 py-1">Date</th></tr></thead>
                    <tbody>
                      {labRows.map((r, i) => (
                        <tr key={i}><td className="border border-gray-800 px-2 py-1">{r.test_name}</td><td className="border border-gray-800 px-2 py-1">{r.value || '—'}</td><td className="border border-gray-800 px-2 py-1">{r.reference_range || '—'}</td><td className="border border-gray-800 px-2 py-1">{r.test_date ? format(new Date(`${r.test_date}T12:00:00`), 'd/M/yy') : '—'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {imgRows.length > 0 && (
                  <table className="w-full border-collapse border border-gray-800 text-[11px]">
                    <thead><tr className="bg-gray-100"><th className="border border-gray-800 px-2 py-1 text-left">Imaging</th><th className="border border-gray-800 px-2 py-1">Summary</th><th className="border border-gray-800 px-2 py-1">Date</th></tr></thead>
                    <tbody>
                      {imgRows.map((r, i) => (
                        <tr key={i}><td className="border border-gray-800 px-2 py-1">{r.test_name}</td><td className="border border-gray-800 px-2 py-1">{r.value || '—'}</td><td className="border border-gray-800 px-2 py-1">{r.test_date ? format(new Date(`${r.test_date}T12:00:00`), 'd/M/yy') : '—'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200">
              <h2 className="text-center font-black text-lg uppercase tracking-[0.15em] mb-3 italic">Advice on Discharge</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="font-black uppercase text-xs mb-1">Discharge medication</h3>
                  {medRows.length > 0 ? (
                    <table className="w-full border-collapse border border-gray-800 text-[10px]">
                      <thead><tr className="bg-gray-100"><th className="border border-gray-800 px-1 py-1 text-left">Drug</th><th className="border border-gray-800 px-1 py-1">Dose</th><th className="border border-gray-800 px-1 py-1">Route</th><th className="border border-gray-800 px-1 py-1">Freq</th><th className="border border-gray-800 px-1 py-1">Dur</th><th className="border border-gray-800 px-1 py-1">Notes</th></tr></thead>
                      <tbody>
                        {medRows.map((r, i) => {
                          const manual = r.rx_meta && r.rx_meta.type === 'manual'
                          return (
                            <tr key={i}>
                              <td className="border border-gray-800 px-1 py-0.5">{r.drug_name}{manual ? <span className="text-amber-800 font-bold"> [not in pharmacy]</span> : null}</td>
                              <td className="border border-gray-800 px-1 py-0.5">{r.dose || '—'}</td>
                              <td className="border border-gray-800 px-1 py-0.5">{r.route || '—'}</td>
                              <td className="border border-gray-800 px-1 py-0.5">{r.frequency || '—'}</td>
                              <td className="border border-gray-800 px-1 py-0.5">{r.duration || '—'}</td>
                              <td className="border border-gray-800 px-1 py-0.5">{r.instructions || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="whitespace-pre-wrap font-mono text-xs bg-gray-50 p-2 rounded border border-gray-100">{rec.medications_on_discharge || 'As per prescription.'}</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs break-inside-avoid">
                  <div>
                    <h3 className="font-black uppercase text-xs mb-1">Diet & activity</h3>
                    <div className="text-gray-700 whitespace-pre-wrap">{rec.diet_advice || rec.activity_advice ? <>{rec.diet_advice && <p>{rec.diet_advice}</p>}{rec.activity_advice && <p>{rec.activity_advice}</p>}</> : <span className="text-gray-400">—</span>}</div>
                    {rec.wound_care_instructions && <p className="mt-1"><span className="font-bold">Wound care:</span> {rec.wound_care_instructions}</p>}
                    {rec.stitch_removal_date && <p className="mt-1"><span className="font-bold">Stitch removal:</span> {format(new Date(`${rec.stitch_removal_date}T12:00:00`), 'd/M/yyyy')}</p>}
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-xs mb-1">Follow-up & warnings</h3>
                    <div className="text-gray-700 whitespace-pre-wrap">{rec.follow_up_advice || rec.warning_signs ? <>{rec.follow_up_advice && <p>{rec.follow_up_advice}</p>}{rec.warning_signs && <p className="text-red-700 font-bold">{rec.warning_signs}</p>}</> : <span className="text-gray-400">—</span>}</div>
                    {(rec.next_follow_up_date || rec.follow_up_doctor) && (
                      <p className="mt-1 text-[11px]"><span className="font-bold">Next visit:</span> {rec.next_follow_up_date ? format(new Date(`${rec.next_follow_up_date}T12:00:00`), 'd/M/yyyy') : '—'} {rec.follow_up_doctor ? `· ${rec.follow_up_doctor}` : ''} {rec.follow_up_department ? `(${rec.follow_up_department})` : ''}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {rec.discharge_type === 'death' && (rec.cause_of_death || rec.time_of_death) && (
            <div className="mt-6 border-2 border-red-300 rounded-lg p-3 break-inside-avoid page-break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <h3 className="font-black uppercase text-red-800 text-sm mb-2">Death summary</h3>
              <div className="text-xs space-y-1 whitespace-pre-wrap">
                {rec.cause_of_death && <p><span className="font-bold">Cause:</span> {rec.cause_of_death}</p>}
                {rec.time_of_death && <p><span className="font-bold">Time:</span> {format(new Date(rec.time_of_death), 'd/M/yyyy HH:mm')}</p>}
                {rec.notified_to && <p><span className="font-bold">Notified to:</span> {rec.notified_to}</p>}
                {rec.autopsy_required && <p className="font-bold text-red-700">Autopsy required: Yes</p>}
              </div>
            </div>
          )}

          <div className="mt-auto pt-6 flex justify-between items-end border-t border-gray-200 break-inside-avoid gap-8">
            <div className="text-[10px] text-gray-400 font-medium flex-1">
              <p>Regd. Office: {address}</p>
              <p>Contact: {phone} | Email: {email}</p>
              {(rec.patient_education_given || rec.attendant_counselled_by) && (
                <p className="mt-1">Patient education: {rec.patient_education_given ? 'Yes' : 'No'}{rec.attendant_counselled_by ? ` · Counselled by: ${rec.attendant_counselled_by}` : ''}</p>
              )}
            </div>
            <div className="text-center w-44">
              <div className="h-10 flex items-center justify-center italic text-gray-300 text-[10px]">Signature</div>
              <div className="border-t border-gray-800 pt-1 font-black text-[10px] uppercase tracking-wider">{rec.treating_consultant || 'Consultant'}</div>
            </div>
            <div className="text-center w-44">
              <div className="h-10 flex items-center justify-center italic text-gray-300 text-[10px]">Signature</div>
              <div className="border-t border-gray-800 pt-1 font-black text-[10px] uppercase tracking-wider">{rec.rmo_signed_by || 'RMO / Medical Officer'}</div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body, html { background: #fff !important; height: auto !important; overflow: visible !important; }
          /* Do not hide #__ipd_ledger_root: bill portal shares body with this portal; hiding it blanked IPD print preview. */
          body > *:not(#__discharge_doc_root):not(#__ipd_ledger_root) { display: none !important; }
          #__discharge_doc_root { 
            position: static !important; 
            display: block !important; 
            overflow: visible !important; 
            height: auto !important; 
            padding: 0 !important; 
            margin: 0 !important;
            zoom: 1;
          }
          #__discharge_doc_root > div:last-child { margin: 0 !important; box-shadow: none !important; border: none !important; max-height: none !important; overflow: visible !important; }
          .print\\:hidden, .print\\:hidden * { display: none !important; visibility: hidden !important; }
        }
      `}</style>
    </div>
  )

  return (
    <>
      {createPortal(content, document.body)}
      {!onPrintBill && billPrintTarget && (
        <PrintIpdLedger admission={billPrintTarget.admission} ledger={billPrintTarget.ledger} onClose={() => setBillPrintTarget(null)} />
      )}
    </>
  )
}

function DischargeSection() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10
  const [editSummaryAdmission, setEditSummaryAdmission] = useState(null)
  const [loadingEditAdmission, setLoadingEditAdmission] = useState(false)

  useEffect(() => {
    setPage(0)
  }, [search])
  const [printData, setPrintData] = useState(null)
  const [billPrintTarget, setBillPrintTarget] = useState(null)
  const [billPrintLoading, setBillPrintLoading] = useState(false)

  useEffect(() => { 
    fetchDischarged()
  }, [])

  async function fetchDischarged() {
    setLoading(true)
    try {
      const { data } = await api.get('/summaries/?limit=500')
      setRecords(data?.data || data?.results || data || [])
    } catch { toast.error('Failed to load discharge records') }
    finally { setLoading(false) }
  }


  function handlePrintClick(rec) {
    setPrintData({ rec })
  }

  async function handlePrintBillFromHistory(r) {
    if (!r?.admission) {
      toast.error('Missing admission for this record')
      return
    }
    setBillPrintLoading(true)
    try {
      const [{ data: admission }, { data: ledger }] = await Promise.all([
        api.get(`/ipd-admissions/${r.admission}/`),
        api.get(`/ipd-admissions/${r.admission}/ledger/`),
      ])
      setBillPrintTarget({ admission, ledger })
    } catch {
      toast.error('Could not load bill for printing')
    } finally {
      setBillPrintLoading(false)
    }
  }

  async function openDischargeSummaryEdit(rec) {
    if (!rec?.admission) {
      toast.error('Missing admission for this record')
      return
    }
    setLoadingEditAdmission(true)
    try {
      const { data } = await api.get(`/ipd-admissions/${rec.admission}/`)
      setEditSummaryAdmission(data)
    } catch {
      toast.error('Could not load admission to edit summary')
    } finally {
      setLoadingEditAdmission(false)
    }
  }

  const filteredHistory = records.filter(r => {
    const q = search.toLowerCase()
    return !q || (r.patient_name || '').toLowerCase().includes(q) || (r.patient_uhid || '').toLowerCase().includes(q)
  })

  const total = filteredHistory.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const paginatedHistory = filteredHistory.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      {editSummaryAdmission && (
        <AdmissionLedgerModal
          admission={editSummaryAdmission}
          onClose={() => setEditSummaryAdmission(null)}
          autoOpenDischargeEdit
        />
      )}
      {printData && (
        <PrintDischargeSummary
          rec={printData.rec}
          onClose={() => setPrintData(null)}
          onPrintBill={handlePrintBillFromHistory}
          externalPrintBillLoading={billPrintLoading}
          onBeforePrintDocument={() => setBillPrintTarget(null)}
        />
      )}
      {billPrintTarget && (
        <PrintIpdLedger admission={billPrintTarget.admission} ledger={billPrintTarget.ledger} onClose={() => setBillPrintTarget(null)} />
      )}

      {/* ── Discharge History ── */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[['Total Discharges', total, 'text-gray-900'], ['Showing', total === 0 ? '0' : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)}`, 'text-blue-600']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{l}</p>
              <p className={`text-2xl font-black ${c}`}>{v}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[calc(100vh-320px)]">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
          <Search size={16} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search discharge history..."
            className="flex-1 text-sm outline-none bg-transparent" />
          <button onClick={fetchDischarged} className="text-gray-400 hover:text-emerald-600"><RefreshCw size={14} /></button>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm italic">Loading history...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No discharge records found</div>
        ) : (
          <div className="divide-y divide-gray-50 flex-1">
            {paginatedHistory.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  {r.patient_name ? r.patient_name[0].toUpperCase() : <FileText size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{r.patient_name || 'Unknown Patient'}</p>
                  <p className="text-xs text-gray-400">
                    Adm: {r.admission_date ? `${format(new Date(r.admission_date), 'd/M/yyyy')} (${format(new Date(r.created_at || Date.now()), 'HH:mm')})` : '--'} · ID: {r.id.slice(0,8)}
                  </p>
                </div>
                <div className="text-right mr-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${parseFloat(r.outstanding_balance) > 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                    Balance: ₹{Number(r.outstanding_balance).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openDischargeSummaryEdit(r)}
                  disabled={loadingEditAdmission}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                  <Edit2 size={15} /> Edit summary
                </button>
                <div
                  className="inline-flex rounded-xl border border-teal-200/70 bg-white shadow-sm overflow-hidden shrink-0"
                  role="group"
                  aria-label="Bill and discharge slip"
                >
                  <button
                    type="button"
                    onClick={() => handlePrintBillFromHistory(r)}
                    disabled={billPrintLoading}
                    title="Print IPD bill (A4)"
                    className="text-xs px-3 py-1.5 font-bold flex items-center gap-2 transition-colors disabled:opacity-50 border-0 border-r border-teal-200/80 bg-teal-50 text-teal-900 hover:bg-teal-100 active:bg-teal-100/90"
                  >
                    <Receipt size={15} /> Print bill
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintClick(r)}
                    className="text-xs px-3 py-1.5 font-bold flex items-center gap-2 transition-colors border-0 bg-sky-50 text-sky-900 hover:bg-sky-100 active:bg-sky-100/90"
                  >
                    <Printer size={15} /> View Details & Slip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      {filteredHistory.length > 0 && !loading && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-sm text-gray-400 font-medium">
            {total === 0 ? 'No records found' : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <span className="text-sm text-gray-500 font-medium px-1">
              Page {page + 1} of {totalPages || 1}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || totalPages === 0}
              className="px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        </div>
      )}


    </div>
  )
}

// ─── Payment Slip ─────────────────────────────────────────────────────────────
const QUICK_SERVICES_STORAGE_KEY = 'payment_quick_services'
const DEFAULT_QUICK_SERVICES = [
  { label: 'X-Ray', price: 300 },
  { label: 'ECG', price: 200 },
  { label: 'Blood Test (CBC)', price: 250 },
  { label: 'Urine Test', price: 150 },
  { label: 'OPD Consultation', price: 500 },
  { label: 'Dressing', price: 100 },
  { label: 'Injection', price: 80 },
  { label: 'Ultrasound', price: 600 },
  { label: 'MRI', price: 3500 },
  { label: 'CT Scan', price: 2500 },
]

function PaymentSlipSection() {
  const [ptSearch, setPtSearch] = useState('')
  const [ptResults, setPtResults] = useState([])
  const [ptSearching, setPtSearching] = useState(false)
  const [patient, setPatient] = useState(null)
  const [items, setItems] = useState([{ description: '', unit_price: '', quantity: 1 }])
  const [discount, setDiscount] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [encounterType, setEncounterType] = useState('opd')
  const [referredBy, setReferredBy] = useState('')
  const [purpose, setPurpose] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [invoice, setInvoice] = useState(null)

  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newPt, setNewPt] = useState({ name: '', phone: '', address: '' })
  const [quickServices, setQuickServices] = useState(DEFAULT_QUICK_SERVICES)
  const [showQuickServiceEditor, setShowQuickServiceEditor] = useState(false)
  const [newQuickLabel, setNewQuickLabel] = useState('')
  const [newQuickPrice, setNewQuickPrice] = useState('')
  const [activeIpdByPatient, setActiveIpdByPatient] = useState({})
  const autoPrintedInvoiceNoRef = useRef(null)
  const autoResetPendingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/payments/quick-services/')
        const rows = Array.isArray(data?.data) ? data.data : []
        const normalized = rows
          .map(s => ({ label: String(s?.label || '').trim(), price: Number(s?.price || 0) }))
          .filter(s => s.label && Number.isFinite(s.price) && s.price >= 0)
        if (!cancelled && normalized.length > 0) {
          setQuickServices(normalized)
          return
        }
      } catch {
        // fallback below
      }
      try {
        const raw = JSON.parse(localStorage.getItem(QUICK_SERVICES_STORAGE_KEY) || '[]')
        if (Array.isArray(raw) && raw.length > 0) {
          const normalized = raw
            .map(s => ({ label: String(s?.label || '').trim(), price: Number(s?.price || 0) }))
            .filter(s => s.label && Number.isFinite(s.price) && s.price >= 0)
          if (!cancelled && normalized.length > 0) setQuickServices(normalized)
        }
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function persistQuickServices(nextList) {
    const payload = (nextList || [])
      .map(s => ({ label: String(s?.label || '').trim(), price: Number(s?.price || 0) }))
      .filter(s => s.label && Number.isFinite(s.price) && s.price >= 0)
    setQuickServices(payload)
    localStorage.setItem(QUICK_SERVICES_STORAGE_KEY, JSON.stringify(payload))
    try {
      await api.put('/payments/quick-services/', { services: payload })
    } catch {
      toast.error('Could not sync quick services to server')
    }
  }

  useEffect(() => {
    if (ptSearch.trim().length < 2) { setPtResults([]); return }
    const t = setTimeout(async () => {
      setPtSearching(true)
      try {
        const { data } = await api.get(`/patients/?search=${encodeURIComponent(ptSearch)}&limit=8`)
        setPtResults(Array.isArray(data?.data) ? data.data : (data?.results || []))
      } catch { setPtResults([]) }
      finally { setPtSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [ptSearch])

  useEffect(() => {
    fetchActiveIpdAdmissions()
  }, [])

  async function fetchActiveIpdAdmissions() {
    try {
      const { data } = await api.get('/ipd-admissions/?status=admitted&limit=500')
      const rows = Array.isArray(data?.data) ? data.data : (data?.results || [])
      const byPatient = {}
      rows.forEach(adm => {
        const pid = String(adm?.patient || '')
        if (pid && !byPatient[pid]) byPatient[pid] = adm
      })
      setActiveIpdByPatient(byPatient)
    } catch {
      setActiveIpdByPatient({})
    }
  }

  function addItem() {
    setItems(prev => [...prev, { description: '', unit_price: '', quantity: 1 }])
  }
  function removeItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateItem(i, field, val) {
    if (field === 'unit_price' || field === 'quantity') {
      if (val === '') {
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
        return
      }
      const numericVal = Number(val)
      if (!Number.isFinite(numericVal) || numericVal < 0) return
    }
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }
  function quickAdd(svc) {
    const label = String(svc.label || '').trim()
    const price = Number(svc.price)
    setItems(prev => {
      const sameIdx = prev.findIndex(
        it =>
          String(it.description || '').trim() === label &&
          Number.isFinite(price) &&
          Math.abs((parseFloat(String(it.unit_price)) || 0) - price) < 0.005
      )
      if (sameIdx !== -1) {
        return prev.map((it, i) => {
          if (i !== sameIdx) return it
          const q = parseFloat(String(it.quantity)) || 0
          return { ...it, quantity: q + 1 }
        })
      }
      const empty = prev.findIndex(it => !it.description)
      if (empty !== -1) {
        return prev.map((it, i) => (i === empty ? { description: svc.label, unit_price: svc.price, quantity: 1 } : it))
      }
      return [...prev, { description: svc.label, unit_price: svc.price, quantity: 1 }]
    })
  }

  function moveQuickService(index, direction) {
    const to = index + direction
    if (to < 0 || to >= quickServices.length) return
    const copy = [...quickServices]
    const tmp = copy[index]
    copy[index] = copy[to]
    copy[to] = tmp
    void persistQuickServices(copy)
  }

  function addQuickService() {
    const label = newQuickLabel.trim()
    const price = parseFloat(newQuickPrice)
    if (!label) { toast.error('Service label is required'); return }
    if (Number.isNaN(price) || price < 0) { toast.error('Enter valid price'); return }
    void persistQuickServices([...quickServices, { label, price }])
    setNewQuickLabel('')
    setNewQuickPrice('')
  }

  function removeQuickService(index) {
    void persistQuickServices(quickServices.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((sum, it) => {
    const p = parseFloat(it.unit_price) || 0
    const q = parseFloat(it.quantity) || 0
    return sum + p * q
  }, 0)
  const discountAmt = Math.min(parseFloat(discount) || 0, subtotal)
  const total = subtotal - discountAmt
  const selectedPatientHasActiveIpd = !!(patient && activeIpdByPatient[String(patient.id)])

  useEffect(() => {
    if (paymentMode === 'credit' && !selectedPatientHasActiveIpd) {
      setPaymentMode('cash')
    }
  }, [paymentMode, selectedPatientHasActiveIpd])

  async function handleSubmit(e) {
    e.preventDefault()
    if (paymentMode === 'credit' && !selectedPatientHasActiveIpd) {
      toast.error('Credit mode is available only for active IPD patients')
      return
    }
    
    let currentPatient = patient
    let targetPatientId = patient?.id

    if (isAddingNew) {
      if (!newPt.name.trim()) { toast.error('Patient name is required'); return }
      if (!newPt.gender) { toast.error('Please select patient gender'); return }
      if ((newPt.phone || '').replace(/\D/g, '').length >= 10) {
        try {
          const ten = (newPt.phone || '').replace(/\D/g, '').slice(-10)
          const existingByPhone = await api.get(`/patients/by-phone/?phone=${encodeURIComponent(ten)}`)
          const matches = Array.isArray(existingByPhone.data?.data) ? existingByPhone.data.data : []
          if (matches.length > 0) {
            toast.error(`Existing patient found with this mobile: UHID ${matches[0].uhid}. Please select existing patient.`)
            setIsAddingNew(false)
            setPtSearch(newPt.phone)
            setPtResults(matches)
            setSubmitting(false)
            return
          }
        } catch {}
      }
      setSubmitting(true)
      try {
        const parts = newPt.name.trim().split(/\s+/)
        const payload = {
          first_name: parts[0] || 'New',
          last_name: parts.slice(1).join(' ') || 'Patient',
          gender: newPt.gender,
          phone: newPt.phone || '',
          address_line1: newPt.address || '',
        }
        const { data } = await api.post('/patients/', payload)
        const created = data?.data || data?.entity || data
        targetPatientId = created.id
        currentPatient = created // Use this for the invoice set below
        setPatient(created) 
        setIsAddingNew(false)
      } catch (err) {
        toast.error('Failed to create new patient'); setSubmitting(false); return
      }
    }

    if (!targetPatientId) { toast.error('Select or create a patient first'); return }
    const validItems = items.filter(it => it.description && parseFloat(it.unit_price) > 0)
    if (!validItems.length) { toast.error('Add at least one service with a price'); return }
    
    setSubmitting(true)
    try {
      const linkedAdmission = activeIpdByPatient[String(targetPatientId)] || null
      const payload = {
        patient: targetPatientId,
        encounter_type: encounterType,
        status: 'finalized',
        discount_amount: discountAmt.toFixed(2),
        ipd_admission: linkedAdmission?.id || null,
        items: validItems.map(it => ({
          description: it.description,
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price),
        })),
      }
      const { data } = await api.post('/invoices/', payload)
      const inv = data?.data || data?.entity || data

      // For credit slips, keep amount due and skip payment entry.
      let paymentRecord = null
      if (paymentMode !== 'credit') {
        const paymentRes = await api.post('/payments/', {
          invoice: inv.id,
          payment_mode: paymentMode,
          amount: total.toFixed(2),
          status: 'success',
        })
        paymentRecord = paymentRes?.data?.data || paymentRes?.data?.entity || paymentRes?.data
      }

      setInvoice({ 
        ...inv, 
        slip_number: paymentRecord?.slip_number || '',
        patient: currentPatient || { 
          first_name: newPt.name.split(' ')[0], 
          last_name: newPt.name.split(' ').slice(1).join(' '), 
          phone: newPt.phone 
        },
        paymentMode, subtotal, discountAmt, total, referredBy, purpose, linkedAdmission
      })
      toast.success(`Invoice ${inv.invoice_no} created!`)
      toast.success(paymentMode === 'credit' ? 'Credit slip generated successfully!' : 'Payment slip recorded successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to create invoice')
    } finally { setSubmitting(false) }
  }

  function resetForm() {
    autoResetPendingRef.current = false
    autoPrintedInvoiceNoRef.current = null
    setPatient(null)
    setIsAddingNew(false)
    setNewPt({ name: '', phone: '', address: '', gender: '' })
    setPtSearch('')
    setItems([{ description: '', unit_price: '', quantity: 1 }])
    setDiscount('')
    setPaymentMode('cash')
    setReferredBy('')
    setPurpose('')
    setInvoice(null)
  }

  function printInvoice(options = {}) {
    const { onComplete } = options
    const w = createSameTabPrintWindow({ onComplete })
    const dateTimeStr = format(new Date(), 'd/M/yyyy HH:mm:ss')
    const patientName = [invoice.patient.first_name, invoice.patient.last_name].filter(Boolean).join(' ').toUpperCase() || 'PATIENT'
    const gender = invoice.patient.gender ? (invoice.patient.gender === 'male' ? 'Male' : invoice.patient.gender === 'female' ? 'Female' : 'Other') : ''
    const age = invoice.patient.age ? invoice.patient.age : ''
    const genderAge = [gender, age].filter(Boolean).join(' / ')
    const payModeLabel = invoice.paymentMode === 'cash'
      ? 'Cash Payment'
      : invoice.paymentMode === 'card'
        ? 'Card Payment'
        : invoice.paymentMode === 'upi'
          ? 'UPI Payment'
          : 'Credit / Due'
    const slipProfile = getPaymentSlipProfile()
    const hospitalName = escapeHtml(slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name)
    const address = escapeHtml(slipProfile.address || '')
    const pinCode = escapeHtml(slipProfile.pin_code || '')
    const phone = escapeHtml(slipProfile.phone || '')
    const email = escapeHtml(slipProfile.email || '')
    const website = escapeHtml(slipProfile.website || '')
    const profileLines = [
      address ? `${address}<br/>` : '',
      pinCode ? `Pin Code: ${pinCode}<br/>` : '',
      phone ? `Phone: ${phone}<br/>` : '',
      email ? `Email: ${email}<br/>` : '',
      website ? `Website: ${website}` : '',
    ].filter(Boolean).join('')

    const rows = (invoice.items || []).map((it, i) =>
      `<tr>
        <td class="c">${i + 1}</td>
        <td class="l">${it.description}</td>
        <td class="r">₹${parseFloat(it.line_total).toFixed(2)}</td>
      </tr>`
    ).join('')

    w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>Receipt — ${invoice.invoice_no}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: Arial, sans-serif;
        font-size: 11px;
        color: #111;
        width: 210mm;
        background: #fff;
      }

      /* Slip occupies exactly the top half of A4 portrait */
      .slip {
        width: 210mm;
        height: 148.5mm;
        padding: 6mm 8mm 4mm;
        display: flex;
        flex-direction: column;
        border-bottom: 2px dashed #aaa; /* cut-line */
      }

      /* ── TOP: logo left / address right ── */
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-bottom: 4mm;
        border-bottom: 2px solid #111;
        margin-bottom: 3mm;
      }
      .hosp-name {
        font-size: 22px;
        font-weight: 900;
        color: #1a6b3f;
        letter-spacing: -0.5px;
        line-height: 1;
        margin-bottom: 2px;
      }
      .hosp-tag { font-size: 9px; color: #555; letter-spacing: 0.5px; text-transform: uppercase; }
      .address { text-align: right; font-size: 9.5px; color: #333; line-height: 1.55; }
      .address strong { font-size: 10px; }

      /* ── RECEIPT title ── */
      .receipt-title {
        text-align: center;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        border-bottom: 1px solid #111;
        padding-bottom: 2mm;
        margin-bottom: 2.5mm;
      }

      /* ── Patient info grid ── */
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1.5mm 4mm;
        margin-bottom: 2.5mm;
        font-size: 10px;
      }
      .info-cell { display: flex; flex-direction: column; gap: 1px; }
      .info-label { color: #666; font-size: 9px; }
      .info-val { font-weight: 700; color: #111; }

      /* ── Table ── */
      table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
      thead tr { background: #1a6b3f; color: #fff; }
      th { padding: 3px 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
      th.c { text-align: center; width: 26px; }
      th.l { text-align: left; }
      th.r { text-align: right; width: 52px; }
      tbody tr { border-bottom: 1px solid #e5e7eb; }
      tbody tr:last-child { border-bottom: 1.5px solid #111; }
      td { padding: 3px 5px; }
      td.c { text-align: center; color: #555; }
      td.l { text-align: left; }
      td.r { text-align: right; font-weight: 600; }

      /* ── Totals ── */
      .totals { margin-left: auto; width: 160px; margin-top: 1mm; font-size: 10.5px; }
      .t-row { display: flex; justify-content: space-between; padding: 1px 5px; }
      .t-row.disc { color: #dc2626; }
      .t-row.final {
        font-weight: 800;
        font-size: 12px;
        border-top: 2px solid #111;
        padding-top: 2px;
        margin-top: 2px;
        color: #1a6b3f;
      }

      /* ── Footer ── */
      .footer {
        margin-top: auto;
        padding-top: 2mm;
        border-top: 1px dashed #aaa;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-size: 9px;
        color: #555;
      }
      .note { max-width: 65%; line-height: 1.5; }
      .paid-box {
        border: 2px solid #1a6b3f;
        color: #1a6b3f;
        font-weight: 900;
        font-size: 13px;
        padding: 2px 10px;
        border-radius: 4px;
        letter-spacing: 2px;
      }
      .due-box {
        border: 2px solid #b45309;
        color: #b45309;
        background: #fffbeb;
      }
    </style>
    </head><body>
    <div class="slip">

      <!-- TOP HEADER -->
      <div class="top">
        <div>
          <div class="hosp-name">${hospitalName}</div>
          <div class="hosp-tag">Healthcare &amp; Diagnostics</div>
        </div>
        <div class="address">
          ${profileLines || '&mdash;'}
        </div>
      </div>

      <!-- RECEIPT LABEL -->
      <div class="receipt-title">Receipt</div>

      <!-- PATIENT INFO -->
      <div class="info-grid">
        <div class="info-cell">
          <span class="info-label">Slip Number</span>
          <span class="info-val">${invoice.slip_number || '--'}</span>
        </div>
        <div class="info-cell">
          <span class="info-label">Invoice Number</span>
          <span class="info-val">${invoice.invoice_no}</span>
        </div>
        <div class="info-cell">
          <span class="info-label">Name</span>
          <span class="info-val">${patientName}</span>
        </div>
        <div class="info-cell">
          <span class="info-label">Gender / Age</span>
          <span class="info-val">${genderAge || '—'}</span>
        </div>
        <div class="info-cell">
          <span class="info-label">Pay Mode</span>
          <span class="info-val">${payModeLabel}</span>
        </div>
        <div class="info-cell">
          <span class="info-label">Mobile No.</span>
          <span class="info-val">${invoice.patient.phone || '—'}</span>
        </div>
        <div class="info-cell">
          <span class="info-label">Date</span>
          <span class="info-val">${dateTimeStr}</span>
        </div>
        ${invoice.referredBy ? `<div class="info-cell">
          <span class="info-label">Referred By</span>
          <span class="info-val">${invoice.referredBy.toUpperCase()}</span>
        </div>` : ''}
        ${invoice.purpose ? `<div class="info-cell" style="grid-column:span 2">
          <span class="info-label">Purpose</span>
          <span class="info-val">${invoice.purpose}</span>
        </div>` : ''}
      </div>

      <!-- SERVICES TABLE -->
      <table>
        <thead>
          <tr>
            <th class="c">SL No.</th>
            <th class="l">Test Type / Service</th>
            <th class="r">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- TOTALS -->
      <div class="totals">
        <div class="t-row"><span>Total Amount:</span><span>₹${invoice.subtotal.toFixed(2)}</span></div>
        <div class="t-row disc"><span>Discount:</span><span>₹${invoice.discountAmt.toFixed(2)}</span></div>
        <div class="t-row final"><span>Net Amount:</span><span>₹${invoice.total.toFixed(2)}</span></div>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <div class="note">
          <strong>Note:</strong> Your reports will be preserved only for 6 months.<br/>
          Please retain this receipt for future reference.
        </div>
        <div class="paid-box ${invoice.paymentMode === 'credit' ? 'due-box' : ''}">${invoice.paymentMode === 'credit' ? 'CREDIT / DUE' : '✓ PAID'}</div>
      </div>

    </div>
    ${PRINT_WINDOW_CLOSE_SCRIPT}
    </body></html>`)
    w.document.close()
  }

  useEffect(() => {
    if (!invoice?.invoice_no) return
    if (autoPrintedInvoiceNoRef.current === invoice.invoice_no) return

    autoPrintedInvoiceNoRef.current = invoice.invoice_no
    autoResetPendingRef.current = true

    const t = setTimeout(() => {
      printInvoice({
        onComplete: () => {
          if (!autoResetPendingRef.current) return
          autoResetPendingRef.current = false
          resetForm()
        },
      })
    }, 0)

    return () => clearTimeout(t)
  }, [invoice])

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none'

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-emerald-600" />
          <h2 className="text-base font-semibold text-gray-900">Payment Slip</h2>
        </div>
        {invoice && (
          <div className="flex gap-2">
            <button onClick={printInvoice} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
              <Printer size={13} /> Print Receipt
            </button>
            <button onClick={resetForm} className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
              New Slip
            </button>
          </div>
        )}
      </div>

      {invoice ? (
        /* ── Receipt preview (compact) ── */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-lg">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-white flex justify-between items-center">
            <div>
              <p className="text-[11px] opacity-75">Invoice No</p>
              <p className="text-base font-bold">{invoice.invoice_no}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] opacity-75">Date</p>
              <p className="text-sm">{format(new Date(), 'MMM dd, yyyy')}</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2.5 bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                {(invoice.patient.first_name?.[0] || '') + (invoice.patient.last_name?.[0] || '')}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{[invoice.patient.first_name, invoice.patient.last_name].filter(Boolean).join(' ')}</p>
                <p className="text-xs text-gray-400">{invoice.patient.uhid} · {invoice.patient.phone || 'No phone'}</p>
                {invoice.linkedAdmission && (
                  <p className="text-[10px] font-bold text-blue-700 mt-0.5">
                    IPD Active · Bed {invoice.linkedAdmission?.bed_code || '--'}
                  </p>
                )}
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 text-gray-400 font-semibold uppercase tracking-wide">Service</th>
                  <th className="text-center py-1.5 text-gray-400 font-semibold uppercase tracking-wide">Qty</th>
                  <th className="text-right py-1.5 text-gray-400 font-semibold uppercase tracking-wide">Rate</th>
                  <th className="text-right py-1.5 text-gray-400 font-semibold uppercase tracking-wide">Amt</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-800">{it.description}</td>
                    <td className="py-1.5 text-center text-gray-500">{it.quantity}</td>
                    <td className="py-1.5 text-right text-gray-500">₹{parseFloat(it.unit_price).toFixed(0)}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">₹{parseFloat(it.line_total).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {invoice.discountAmt > 0 && <tr><td colSpan={3} className="pt-2 text-right text-red-400">Discount</td><td className="pt-2 text-right text-red-500 font-medium">−₹{invoice.discountAmt.toFixed(0)}</td></tr>}
                <tr><td colSpan={3} className="pt-2 text-right font-semibold text-gray-900">Total</td><td className="pt-2 text-right font-bold text-emerald-700 text-sm">₹{invoice.total.toFixed(0)}</td></tr>
              </tfoot>
            </table>
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500 capitalize"><CreditCard size={12} className="inline mr-1 text-emerald-600" />{invoice.paymentMode}</span>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${invoice.paymentMode === 'credit' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {invoice.paymentMode === 'credit' ? 'CREDIT / DUE' : 'PAID'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ── Two-column form ── */
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 grid grid-cols-2 gap-3 overflow-hidden">

          {/* LEFT column: patient + quick services + items */}
          <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
            {/* Patient */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Patient</p>
              {patient ? (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {(patient.first_name?.[0] || '') + (patient.last_name?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{[patient.first_name, patient.last_name].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-gray-400">{patient.uhid} · {patient.phone || 'No phone'}</p>
                    {activeIpdByPatient[String(patient.id)] && (
                      <p className="text-[10px] font-bold text-blue-700 mt-0.5">
                        IPD Active · Bed {activeIpdByPatient[String(patient.id)]?.bed_code || '--'}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => setPatient(null)} className="text-gray-300 hover:text-red-500">
                    <XCircle size={16} strokeWidth={1.8} />
                  </button>
                </div>
              ) : isAddingNew ? (
                <div className="space-y-2 border-2 border-emerald-500/20 bg-emerald-50/20 rounded-xl p-3 shadow-inner">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">New Patient Mode</p>
                    <button type="button" onClick={() => { setIsAddingNew(false); setPtSearch(newPt.name) }} className="text-[10px] text-gray-400 font-bold hover:text-red-500 underline">Cancel</button>
                  </div>
                  <input className={`${inp} py-1.5 text-xs ring-1 ring-emerald-100`} value={newPt.name} readOnly placeholder="Name" />
                  <input className={`${inp} py-1.5 text-xs`} 
                    type="tel" maxLength={10}
                    value={newPt.phone} onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewPt(p => ({ ...p, phone: v }));
                    }} placeholder="10-digit Mobile" />
                  <select
                    className={`${inp} py-1.5 text-xs`}
                    value={newPt.gender}
                    onChange={e => setNewPt(p => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="">Select Gender *</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <input className={`${inp} py-1.5 text-xs`} value={newPt.address} onChange={e => setNewPt(p => ({ ...p, address: e.target.value }))} placeholder="Address" />
                </div>
              ) : (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input value={ptSearch} onChange={e => setPtSearch(e.target.value)}
                    placeholder="Search by name, mobile or UHID…"
                    className={`${inp} pl-8 text-xs`} autoComplete="off" />
                  {ptSearching && <span className="absolute right-2.5 top-2.5 w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
                  {(ptResults.length > 0 || (ptSearch.length > 1 && !ptSearching)) && (
                    <ul className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 divide-y divide-gray-50 max-h-44 overflow-y-auto">
                      {ptResults.map(p => (
                        <li key={p.id}>
                          <button type="button" onClick={() => { setPatient(p); setPtSearch(''); setPtResults([]) }}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50/60">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{[p.first_name, p.last_name].filter(Boolean).join(' ')}</p>
                              {activeIpdByPatient[String(p.id)] && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                                  IPD ACTIVE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{p.uhid} · {p.phone || 'No phone'}</p>
                          </button>
                        </li>
                      ))}
                      <li className="bg-emerald-50/50">
                        <button type="button" onClick={() => { setIsAddingNew(true); setNewPt({ name: sanitizePersonName(ptSearch), phone: '', address: '', gender: '' }); setPtSearch(''); setPtResults([]) }}
                          className="w-full text-left px-3 py-2.5 flex items-center gap-2 group transition-all">
                          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus size={14} strokeWidth={3} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-emerald-700 uppercase tracking-tight">Register as New Patient</p>
                            <p className="text-[11px] text-emerald-600/70 font-bold italic truncate">"{ptSearch}"</p>
                          </div>
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Quick services */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Add</p>
                <button
                  type="button"
                  onClick={() => setShowQuickServiceEditor(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded border border-indigo-200 bg-indigo-50"
                >
                  Edit Quick Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickServices.map(svc => (
                  <button key={svc.label} type="button" onClick={() => quickAdd(svc)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 text-gray-600 transition-colors">
                    {svc.label} <span className="text-gray-400">₹{svc.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Services / Items</p>
                <button type="button" onClick={addItem} className="text-[11px] flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium">
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="grid grid-cols-12 gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 px-0.5 shrink-0">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-3">₹ Price</div>
                <div className="col-span-1" />
              </div>
              <div className="space-y-1.5 overflow-y-auto flex-1">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                    <input className={`${inp} col-span-6 py-1.5 text-xs`} placeholder="Service"
                      value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                    <input type="number" min="1" className={`${inp} col-span-2 text-center py-1.5 text-xs`}
                      value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                    <input type="number" min="0" step="1" className={`${inp} col-span-3 py-1.5 text-xs`} placeholder="0"
                      value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
                    <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                      className="col-span-1 flex justify-center text-gray-300 hover:text-red-500 disabled:opacity-30">
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT column: payment details + totals + submit */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="bg-white rounded-xl border border-gray-200 p-3 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Details</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Encounter type</label>
                  <select value={encounterType} onChange={e => setEncounterType(e.target.value)} className={`${inp} py-1.5 text-xs`}>
                    {[['opd','OPD'],['lab','Lab'],['pharmacy','Pharmacy'],['ipd','IPD'],['package','Package']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Payment mode</label>
                  <div className="flex gap-1.5">
                    {[
                      ['cash', 'Cash'],
                      ['card', 'Card'],
                      ['upi', 'UPI'],
                      ...(selectedPatientHasActiveIpd ? [['credit', 'Credit']] : []),
                    ].map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setPaymentMode(v)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${paymentMode === v ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Discount (₹)</label>
                  <input type="number" min="0" step="1" value={discount} onChange={e => {
                    const next = e.target.value
                    if (next === '' || Number(next) >= 0) setDiscount(next)
                  }}
                    placeholder="0.00" className={`${inp} py-1.5 text-xs`} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Referred By (optional)</label>
                  <input value={referredBy} onChange={e => setReferredBy(e.target.value)}
                    placeholder="Doctor name…" className={`${inp} py-1.5 text-xs`} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Purpose / Notes (optional)</label>
                  <input value={purpose} onChange={e => setPurpose(e.target.value)}
                    placeholder="e.g. Chest X-Ray, Follow-up…" className={`${inp} py-1.5 text-xs`} />
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 shrink-0">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>−₹{discountAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-1">
                  <span>Total</span><span className="text-emerald-700">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting || (!patient && !isAddingNew) || total <= 0}
              className="py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0">
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                : <><Receipt size={15} /> {isAddingNew ? 'Register & Generate Slip' : 'Generate Payment Slip'}</>
              }
            </button>
          </div>
        </form>
      )}
      {showQuickServiceEditor && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between">
              <h3 className="text-white font-bold">Edit Quick Add Services</h3>
              <button type="button" onClick={() => setShowQuickServiceEditor(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">
                <div className="col-span-5">Service</div>
                <div className="col-span-3">Price</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>
              {quickServices.map((svc, i) => (
                <div key={`${svc.label}-${i}`} className="grid grid-cols-12 gap-2 items-center border border-gray-100 rounded-xl p-2">
                  <input
                    value={svc.label}
                    onChange={e => setQuickServices(prev => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                    className="col-span-5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={svc.price}
                    onChange={e => setQuickServices(prev => prev.map((x, idx) => idx === i ? { ...x, price: Number(e.target.value || 0) } : x))}
                    className="col-span-3 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <div className="col-span-4 flex justify-end gap-1.5">
                    <button type="button" onClick={() => moveQuickService(i, -1)} className="px-2 py-1 text-xs font-bold rounded bg-gray-100 hover:bg-gray-200">Up</button>
                    <button type="button" onClick={() => moveQuickService(i, 1)} className="px-2 py-1 text-xs font-bold rounded bg-gray-100 hover:bg-gray-200">Down</button>
                    <button type="button" onClick={() => removeQuickService(i)} className="px-2 py-1 text-xs font-bold rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                  </div>
                </div>
              ))}

              <div className="border-t border-gray-100 pt-3 mt-2">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Create New Quick Add</p>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    value={newQuickLabel}
                    onChange={e => setNewQuickLabel(e.target.value)}
                    placeholder="Service name"
                    className="col-span-7 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newQuickPrice}
                    onChange={e => setNewQuickPrice(e.target.value)}
                    placeholder="Price"
                    className="col-span-3 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <button type="button" onClick={addQuickService} className="col-span-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button type="button" onClick={() => { setShowQuickServiceEditor(false); toast.success('Quick Add services updated') }} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TV Screens Tab ───────────────────────────────────────────────────────────
// ─── Room Edit Modal ──────────────────────────────────────────────────────────
function RoomModal({ room, doctors, onSave, onClose }) {
  const isNew = !room.code
  const nextNum = room._nextNum || ''
  const [form, setForm] = useState({
    label: room.label || '',
    prefix: room.prefix || '',
    doctor_user: room.doctor_user || '',
    doctor_name: room.doctor_name || '',
  })

  function handleDoctorChange(e) {
    const docUser = e.target.value
    const doc = doctors.find(d => (d.user || d.id) === docUser)
    setForm(f => ({
      ...f,
      doctor_user: docUser,
      doctor_name: doc?.name || '',
      label: doc ? `Room ${nextNum || ''} – ${doc.name}` : f.label,
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.label.trim()) { toast.error('Room label is required'); return }
    if (!form.prefix.trim()) { toast.error('Token prefix is required'); return }
    onSave({
      ...room,
      label: form.label.trim(),
      prefix: form.prefix.trim().toUpperCase().slice(0, 2),
      doctor_user: form.doctor_user || null,
      doctor_name: form.doctor_name || '',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-800 text-lg">{isNew ? 'Add New Room' : 'Edit Room'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500"><XCircle size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Doctor picker */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Assign Doctor from Profile</label>
            <select value={form.doctor_user} onChange={handleDoctorChange}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
              <option value="">— No doctor / Walk-in room —</option>
              {doctors.map(d => (
                <option key={d.user || d.id} value={d.user || d.id}>
                  {d.name}
                  {d.specialty_name ? ` · ${d.specialty_name}` : ''}
                  {d.consultation_fee ? ` · ₹${d.consultation_fee}` : ''}
                </option>
              ))}
            </select>
            {form.doctor_name && (
              <p className="mt-1 text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1">
                Doctor assigned: <strong>{form.doctor_name}</strong>
              </p>
            )}
          </div>

          {/* Room label */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Room Label</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Room 1 – Dr. Sharma"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" required />
          </div>

          {/* Token prefix */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Token Prefix (1-2 letters)</label>
            <input value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="e.g. A"
              maxLength={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" required />
            <p className="text-xs text-gray-400 mt-1">Tokens will be printed as: <strong>{form.prefix || 'A'}1</strong>, <strong>{form.prefix || 'A'}2</strong>…</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 bg-purple-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-purple-700">
              {isNew ? 'Add Room' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── TV Screens Section ───────────────────────────────────────────────────────
function TVScreensSection({ rooms, setRooms, tvGroups, setTvGroups }) {
  const [dragRoomCode, setDragRoomCode] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [modalRoom, setModalRoom] = useState(null)   // null = closed, {} = editing
  const [editTvId, setEditTvId] = useState(null)
  const [tvHeadingInput, setTvHeadingInput] = useState('')

  useEffect(() => {
    api.get('/doctor-profiles/?limit=200&is_active=true')
      .then(({ data }) => {
        const rows = data?.data || data?.results || data || []
        setDoctors(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {})
  }, [])

  function roomLabel(code) { return rooms.find(r => r.code === code)?.label || code }
  function roomPrefix(code) { return rooms.find(r => r.code === code)?.prefix || '' }
  function roomDoctor(code) { return rooms.find(r => r.code === code)?.doctor_name || '' }
  function makeTvUrl(group) { return `/tv/${group.id}` }

  function openAddRoom() {
    const roomNumbers = rooms.map(r => { const m = String(r.code || '').match(/^room(\d+)$/); return m ? parseInt(m[1], 10) : 0 }).filter(Boolean)
    const nextNumber = roomNumbers.length ? Math.max(...roomNumbers) + 1 : (rooms.length + 1)
    setModalRoom({
      _isNew: true,
      _nextNum: nextNumber,
      code: `room${nextNumber}`,
      label: `Room ${nextNumber}`,
      prefix: String.fromCharCode(64 + nextNumber),
      doctor_user: null,
      doctor_name: '',
      isDefault: false,
    })
  }

  function openEditRoom(roomCode) {
    const room = rooms.find(r => r.code === roomCode)
    if (room) setModalRoom({ ...room })
  }

  function handleModalSave(updated) {
    if (updated._isNew) {
      setRooms(prev => [...prev, { ...updated, _isNew: undefined, _nextNum: undefined }])
    } else {
      setRooms(prev => prev.map(r => r.code === updated.code ? { ...updated, _isNew: undefined, _nextNum: undefined } : r))
    }
    setModalRoom(null)
    toast.success(updated._isNew ? 'Room added!' : 'Room updated!')
  }

  function deleteRoom(roomCode) {
    const room = rooms.find(r => r.code === roomCode)
    if (!room) return
    if (room.isDefault) { toast.error('First 3 rooms are mandatory and cannot be deleted'); return }
    if (!window.confirm(`Delete "${room.label}"?`)) return
    setRooms(prev => prev.filter(r => r.code !== roomCode))
    setTvGroups(prev => prev.map(g => ({
      ...g,
      left_room: g.left_room === roomCode ? null : g.left_room,
      right_room: g.right_room === roomCode ? null : g.right_room,
    })))
  }

  function dropRoomToTv(tvId, slot, droppedRoomCode) {
    const roomCode = droppedRoomCode || dragRoomCode
    if (!roomCode || !slot) return
    setTvGroups(prev => prev.map(group => {
      const cleared = {
        ...group,
        left_room: group.left_room === roomCode ? null : group.left_room,
        right_room: group.right_room === roomCode ? null : group.right_room,
      }
      if (group.id === tvId) return { ...cleared, [slot]: roomCode }
      return cleared
    }))
    setDragRoomCode(null)
  }

  function startEditTvHeading(group) {
    setEditTvId(group.id)
    setTvHeadingInput(group.name || '')
  }

  function saveTvHeading(tvId) {
    if (!tvHeadingInput.trim()) return
    setTvGroups(prev => prev.map(g => g.id === tvId ? { ...g, name: tvHeadingInput.trim() } : g))
    setEditTvId(null)
  }

  return (
    <div className="space-y-5">
      {/* Room cards */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Monitor size={18} className="text-purple-500" /> Rooms & Doctor Assignment
          </h3>
          <button onClick={openAddRoom}
            className="bg-purple-600 text-white text-xs px-4 py-2 rounded-xl font-semibold hover:bg-purple-700 flex items-center gap-1.5">
            <Plus size={13} /> Add Room
          </button>
        </div>
        <p className="text-xs text-amber-600 mb-4">Min 3 rooms required. First 3 non-deletable. All rooms can have a doctor assigned.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rooms.map((room, idx) => (
            <div key={room.code}
              draggable
              onDragStart={(e) => { setDragRoomCode(room.code); e.dataTransfer.setData('text/plain', room.code); e.dataTransfer.effectAllowed = 'move' }}
              onDragEnd={() => setDragRoomCode(null)}
              className={`rounded-2xl border p-4 cursor-grab transition-all ${
                dragRoomCode === room.code
                  ? 'border-purple-300 ring-2 ring-purple-100 bg-purple-50'
                  : 'border-gray-100 bg-gray-50 hover:border-purple-200'
              }`}
            >
              {/* Room header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-base shrink-0">
                  {room.prefix}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">{room.label}</p>
                  <p className="text-xs text-gray-400">Code: {room.code}</p>
                </div>
              </div>

              {/* Doctor badge */}
              {room.doctor_name ? (
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 mb-3">
                  <Users size={12} className="text-blue-500 shrink-0" />
                  <span className="text-xs text-blue-700 font-semibold truncate">{room.doctor_name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1.5 mb-3">
                  <Users size={12} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-400">No doctor assigned</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button onClick={() => openEditRoom(room.code)}
                  className="flex-1 bg-white border border-purple-200 text-purple-700 text-xs py-1.5 rounded-lg font-semibold hover:bg-purple-50 flex items-center justify-center gap-1">
                  Assign Doctor / Edit
                </button>
                {!room.isDefault && (
                  <button onClick={() => deleteRoom(room.code)}
                    className="bg-red-50 border border-red-200 text-red-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-100">
                    Del
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TV assignments */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
          <Tv size={18} className="text-purple-500" /> TV Screen Assignments
        </h3>
        <p className="text-xs text-gray-500 mb-4">Drag a room from above onto a TV slot. Each TV can show up to 2 rooms side-by-side.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tvGroups.map(group => (
            <div key={group.id} className="rounded-2xl border border-gray-200 p-4">
              {/* TV heading */}
              <div className="flex items-center justify-between gap-2 mb-3">
                {editTvId === group.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input value={tvHeadingInput} onChange={e => setTvHeadingInput(e.target.value)}
                      className="flex-1 border border-purple-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      autoFocus onKeyDown={e => e.key === 'Enter' && saveTvHeading(group.id)} />
                    <button onClick={() => saveTvHeading(group.id)}
                      className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-700">
                      Save
                    </button>
                    <button onClick={() => setEditTvId(null)} className="text-gray-400 hover:text-red-400"><XCircle size={16} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{group.name}</span>
                    <button onClick={() => startEditTvHeading(group)}
                      className="text-[11px] px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                      Rename
                    </button>
                  </div>
                )}
                <a href={makeTvUrl(group)} target="_blank" rel="noreferrer"
                  className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 hover:bg-purple-700 shrink-0">
                  <Tv size={12} /> Open TV
                </a>
              </div>

              <p className="text-[11px] text-blue-600 mb-3 break-all">{`http://localhost:5173${makeTvUrl(group)}`}</p>

              {/* Drop zones */}
              <div className="grid grid-cols-2 gap-2">
                {['left_room', 'right_room'].map(slot => {
                  const code = group[slot]
                  const doc = code ? roomDoctor(code) : ''
                  return (
                    <div key={slot}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                      onDrop={(e) => { e.preventDefault(); dropRoomToTv(group.id, slot, e.dataTransfer.getData('text/plain')) }}
                      className={`rounded-xl border-2 border-dashed p-3 min-h-20 transition-all ${
                        dragRoomCode
                          ? 'border-purple-400 bg-purple-50/80'
                          : code ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-purple-500 font-bold mb-2">
                        {slot === 'left_room' ? 'Left Screen' : 'Right Screen'}
                      </p>
                      {code ? (
                        <div>
                          <span className="text-xs bg-purple-100 border border-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full inline-block mb-1">
                            {roomPrefix(code)}{' · '}{roomLabel(code)}
                          </span>
                          {doc && <p className="text-xs text-blue-600 mt-1">{doc}</p>}
                          <button onClick={() => setTvGroups(prev => prev.map(g => g.id === group.id ? { ...g, [slot]: null } : g))}
                            className="text-[10px] text-red-400 hover:text-red-600 mt-1 block">
                            Remove
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Drag & drop a room here</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Tip:</strong> Open TV links in fullscreen (F11). Tokens auto-refresh every 5 seconds. Assign a doctor to a room so the OPD token form pre-fills the doctor automatically.
      </div>

      {/* Room modal */}
      {modalRoom && (
        <RoomModal
          room={modalRoom}
          doctors={doctors}
          onSave={handleModalSave}
          onClose={() => setModalRoom(null)}
        />
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ activeSection, onSelect }) {
  const [collapsed, setCollapsed] = useState({})

  function toggleGroup(label) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const sectionBadges = {}

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col h-full overflow-y-auto custom-scrollbar">
      <div className="px-3 py-3 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reception</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 rounded-lg"
            >
              {group.label}
              {collapsed[group.label] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
            {!collapsed[group.label] && group.items.map(item => {
              const Icon = item.icon
              const active = activeSection === item.id
              return (
                <button key={item.id} onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}>
                  <Icon size={15} className={active ? 'text-white' : 'text-gray-400'} />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ─── OPD Slips / History ────────────────────────────────────────────────────────
function OpdSlipsSection({ onMoveToIpd }) {
  const [visits, setVisits] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [editingVisit, setEditingVisit] = useState(null)
  const [viewVisit, setViewVisit] = useState(null)
  const [printVisit, setPrintVisit] = useState(null)
  const [cancelVisit, setCancelVisit] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [doctors, setDoctors] = useState([])
  const PAGE_SIZE = 10
  const debounceRef = useRef(null)
  const formatPersonName = (value) => String(value || '')
    .split(' ')
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : ''))
    .join(' ')
  const getDoctorUserId = (doctorRow) =>
    doctorRow?.user == null ? '' : String(doctorRow.user)
  const getVisitDoctorName = (visitRow) => {
    const assignedDoctorUser = visitRow?.doctor_user == null ? '' : String(visitRow.doctor_user)
    const matchedDoctor = doctors.find((d) => getDoctorUserId(d) === assignedDoctorUser)
    return matchedDoctor?.name || '-'
  }

  useEffect(() => {
    api.get('/doctor-profiles/?limit=500').then(({ data }) => setDoctors(Array.isArray(data?.data) ? data.data : (data?.results || data || []))).catch(() => {})
  }, [])

  useEffect(() => {
    setPage(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchVisits(0, search), 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  useEffect(() => { fetchVisits(page, search) }, [page])

  async function fetchVisits(pg = 0, q = '') {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE, ordering: '-created_at' })
      if (q.trim()) params.set('search', q.trim())
      const { data } = await api.get(`/opd-visits/?${params}`)
      setVisits(data?.data || data?.results || data || [])
      setTotal(data?.count ?? data?.total ?? (data?.data?.length ?? 0))
    } catch { toast.error('Failed to load OPD slips') }
    finally { setLoading(false) }
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    try {
      const patientId = editingVisit.patient
      if (patientId) {
        const normalizedName = formatPersonName(editingVisit.patient_name || '').trim()
        const nameParts = normalizedName.split(/\s+/).filter(Boolean)
        const phoneDigits = String(editingVisit.patient_phone || '').replace(/\D/g, '')
        const patientPayload = {
          first_name: nameParts[0] || 'Patient',
          last_name: nameParts.slice(1).join(' ') || '',
          guardian_name: formatPersonName(editingVisit.patient_guardian_name || '').trim(),
          gender: editingVisit.patient_gender || 'male',
          address_line1: editingVisit.patient_address || '',
          city: editingVisit.patient_city || '',
          state: editingVisit.patient_state || '',
        }
        if (editingVisit.patient_age !== '' && editingVisit.patient_age != null) {
          const a = parseInt(editingVisit.patient_age, 10)
          if (!Number.isNaN(a)) patientPayload.age = a
        }
        if (phoneDigits.length >= 10) {
          patientPayload.phone = phoneDigits.slice(-10)
        }
        await api.patch(`/patients/${patientId}/`, patientPayload)
      }

      await api.patch(`/opd-visits/${editingVisit.id}/`, {
        doctor_user: editingVisit.doctor_user || null,
        chief_complaint: editingVisit.visit_reason || '',
        visit_reason: editingVisit.visit_reason || '',
        status: editingVisit.status,
        visit_date: editingVisit.visit_date,
        amount: editingVisit.amount || null,
        payment_mode: editingVisit.payment_mode || 'cash',
      })
      toast.success('OPD Slip updated!')
      setEditingVisit(null)
      fetchVisits(page, search)
    } catch (err) {
      const detail = err?.response?.data?.detail || JSON.stringify(err?.response?.data || {}) || 'Failed to update OPD slip'
      toast.error(detail)
    }
  }

  async function openEditVisit(visit) {
    if (!visit) return
    if (visit.status === 'cancelled') {
      toast.error('Cancelled OPD slips are view-only')
      return
    }
    let enriched = { ...visit }
    if (visit.patient) {
      try {
        const { data } = await api.get(`/patients/${visit.patient}/`)
        const p = data?.data || data || {}
        const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ')
        enriched = {
          ...enriched,
          patient_name: formatPersonName(fullName || visit.patient_name || ''),
          patient_phone: p.phone || visit.patient_phone || '',
          patient_gender: p.gender || visit.patient_gender || 'male',
          patient_age: p.age != null ? String(p.age) : (visit.patient_age || ''),
          patient_guardian_name: formatPersonName(p.guardian_name || visit.patient_guardian_name || ''),
          patient_address: p.address_line1 || visit.patient_address || '',
          patient_city: p.city || visit.patient_city || '',
          patient_state: p.state || visit.patient_state || '',
        }
      } catch {
        // fall back to visit payload values
      }
    }
    setEditingVisit(enriched)
  }

  function reprintOpdSlip(visit) {
    if (!visit) return
    if (visit.status === 'cancelled') {
      toast.error('Cancelled OPD slips are view-only')
      return
    }
    setPrintVisit({
      ...visit,
      doc_name: getVisitDoctorName(visit),
      chief_complaint: visit.chief_complaint || visit.visit_reason || '',
      display_token: visit.display_token || String(visit.queue_number || visit.token_number || ''),
    })
  }

  function openViewVisit(visit) {
    if (!visit) return
    const resolvedDoctor = getVisitDoctorName(visit)
    setViewVisit({
      ...visit,
      doctor_name: resolvedDoctor,
      doc_name: resolvedDoctor,
    })
  }

  function moveVisitToIpd(visit) {
    if (!visit) return
    if (visit.status === 'cancelled') {
      toast.error('Cancelled OPD slips are view-only')
      return
    }
    if (typeof onMoveToIpd === 'function') {
      onMoveToIpd({
        id: visit.id,
        patient_id: visit.patient,
        patient_uhid: visit.patient_uhid || '',
        patient_name: visit.patient_name || '',
        doctor_user: visit.doctor_user || '',
        visit_reason: visit.visit_reason || '',
        notes: `Shifted from OPD slip #${visit.queue_number || visit.token_number || '--'}`,
      })
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const statusColors = { waiting: 'bg-amber-100 text-amber-800', in_progress: 'bg-blue-100 text-blue-800', completed: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-red-100 text-red-800' }

  async function submitCancelVisit() {
    if (!cancelVisit) return
    const reason = cancelReason.trim()
    if (!reason) {
      toast.error('Please enter cancellation reason')
      return
    }
    setCancelling(true)
    try {
      await api.post(`/opd-visits/${cancelVisit.id}/cancel/`, { cancel_reason: reason })
      toast.success('OPD slip cancelled')
      setCancelVisit(null)
      setCancelReason('')
      if (viewVisit?.id === cancelVisit.id) {
        setViewVisit((prev) => ({
          ...prev,
          status: 'cancelled',
          cancel_reason: reason,
        }))
      }
      fetchVisits(page, search)
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.errors?.cancel_reason?.[0] || 'Failed to cancel OPD slip'
      toast.error(detail)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[['Total Slips', total, 'text-gray-900'], ['Showing', total === 0 ? '0' : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)}`, 'text-emerald-600']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
             <div className="min-w-0">
               <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{l}</p>
               <p className={`text-2xl font-black ${c}`}>{v}</p>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative flex flex-col min-h-[calc(100vh-320px)]">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/60">
          <Search size={15} className="text-gray-400 shrink-0" strokeWidth={2} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by patient name, mobile, UHID…" className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400" />
          {loading && <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />}
          <button onClick={() => fetchVisits(page, search)} className="text-gray-400 hover:text-emerald-600 shrink-0"><RefreshCw size={14} strokeWidth={2} /></button>
          <span className="text-xs text-gray-400 shrink-0">{total} slips</span>
        </div>
        
        <div className="grid grid-cols-12 px-4 py-2 bg-gray-100/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-2">Date/OPD No</div>
          <div className="col-span-2">Patient</div>
          <div className="col-span-2">Doctor</div>
          <div className="col-span-1">Complaint</div>
          <div className="col-span-2 text-center">Status / Amt</div>
          <div className="col-span-3 text-right">Action</div>
        </div>

        <div className="divide-y divide-gray-50 flex-1">
          {loading ? <div className="py-12 text-center text-sm text-gray-400">Loading…</div> : visits.length === 0 ? <div className="py-12 text-center text-sm text-gray-400">No OPD slips found</div> : visits.map((v) => {
            const isCancelled = v.status === 'cancelled'
            return (
             <div key={v.id} className={`grid grid-cols-12 px-4 py-3 items-center text-sm transition-colors ${isCancelled ? 'bg-red-50/40 hover:bg-red-50/50' : 'hover:bg-gray-50/50'}`}>
                <div className="col-span-2 flex flex-col items-start min-w-0 pr-2">
                  <span className="font-bold text-gray-800">
                    {v.created_at
                      ? `${format(new Date(v.created_at), 'd/M/yyyy')} (${format(new Date(v.created_at), 'h:mm a')})`
                      : v.visit_date
                        ? format(new Date(`${v.visit_date}T12:00:00`), 'd/M/yyyy')
                        : '--'}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {v.opd_no && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">{v.opd_no}</span>}
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">#{v.queue_number || v.token_number}</span>
                  </div>
                </div>
                <div className="col-span-2 min-w-0 pr-2">
                  <p className="font-bold text-gray-800 truncate">{v.patient_name || 'Patient'}</p>
                  <p className="text-[10px] text-gray-500 font-mono truncate">{v.patient_uhid}</p>
                  {v.created_by_name && <p className="text-[10px] text-gray-400 font-bold mt-0.5">By: {v.created_by_name}</p>}
                </div>
                <div className="col-span-2 min-w-0 pr-2">
                  <span className="text-gray-600 truncate block">{getVisitDoctorName(v)}</span>
                </div>
                <div className="col-span-1 min-w-0 pr-2 text-gray-500 text-xs line-clamp-2">
                  {v.visit_reason || '-'}
                </div>
                <div className="col-span-2 flex flex-col items-center gap-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColors[v.status] || 'bg-gray-100 text-gray-800'}`}>
                    {v.status.replace('_', ' ')}
                  </span>
                  {isCancelled && <span className="text-[10px] font-bold text-red-700">Cancelled (view only)</span>}
                  {v.amount && <span className="text-xs font-bold text-gray-600 border border-gray-200 px-1.5 rounded bg-gray-50 flex items-center"><IndianRupee size={10} className="mr-0.5"/> {v.amount} <span className="ml-1 text-[9px] uppercase">({v.payment_mode || 'CASH'})</span></span>}
                </div>
                <div className="col-span-3 flex flex-wrap gap-1.5 items-center justify-end">
                  <button
                    onClick={() => openViewVisit(v)}
                    title="View"
                    aria-label="View OPD slip"
                    className="h-8 w-8 hover:w-[72px] flex items-center justify-center gap-1 overflow-hidden text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition-all duration-150 border border-indigo-100 shadow-sm hover:shadow-md active:scale-95 group"
                  >
                    <Eye size={13} className="group-hover:scale-110 transition-transform" />
                    <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[40px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest">View</span>
                  </button>
                  <button
                    onClick={() => moveVisitToIpd(v)}
                    disabled={isCancelled}
                    title="Move to IPD"
                    aria-label="Move OPD to IPD"
                    className={`h-8 w-8 ${isCancelled ? '' : 'hover:w-[70px]'} flex items-center justify-center gap-1 overflow-hidden rounded-lg transition-all duration-150 border shadow-sm active:scale-95 group ${isCancelled ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed' : 'text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border-blue-100 hover:shadow-md'}`}
                  >
                    <Bed size={13} className="group-hover:scale-110 transition-transform" />
                    {!isCancelled && <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[36px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest">IPD</span>}
                  </button>
                  <button
                    onClick={() => reprintOpdSlip(v)}
                    disabled={isCancelled}
                    title="Print"
                    aria-label="Print OPD slip"
                    className={`h-8 w-8 ${isCancelled ? '' : 'hover:w-[74px]'} flex items-center justify-center gap-1 overflow-hidden rounded-lg transition-all duration-150 border shadow-sm active:scale-95 group ${isCancelled ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed' : 'text-sky-600 hover:text-white bg-sky-50 hover:bg-sky-600 border-sky-100 hover:shadow-md'}`}
                  >
                    <Printer size={13} className="group-hover:scale-110 transition-transform" />
                    {!isCancelled && <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[44px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest">Print</span>}
                  </button>
                  <button
                    onClick={() => openEditVisit(v)}
                    disabled={isCancelled}
                    title="Edit"
                    aria-label="Edit OPD slip"
                    className={`h-8 w-8 ${isCancelled ? '' : 'hover:w-[68px]'} flex items-center justify-center gap-1 overflow-hidden rounded-lg transition-all duration-150 border shadow-sm active:scale-95 group ${isCancelled ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed' : 'text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border-emerald-100 hover:shadow-md'}`}
                  >
                    <Edit2 size={13} className="group-hover:scale-110 transition-transform" />
                    {!isCancelled && <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[36px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest">Edit</span>}
                  </button>
                  {!isCancelled && (
                    <button
                      onClick={() => { setCancelVisit(v); setCancelReason('') }}
                      title="Cancel"
                      aria-label="Cancel OPD slip"
                      className="h-8 w-8 hover:w-[84px] flex items-center justify-center gap-1 overflow-hidden text-red-600 hover:text-white bg-red-50 hover:bg-red-600 rounded-lg transition-all duration-150 border border-red-100 shadow-sm hover:shadow-md active:scale-95 group"
                    >
                      <X size={13} className="group-hover:scale-110 transition-transform" />
                      <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[52px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest">Cancel</span>
                    </button>
                  )}
                </div>
             </div>
          )})}
        </div>

        {/* Removing old integrated pagination chunk, inserting standard structure below container */}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-sm text-gray-400 font-medium">
          {total === 0 ? 'No slips found' : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Previous
          </button>
          <span className="text-sm text-gray-500 font-medium px-1">
            Page {page + 1} of {totalPages || 1}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || totalPages === 0}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next
          </button>
        </div>
      </div>

      {editingVisit && (
        <div className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
            <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between pointer-events-none">
              <h2 className="text-white font-bold pointer-events-auto">Edit OPD Slip</h2>
              <button type="button" onClick={() => setEditingVisit(null)} className="text-white/80 hover:text-white pointer-events-auto"><X size={18} /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
               <div className="grid grid-cols-2 gap-3">
                 <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={editingVisit.patient_name || ''}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="Patient full name"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editingVisit.patient_phone || ''}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_phone: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="Mobile number"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Age</label>
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={editingVisit.patient_age || ''}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_age: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Gender</label>
                    <select
                      value={editingVisit.patient_gender || 'male'}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_gender: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Guardian / Relative</label>
                    <input
                      type="text"
                      value={editingVisit.patient_guardian_name || ''}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_guardian_name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="Guardian name"
                    />
                 </div>
                 <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Address</label>
                    <input
                      type="text"
                      value={editingVisit.patient_address || ''}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_address: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="Address"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">City</label>
                    <input
                      type="text"
                      value={editingVisit.patient_city || ''}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_city: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="City"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">State</label>
                    <input
                      type="text"
                      value={editingVisit.patient_state || ''}
                      onChange={e => setEditingVisit({ ...editingVisit, patient_state: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="State"
                    />
                 </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Visit Date</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={editingVisit.visit_date ? format(new Date(editingVisit.visit_date), 'd/M/yyyy') : ''}
                      onClick={(e) => e.target.nextSibling.showPicker()}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer bg-white"
                      placeholder="Select date..."
                    />
                    <input
                      type="date"
                      required
                      className="absolute inset-0 opacity-0 pointer-events-none"
                      value={editingVisit.visit_date}
                      onChange={e => setEditingVisit({...editingVisit, visit_date: e.target.value})}
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Doctor</label>
                  <select value={editingVisit.doctor_user || ''} onChange={e => setEditingVisit({...editingVisit, doctor_user: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                     <option value="">-- No Doctor --</option>
                     {doctors
                       .filter(d => getDoctorUserId(d))
                       .map(d => (
                         <option key={getDoctorUserId(d)} value={getDoctorUserId(d)}>
                           Dr. {d.name || d.first_name || d.email}
                         </option>
                       ))}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Chief Complaint</label>
                  <input type="text" value={editingVisit.visit_reason || ''} onChange={e => setEditingVisit({...editingVisit, visit_reason: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Amount</label>
                    <input type="number" step="1" value={editingVisit.amount || ''} onChange={e => setEditingVisit({...editingVisit, amount: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. 500" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Payment</label>
                    <select value={editingVisit.payment_mode || 'cash'} onChange={e => setEditingVisit({...editingVisit, payment_mode: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                       <option value="cash">Cash</option>
                       <option value="upi">UPI</option>
                       <option value="other">Other</option>
                    </select>
                 </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                  <select value={editingVisit.status || 'waiting'} onChange={e => setEditingVisit({...editingVisit, status: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                     <option value="waiting">Waiting</option>
                     <option value="in_progress">In Progress</option>
                     <option value="completed">Completed</option>
                     <option value="cancelled">Cancelled</option>
                  </select>
               </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-end bg-gray-50 mt-auto shrink-0">
               <button type="button" onClick={() => setEditingVisit(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
               <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">Save Changes</button>
            </div>
          </form>
        </div>
      )}
      
      {viewVisit && (
        <div className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
            <div className="bg-gray-800 px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-black text-lg shadow-inner">
                  {viewVisit.patient_name?.charAt(0) || 'P'}
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">{viewVisit.patient_name || '--'}</h2>
                  <p className="text-xs text-gray-400 font-mono tracking-tighter">{viewVisit.patient_uhid || 'No UHID'}</p>
                </div>
              </div>
              <button onClick={() => setViewVisit(null)} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column: Demographics */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Users size={18} className="text-emerald-500" />
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Patient Demographics</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gender</p>
                      <p className="text-sm font-bold text-gray-800 capitalize">{viewVisit.patient_gender || '--'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Age</p>
                      <p className="text-sm font-bold text-gray-800">{viewVisit.patient_age ? `${viewVisit.patient_age} Years` : '--'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Phone Number</span>
                      <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mt-0.5">
                        <Phone size={13} className="text-emerald-500" /> {viewVisit.patient_phone || '--'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Guardian / Relative</span>
                      <span className="text-sm font-bold text-gray-700 mt-0.5">{viewVisit.patient_guardian_name || '--'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Full Address</span>
                      <span className="text-sm font-bold text-gray-700 mt-0.5 leading-relaxed">
                        {viewVisit.patient_address || '--'}
                        {(viewVisit.patient_city || viewVisit.patient_state) && (
                          <span className="block text-xs font-medium text-gray-500 mt-0.5">
                            {viewVisit.patient_city}{viewVisit.patient_city && viewVisit.patient_state ? ', ' : ''}{viewVisit.patient_state}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Visit & Financials */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Activity size={18} className="text-blue-500" />
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Visit & Financials</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Consulting Doctor</span>
                      <span className="text-sm font-bold text-gray-700">{viewVisit.doctor_name || '--'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Token / Date</span>
                      <span className="text-sm font-bold text-gray-700">#{viewVisit.queue_number || viewVisit.token_number} · {viewVisit.visit_date ? format(new Date(viewVisit.visit_date), 'd/M/yyyy') : '--'}</span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Registration Time</span>
                      <span className="text-sm font-bold text-gray-600">
                        {viewVisit.created_at ? format(new Date(viewVisit.created_at), 'd/M/yyyy (HH:mm)') : '--'}
                      </span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase mb-1">Chief Complaint</span>
                      <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg inline-block leading-tight">{viewVisit.visit_reason || 'No complaint specified'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 shadow-sm relative overflow-hidden group">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-0.5">Billing Amount</p>
                      <p className="text-2xl font-black text-emerald-700 flex items-baseline gap-1.5 focus:outline-none">
                        <span className="text-lg opacity-40">₹</span>{viewVisit.amount || '0'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Payment Mode</p>
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white uppercase shadow-sm">{viewVisit.payment_mode || 'Cash'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Current Status</span>
                    <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border ${statusColors[viewVisit.status] || 'bg-gray-100 text-gray-800'}`}>
                      {viewVisit.status?.replace('_', ' ')}
                    </span>
                  </div>
                  {viewVisit.status === 'cancelled' && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1.5">
                      <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Cancellation Details</p>
                      <p className="text-xs text-gray-700"><span className="font-bold">Reason:</span> {viewVisit.cancel_reason || '--'}</p>
                      <p className="text-xs text-gray-700"><span className="font-bold">Cancelled By:</span> {viewVisit.cancelled_by_name || '--'}</p>
                      <p className="text-xs text-gray-700"><span className="font-bold">Cancelled At:</span> {viewVisit.cancelled_at ? format(new Date(viewVisit.cancelled_at), 'd/M/yyyy (HH:mm)') : '--'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-4">
              <button onClick={() => setViewVisit(null)} 
                className="flex-1 py-3 px-4 rounded-xl font-black text-xs text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-[0.2em] border border-transparent hover:border-gray-200 active:scale-95 group">
                <X size={16} className="group-hover:rotate-90 transition-transform duration-300" /> Close
              </button>
              <button onClick={() => reprintOpdSlip(viewVisit)} disabled={viewVisit.status === 'cancelled'}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-[0.2em] active:scale-95 group ${viewVisit.status === 'cancelled' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5'}`}>
                <Printer size={16} className="group-hover:scale-110 transition-transform" /> Print Slip
              </button>
              <button onClick={() => moveVisitToIpd(viewVisit)} disabled={viewVisit.status === 'cancelled'}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-[0.2em] active:scale-95 group ${viewVisit.status === 'cancelled' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5'}`}>
                <Bed size={16} className="group-hover:scale-110 transition-transform" /> Move To IPD
              </button>
              <button onClick={() => { openEditVisit(viewVisit); setViewVisit(null); }} disabled={viewVisit.status === 'cancelled'}
                className={`flex-[1.5] py-3 px-4 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-[0.2em] active:scale-95 group ${viewVisit.status === 'cancelled' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-0.5'}`}>
                <Edit2 size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> Edit Visit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelVisit && (
        <div className="fixed inset-0 z-[110] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-4 py-3 bg-red-600 text-white flex items-center justify-between">
              <h3 className="font-bold">Cancel OPD Slip</h3>
              <button
                type="button"
                onClick={() => { if (!cancelling) { setCancelVisit(null); setCancelReason('') } }}
                className="text-white/80 hover:text-white"
                disabled={cancelling}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-700">
                You are cancelling slip <span className="font-black text-gray-900">{cancelVisit.opd_no || `#${cancelVisit.queue_number || cancelVisit.token_number}`}</span> for{' '}
                <span className="font-semibold">{cancelVisit.patient_name || 'Patient'}</span>. This will make the slip view-only and remove its amount from collection totals.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Cancellation Reason *</label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none"
                  placeholder="Enter reason for cancellation"
                  disabled={cancelling}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => { if (!cancelling) { setCancelVisit(null); setCancelReason('') } }}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitCancelVisit}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {printVisit && <PrintSlip visit={printVisit} onClose={() => setPrintVisit(null)} />}
    </div>
  )
}

// ─── Payment Slips / History ───────────────────────────────────────────────────
function PaymentSlipsListSection() {
  const [payments, setPayments] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [editingPayment, setEditingPayment] = useState(null)
  const [viewPayment, setViewPayment] = useState(null)
  const PAGE_SIZE = 10
  const debounceRef = useRef(null)

  useEffect(() => {
    setPage(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPayments(0, search), 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  useEffect(() => { fetchPayments(page, search) }, [page])

  async function fetchPayments(pg = 0, q = '') {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE, ordering: '-paid_at' })
      if (q.trim()) params.set('search', q.trim())
      const { data } = await api.get(`/payments/?${params}`)
      setPayments(data?.data || data?.results || data || [])
      setTotal(data?.count ?? data?.total ?? (data?.data?.length ?? 0))
    } catch {
      toast.error('Failed to load payment slips')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    try {
      await api.patch(`/payments/${editingPayment.id}/`, {
        payment_mode: editingPayment.payment_mode || 'cash',
        amount: editingPayment.amount || 0,
        transaction_reference: editingPayment.transaction_reference || '',
        receipt_no: editingPayment.receipt_no || '',
        status: editingPayment.status || 'success',
        paid_at: editingPayment.paid_at || null,
      })
      toast.success('Payment slip updated!')
      setEditingPayment(null)
      fetchPayments(page, search)
    } catch {
      toast.error('Failed to update payment slip')
    }
  }

  function printPaymentSlip(payment) {
    if (!payment) return
    const w = createSameTabPrintWindow()
    const dateTimeStr = payment.paid_at ? format(new Date(payment.paid_at), 'd/M/yyyy HH:mm:ss') : format(new Date(), 'd/M/yyyy HH:mm:ss')
    const patientName = (payment.patient_name || 'PATIENT').toUpperCase()
    const payModeLabel =
      payment.payment_mode === 'cash'
        ? 'Cash Payment'
        : payment.payment_mode === 'card'
          ? 'Card Payment'
          : payment.payment_mode === 'upi'
            ? 'UPI Payment'
            : (payment.payment_mode || 'Payment').toUpperCase()
    const amountNum = Number(payment.amount || 0)
    const amountFixed = Number.isFinite(amountNum) ? amountNum.toFixed(2) : '0.00'
    const slipProfile = getPaymentSlipProfile()
    const hospitalName = escapeHtml(slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name)
    const address = escapeHtml(slipProfile.address || '')
    const pinCode = escapeHtml(slipProfile.pin_code || '')
    const phone = escapeHtml(slipProfile.phone || '')
    const email = escapeHtml(slipProfile.email || '')
    const website = escapeHtml(slipProfile.website || '')
    const profileLines = [
      address ? `${address}<br/>` : '',
      pinCode ? `Pin Code: ${pinCode}<br/>` : '',
      phone ? `Phone: ${phone}<br/>` : '',
      email ? `Email: ${email}<br/>` : '',
      website ? `Website: ${website}` : '',
    ].filter(Boolean).join('')
    const invoiceDetails = payment.invoice_details || null
    const lineItems = Array.isArray(invoiceDetails?.items) ? invoiceDetails.items : []
    const rows = lineItems.length
      ? lineItems.map((it, i) => {
          const lineTotal = Number(it?.line_total || 0)
          return `<tr>
              <td class="c">${i + 1}</td>
              <td class="l">${it?.description || 'Service'}</td>
              <td class="r">₹${lineTotal.toFixed(2)}</td>
            </tr>`
        }).join('')
      : `<tr>
            <td class="c">1</td>
            <td class="l">${payment.transaction_reference || payment.receipt_no || 'Payment'}</td>
            <td class="r">₹${amountFixed}</td>
          </tr>`
    const subtotalFixed = Number(invoiceDetails?.subtotal_amount ?? payment.amount ?? 0).toFixed(2)
    const discountFixed = Number(invoiceDetails?.discount_amount ?? 0).toFixed(2)
    const totalFixed = Number(invoiceDetails?.total_amount ?? payment.amount ?? 0).toFixed(2)

    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Receipt — ${payment.slip_number || payment.invoice_no || payment.receipt_no || 'Payment'}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          color: #111;
          width: 210mm;
          background: #fff;
        }
        .slip {
          width: 210mm;
          height: 148.5mm;
          padding: 6mm 8mm 4mm;
          display: flex;
          flex-direction: column;
          border-bottom: 2px dashed #aaa;
        }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 4mm;
          border-bottom: 2px solid #111;
          margin-bottom: 3mm;
        }
        .hosp-name {
          font-size: 22px;
          font-weight: 900;
          color: #1a6b3f;
          letter-spacing: -0.5px;
          line-height: 1;
          margin-bottom: 2px;
        }
        .hosp-tag { font-size: 9px; color: #555; letter-spacing: 0.5px; text-transform: uppercase; }
        .address { text-align: right; font-size: 9.5px; color: #333; line-height: 1.55; }
        .address strong { font-size: 10px; }
        .receipt-title {
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          border-bottom: 1px solid #111;
          padding-bottom: 2mm;
          margin-bottom: 2.5mm;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1.5mm 4mm;
          margin-bottom: 2.5mm;
          font-size: 10px;
        }
        .info-cell { display: flex; flex-direction: column; gap: 1px; }
        .info-label { color: #666; font-size: 9px; }
        .info-val { font-weight: 700; color: #111; }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        thead tr { background: #1a6b3f; color: #fff; }
        th { padding: 3px 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
        th.c { text-align: center; width: 26px; }
        th.l { text-align: left; }
        th.r { text-align: right; width: 52px; }
        tbody tr { border-bottom: 1px solid #e5e7eb; }
        tbody tr:last-child { border-bottom: 1.5px solid #111; }
        td { padding: 3px 5px; }
        td.c { text-align: center; color: #555; }
        td.l { text-align: left; }
        td.r { text-align: right; font-weight: 600; }
        .totals { margin-left: auto; width: 160px; margin-top: 1mm; font-size: 10.5px; }
        .t-row { display: flex; justify-content: space-between; padding: 1px 5px; }
        .t-row.disc { color: #dc2626; }
        .t-row.final {
          font-weight: 800;
          font-size: 12px;
          border-top: 2px solid #111;
          padding-top: 2px;
          margin-top: 2px;
          color: #1a6b3f;
        }
        .footer {
          margin-top: auto;
          padding-top: 2mm;
          border-top: 1px dashed #aaa;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 9px;
          color: #555;
        }
        .note { max-width: 65%; line-height: 1.5; }
        .paid-box {
          border: 2px solid #1a6b3f;
          color: #1a6b3f;
          font-weight: 900;
          font-size: 13px;
          padding: 2px 10px;
          border-radius: 4px;
          letter-spacing: 2px;
        }
      </style>
    </head>
    <body>
      <div class="slip">
        <div class="top">
          <div>
            <div class="hosp-name">${hospitalName}</div>
            <div class="hosp-tag">Healthcare &amp; Diagnostics</div>
          </div>
          <div class="address">
            ${profileLines || 'Phone: --'}
          </div>
        </div>

        <div class="receipt-title">Receipt</div>

        <div class="info-grid">
          <div class="info-cell">
            <span class="info-label">Slip Number</span>
            <span class="info-val">${payment.slip_number || '--'}</span>
          </div>
          <div class="info-cell">
            <span class="info-label">Invoice Number</span>
            <span class="info-val">${payment.invoice_no || '--'}</span>
          </div>
          <div class="info-cell">
            <span class="info-label">Name</span>
            <span class="info-val">${patientName}</span>
          </div>
          <div class="info-cell">
            <span class="info-label">Gender / Age</span>
            <span class="info-val">Other</span>
          </div>
          <div class="info-cell">
            <span class="info-label">Pay Mode</span>
            <span class="info-val">${payModeLabel}</span>
          </div>
          <div class="info-cell">
            <span class="info-label">Mobile No.</span>
            <span class="info-val">—</span>
          </div>
          <div class="info-cell">
            <span class="info-label">Date</span>
            <span class="info-val">${dateTimeStr}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="c">SL No.</th>
              <th class="l">Test Type / Service</th>
              <th class="r">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="t-row"><span>Total Amount:</span><span>₹${subtotalFixed}</span></div>
          <div class="t-row disc"><span>Discount:</span><span>₹${discountFixed}</span></div>
          <div class="t-row final"><span>Net Amount:</span><span>₹${totalFixed}</span></div>
        </div>

        <div class="footer">
          <div class="note">
            <strong>Note:</strong> Your reports will be preserved only for 6 months.<br/>
            Please retain this receipt for future reference.
          </div>
          <div class="paid-box">✓ PAID</div>
        </div>
      </div>
      ${PRINT_WINDOW_CLOSE_SCRIPT}
    </body></html>`)
    w.document.close()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const statusColors = {
    success: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-200 text-gray-800',
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[['Total Slips', total, 'text-gray-900'], ['Showing', total === 0 ? '0' : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)}`, 'text-emerald-600']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{l}</p>
              <p className={`text-2xl font-black ${c}`}>{v}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative flex flex-col min-h-[calc(100vh-320px)]">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/60">
          <Search size={15} className="text-gray-400 shrink-0" strokeWidth={2} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice, UHID, ref, receipt…" className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400" />
          {loading && <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />}
          <button onClick={() => fetchPayments(page, search)} className="text-gray-400 hover:text-emerald-600 shrink-0"><RefreshCw size={14} strokeWidth={2} /></button>
          <span className="text-xs text-gray-400 shrink-0">{total} slips</span>
        </div>

        <div className="grid grid-cols-12 px-4 py-2 bg-gray-100/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-2">Date/Receipt</div>
          <div className="col-span-2">Patient</div>
          <div className="col-span-2">Invoice/Mode</div>
          <div className="col-span-2 text-center">Status / Amt</div>
          <div className="col-span-2">Ref</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-gray-50 flex-1">
          {loading ? <div className="py-12 text-center text-sm text-gray-400">Loading…</div> : payments.length === 0 ? <div className="py-12 text-center text-sm text-gray-400">No payment slips found</div> : payments.map((p) => (
            <div key={p.id} className="grid grid-cols-12 px-4 py-3 items-center text-sm hover:bg-gray-50/50 transition-colors">
              <div className="col-span-2 flex flex-col items-start min-w-0 pr-2">
                <span className="font-bold text-gray-800">{p.paid_at ? format(new Date(p.paid_at), 'd/M/yyyy') : '--'}</span>
                <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 mt-0.5 rounded">{p.receipt_no || '--'}</span>
              </div>
              <div className="col-span-2 min-w-0 pr-2">
                <p className="font-bold text-gray-800 truncate">{p.patient_name || 'Patient'}</p>
                <p className="text-[10px] text-gray-500 font-mono truncate">{p.patient_uhid || '--'}</p>
                {p.collected_by_name && <p className="text-[10px] text-gray-400 font-bold mt-0.5">By: {p.collected_by_name}</p>}
              </div>
              <div className="col-span-2 min-w-0 pr-2">
                <span className="text-gray-600 truncate block font-semibold">{p.invoice_no || '--'}</span>
                <span className="text-[10px] text-indigo-600 font-bold uppercase">{p.payment_mode || 'cash'}</span>
              </div>
              <div className="col-span-2 flex flex-col items-center gap-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColors[p.status] || 'bg-gray-100 text-gray-800'}`}>
                  {p.status}
                </span>
                <span className="text-xs font-bold text-gray-600 border border-gray-200 px-1.5 rounded bg-gray-50 flex items-center">
                  <IndianRupee size={10} className="mr-0.5" /> {p.amount || '0'}
                </span>
              </div>
              <div className="col-span-2 min-w-0 pr-2">
                <p className="text-xs text-gray-500 truncate">{p.transaction_reference || '--'}</p>
              </div>
              <div className="col-span-2 flex flex-row gap-2 items-center justify-end">
                <button
                  onClick={() => setViewPayment(p)}
                  title="View"
                  aria-label="View payment slip"
                  className="h-8 w-8 hover:w-[72px] flex items-center justify-center gap-1 overflow-hidden text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition-all duration-150 border border-indigo-100 shadow-sm hover:shadow-md active:scale-95 group"
                >
                  <Eye size={13} className="group-hover:scale-110 transition-transform" />
                  <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[40px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest">View</span>
                </button>
                <button
                  onClick={() => setEditingPayment({ ...p, paid_at: toDateTimeInputValue(p.paid_at) })}
                  title="Edit"
                  aria-label="Edit payment slip"
                  className="h-8 w-8 hover:w-[68px] flex items-center justify-center gap-1 overflow-hidden text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 rounded-lg transition-all duration-150 border border-emerald-100 shadow-sm hover:shadow-md active:scale-95 group"
                >
                  <Edit2 size={13} className="group-hover:scale-110 transition-transform" />
                  <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[36px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest">Edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-sm text-gray-400 font-medium">
          {total === 0 ? 'No slips found' : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Previous
          </button>
          <span className="text-sm text-gray-500 font-medium px-1">
            Page {page + 1} of {totalPages || 1}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || totalPages === 0}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next
          </button>
        </div>
      </div>

      {editingPayment && (
        <div className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
            <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between pointer-events-none">
              <h2 className="text-white font-bold pointer-events-auto">Edit Payment Slip</h2>
              <button type="button" onClick={() => setEditingPayment(null)} className="text-white/80 hover:text-white pointer-events-auto"><X size={18} /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Paid At</label>
                <input type="datetime-local" value={editingPayment.paid_at || ''} onChange={e => setEditingPayment({ ...editingPayment, paid_at: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Amount</label>
                  <input type="number" step="0.01" value={editingPayment.amount || ''} onChange={e => setEditingPayment({ ...editingPayment, amount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Payment Mode</label>
                  <select value={editingPayment.payment_mode || 'cash'} onChange={e => setEditingPayment({ ...editingPayment, payment_mode: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Transaction Reference</label>
                <input type="text" value={editingPayment.transaction_reference || ''} onChange={e => setEditingPayment({ ...editingPayment, transaction_reference: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Receipt Number</label>
                <input type="text" value={editingPayment.receipt_no || ''} onChange={e => setEditingPayment({ ...editingPayment, receipt_no: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                <select value={editingPayment.status || 'success'} onChange={e => setEditingPayment({ ...editingPayment, status: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-end bg-gray-50 mt-auto shrink-0">
              <button type="button" onClick={() => setEditingPayment(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {viewPayment && (
        <div className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-gray-800 px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-black text-lg shadow-inner">
                  <Receipt size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">{viewPayment.patient_name || 'Payment Slip'}</h2>
                  <p className="text-xs text-gray-400 font-mono tracking-tighter">{viewPayment.patient_uhid || 'No UHID'}</p>
                </div>
              </div>
              <button onClick={() => setViewPayment(null)} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 md:col-span-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Invoice No</p>
                <p className="text-xs font-bold text-gray-800 break-all">{viewPayment.invoice_no || '--'}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 md:col-span-2">
                <p className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest mb-0.5">Amount</p>
                <p className="text-lg font-black text-emerald-700">₹{Number(viewPayment.amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Receipt No</p>
                <p className="text-xs font-bold text-gray-800">{viewPayment.receipt_no || '--'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Payment Mode</p>
                <p className="text-xs font-bold text-gray-800 uppercase">{viewPayment.payment_mode || '--'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Status</p>
                <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColors[viewPayment.status] || 'bg-gray-100 text-gray-800'}`}>
                  {viewPayment.status || '--'}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Collected By</p>
                <p className="text-xs font-bold text-gray-800 truncate">{viewPayment.collected_by_name || '--'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 md:col-span-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Paid At</p>
                <p className="text-xs font-bold text-gray-800">{viewPayment.paid_at ? format(new Date(viewPayment.paid_at), 'd/M/yyyy (HH:mm)') : '--'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 md:col-span-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Transaction Reference</p>
                <p className="text-xs font-bold text-gray-800 break-all">{viewPayment.transaction_reference || '--'}</p>
              </div>
            </div>

            <div className="px-4 pb-3 flex-1 min-h-0">
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden h-full flex flex-col">
                <div className="px-3 py-2 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Billed Items
                </div>
                {Array.isArray(viewPayment?.invoice_details?.items) && viewPayment.invoice_details.items.length > 0 ? (
                  <div className="min-h-[240px] max-h-[44vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-3 py-2">Description</th>
                          <th className="text-right px-3 py-2">Qty</th>
                          <th className="text-right px-3 py-2">Rate</th>
                          <th className="text-right px-3 py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewPayment.invoice_details.items.map((it) => (
                          <tr key={it.id}>
                            <td className="px-3 py-2.5 text-gray-800">{it.description || '--'}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{it.quantity || 0}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-900">₹{Number(it.line_total || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="min-h-[240px] flex items-center justify-center text-sm text-gray-400">
                    No billed items
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-4">
              <button onClick={() => setViewPayment(null)}
                className="flex-1 py-3 px-4 rounded-xl font-black text-xs text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-[0.2em] border border-transparent hover:border-gray-200 active:scale-95 group">
                <X size={16} className="group-hover:rotate-90 transition-transform duration-300" /> Close
              </button>
              <button onClick={() => printPaymentSlip(viewPayment)}
                className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 uppercase tracking-[0.2em] active:scale-95 group">
                <Printer size={16} className="group-hover:scale-110 transition-transform" /> Print Slip
              </button>
              <button onClick={() => { setEditingPayment({ ...viewPayment, paid_at: toDateTimeInputValue(viewPayment.paid_at) }); setViewPayment(null) }}
                className="flex-[1.5] py-3 px-4 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 uppercase tracking-[0.2em] active:scale-95 group">
                <Edit2 size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> Edit Slip Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentSlipSettingsSection() {
  const [form, setForm] = useState(() => getPaymentSlipProfile())

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      await loadReceptionPortalSettings()
      if (!cancelled) setForm(getPaymentSlipProfile())
    }
    hydrate()
    return () => { cancelled = true }
  }, [])

  function onChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    try {
      await savePaymentSlipProfile(form)
      toast.success('Payment slip details saved')
    } catch {
      toast.error('Failed to save payment slip details')
    }
  }

  async function handleReset() {
    setForm({ ...DEFAULT_PAYMENT_SLIP_PROFILE })
    try {
      await savePaymentSlipProfile(DEFAULT_PAYMENT_SLIP_PROFILE)
      toast.success('Payment slip details reset')
    } catch {
      toast.error('Failed to reset payment slip details')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-lg font-black text-gray-800">Hospital Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          These details will be printed in the payment slip header.
        </p>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Hospital Name</label>
            <input
              type="text"
              value={form.hospital_name || ''}
              onChange={(e) => onChange('hospital_name', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder="Enter hospital name"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Address</label>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => onChange('address', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder="Hospital address"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Pin Code</label>
              <input
                type="text"
                value={form.pin_code || ''}
                onChange={(e) => onChange('pin_code', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="Pin code"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Phone</label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={(e) => onChange('phone', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="+91-XXXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => onChange('email', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="info@hospital.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Website</label>
            <input
              type="text"
              value={form.website || ''}
              onChange={(e) => onChange('website', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder="www.hospital.com"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 transition-colors"
            >
              Save Settings
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              Reset Default
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OpdSettingsSection() {
  const [form, setForm] = useState(() => getReceptionOpdSettings())
  const [doctors, setDoctors] = useState([])

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      await loadReceptionPortalSettings()
      if (!cancelled) setForm(getReceptionOpdSettings())
    }
    hydrate()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadDoctors() {
      try {
        const { data } = await api.get('/doctor-profiles/?limit=500')
        if (cancelled) return
        const rows = Array.isArray(data?.data) ? data.data : (data?.results || data || [])
        setDoctors(rows)
      } catch {
        // keep dropdown empty on failure
      }
    }
    loadDoctors()
    return () => { cancelled = true }
  }, [])

  function onChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    try {
      await saveReceptionOpdSettings(form)
      toast.success('OPD settings saved')
    } catch {
      toast.error('Failed to save OPD settings')
    }
  }

  async function handleReset() {
    setForm({ ...DEFAULT_RECEPTION_OPD_SETTINGS })
    try {
      await saveReceptionOpdSettings(DEFAULT_RECEPTION_OPD_SETTINGS)
      toast.success('OPD settings reset')
    } catch {
      toast.error('Failed to reset OPD settings')
    }
  }

  const withBg = form.print_with_background !== false

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-lg font-black text-gray-800">OPD Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set default city and state for Token Queue registration form.
        </p>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Default City</label>
              <input
                type="text"
                value={form.default_city || ''}
                onChange={(e) => onChange('default_city', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Default State</label>
              <input
                type="text"
                value={form.default_state || ''}
                onChange={(e) => onChange('default_state', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="State"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Default Doctor</label>
            <select
              value={form.default_doctor_user || ''}
              onChange={(e) => onChange('default_doctor_user', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="">Walk-in / Any</option>
              {doctors.map((d) => (
                <option key={d.user || d.id} value={String(d.user || d.id)}>
                  {d.name}{d.consultation_fee > 0 ? ` · ₹${d.consultation_fee}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ── OPD Slip Print Background Toggle ── */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">OPD Slip Background Image</p>
                <p className="text-xs text-gray-500 mt-0.5">When enabled, the A4 OPD slip prints with the template background image. Disable to print on plain paper.</p>
              </div>
              <button
                type="button"
                onClick={() => onChange('print_with_background', !withBg)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${
                  withBg ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  withBg ? 'translate-x-7' : 'translate-x-0'
                }`} />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <div className={`flex-1 rounded-lg border-2 p-3 text-center cursor-pointer transition-all ${
                withBg ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white opacity-50'
              }`} onClick={() => onChange('print_with_background', true)}>
                <div className="text-2xl mb-1">🖼️</div>
                <p className="text-xs font-bold text-gray-700">With Background</p>
                <p className="text-[10px] text-gray-400">Prints template image</p>
              </div>
              <div className={`flex-1 rounded-lg border-2 p-3 text-center cursor-pointer transition-all ${
                !withBg ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white opacity-50'
              }`} onClick={() => onChange('print_with_background', false)}>
                <div className="text-2xl mb-1">📄</div>
                <p className="text-xs font-bold text-gray-700">Plain Paper</p>
                <p className="text-[10px] text-gray-400">No background image</p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 transition-colors"
            >
              Save Settings
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              Reset Default
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReceptionSettingsSection({ rooms, setRooms, tvGroups, setTvGroups }) {
  const tabs = [
    { id: 'opd', label: 'OPD Settings', icon: Users },
    { id: 'opd_template', label: 'OPD Template', icon: Printer },
    { id: 'tv', label: 'TV Screens', icon: Monitor },
    { id: 'payment_slip', label: 'Hospital Settings', icon: Receipt },
  ]
  const [tab, setTab] = useState('opd')

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex items-center gap-2 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'opd' && <OpdSettingsSection />}
        {tab === 'opd_template' && (
          <div className="h-full min-h-[72vh] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto p-3">
            <OpdGeneratorTab />
          </div>
        )}
        {tab === 'tv' && (
          <TVScreensSection rooms={rooms} setRooms={setRooms} tvGroups={tvGroups} setTvGroups={setTvGroups} />
        )}
        {tab === 'payment_slip' && <PaymentSlipSettingsSection />}
      </div>
    </div>
  )
}

// ─── A4 Payment Slip (Advance / Service) ─────────────────────────────────────
function PrintMiniReceipt({ admission, data, type, onClose, viewOnly = false }) {
  const slipProfile = getPaymentSlipProfile()
  const hospitalName = (slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name).toUpperCase()
  const address = slipProfile.address || DEFAULT_PAYMENT_SLIP_PROFILE.address
  const phone = slipProfile.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone

  useEffect(() => {
    if (viewOnly) return undefined
    const timer = setTimeout(() => window.print(), 800)
    function after() { onClose() }
    window.addEventListener('afterprint', after)
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', after) }
  }, [viewOnly, onClose])

  const label = type === 'advance' ? 'ADVANCE PAYMENT RECEIPT' : 'IPD PAYMENT RECEIPT'
  const receiptStamp = formatReceiptDateTime(data.paid_at || new Date())

  const isCredit = data.mode === 'credit'
  const totalLabel = isCredit ? 'TOTAL DUE' : 'TOTAL PAID'
  const totalColor = isCredit ? '#b45309' : '#16a34a'
  const totalBg = isCredit ? '#fffbeb' : '#f0fdf4'

  const content = (
    <div id="__receipt_root" className="fixed inset-0 z-[600] bg-white overflow-y-auto print:static print:h-auto print:overflow-visible print:bg-transparent">
      <div className="flex flex-nowrap justify-end items-center gap-2 p-4 print:hidden">
        {viewOnly && (
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold text-sm transition-colors inline-flex items-center gap-1.5"
          >
            <Printer sx={{ fontSize: 18 }} /> Print
          </button>
        )}
        <button type="button" onClick={onClose} className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold text-sm transition-colors">✕ Close</button>
      </div>

      <div className="shadow-2xl print:shadow-none" style={{ width: '210mm', height: '148.5mm', margin: '0 auto', background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', padding: '10mm 12mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', borderBottom: '2px dashed #aaa' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: '3mm', marginBottom: '4mm' }}>
           <div>
             <p style={{ fontSize: 24, fontWeight: 900, color: '#1a6b3f', margin: 0 }}>{hospitalName}</p>
             <p style={{ fontSize: 9, color: '#555', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Inpatient Services Receipt</p>
           </div>
           <div style={{ textAlign: 'right', fontSize: 10, color: '#333' }}>
             <p><strong>{address}</strong></p>
             <p>Contact: {phone}</p>
             <p style={{ marginTop: 2, fontWeight: 700 }}>{receiptStamp}</p>
           </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, borderBottom: '1px solid #111', paddingBottom: '2mm', marginBottom: '4mm' }}>{label}</p>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2mm 5mm', marginBottom: '4mm', fontSize: '11px' }}>
          {[
            ['Patient Name', (admission.patient_name || '—').toUpperCase()],
            ['UHID', admission.patient_uhid || '—'],
            ['IPD ID', admission.ipd_no || '—'],
            ['Ward / Room', formatWardRoomReceiptLabel(admission.ward_name, admission.room_name)],
            ['Bed Code', admission.bed_code || '—'],
            ['Adm. Date', admission.admission_date ? format(new Date(admission.admission_date), 'd/M/yyyy') : '—'],
            ['Payment Mode', (data.mode || '—').toUpperCase()],
            ['Payment Ref', data.invoice_no || data.slip_number || '—'],
          ].map(([l, v]) => (
            <div key={l}>
              <p style={{ color: '#666', fontSize: '9px', marginBottom: 1 }}>{l}</p>
              <p style={{ fontWeight: 700 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1a6b3f', color: '#fff' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', textTransform: 'uppercase' }}>Description</th>
              <th style={{ padding: '6px 10px', textAlign: 'right', textTransform: 'uppercase', width: '30%' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1.5px solid #111' }}>
              <td style={{ padding: '10px' }}>{data.description || 'IPD Service / Advance Payment'}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{parseFloat(data.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ background: totalBg }}>
              <td style={{ padding: '8px 10px', fontWeight: 800 }}>{totalLabel}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: totalColor }}>₹ {parseFloat(data.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', paddingTop: '5mm' }}>
           <div style={{ textAlign: 'center', width: '35%' }}>
             <div style={{ borderTop: '1px solid #111', paddingTop: 4, fontSize: 10, fontWeight: 700 }}>Patient / Guardian</div>
           </div>
           <div style={{ textAlign: 'center', width: '35%' }}>
             <div style={{ borderTop: '1px solid #111', paddingTop: 4, fontSize: 10, fontWeight: 700 }}>Authorized Signatory</div>
           </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background: #fff !important; height: auto !important; overflow: visible !important; }
          body > *:not(#__receipt_root) { display: none !important; }
          #__receipt_root { 
            position: static !important; display: block !important; overflow: visible !important; 
            height: auto !important; padding: 0 !important; margin: 0 !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
  return createPortal(content, document.body)
}

function isIpdLedgerGroupedRowCancelled(row) {
  if (!row) return false
  if (String(row.description || '').includes('(Cancelled)')) return true
  return (row.events || []).some(e => String(e?.invoice_status || '').toLowerCase() === 'cancelled')
}

// ─── IPD Ledger Modal ────────────────────────────────────────────────────────
function AdmissionLedgerModal({ admission, onClose, autoDischarge = false, onDischargeInitiated, autoOpenDischargeEdit = false }) {
  const [ledger, setLedger]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [mode, setMode]             = useState('charge') // 'charge' | 'receive' | 'discount'
  const [submitting, setSubmitting] = useState(false)
  const [showPrint, setShowPrint]   = useState(false)
  const [receipt, setReceipt]       = useState(null)
  const [showReceiptsModal, setShowReceiptsModal] = useState(false)
  const [ledgerCancelPayment, setLedgerCancelPayment] = useState(null)
  const [ledgerCancelPaymentReason, setLedgerCancelPaymentReason] = useState('')
  const [ledgerCancellingPayment, setLedgerCancellingPayment] = useState(false)
  const [ledgerCancelInvoice, setLedgerCancelInvoice] = useState(null)
  const [ledgerCancelInvoiceReason, setLedgerCancelInvoiceReason] = useState('')
  const [ledgerCancellingInvoice, setLedgerCancellingInvoice] = useState(false)
  const [ledgerEditingPayment, setLedgerEditingPayment] = useState(null)
  const [ledgerSavingPayment, setLedgerSavingPayment] = useState(false)
  const [ledgerEditingCharge, setLedgerEditingCharge] = useState(null)
  const [ledgerSavingCharge, setLedgerSavingCharge] = useState(false)

  const paidReceipts = useMemo(() => {
    if (!ledger) return []
    return (ledger.payments || []).map(p => {
      const desc = p?.description || ''
      const upper = String(desc || '').toUpperCase()
      const isAdvance = upper.includes('ADVANCE') || String(p?.invoice_no || '').toUpperCase().includes('IPDADV-')
      const rawId = p?.id != null ? String(p.id) : ''
      const isPharmacy = p?.type === 'pharmacy_payment' || rawId.startsWith('pharmacy-paid-')
      const rowKind = isPharmacy ? 'pharmacy_payment' : 'payment'

      let mode = 'cash'
      if (upper.includes('UPI')) mode = 'upi'
      else if (upper.includes('CREDIT')) mode = 'credit'
      else if (upper.includes('CARD')) mode = 'card'

      return {
        id: `payment-${rawId}-${String(p?.date || '')}`,
        paymentTransactionId: isPharmacy ? '' : rawId,
        rowKind,
        status: p?.status || 'success',
        invoice_status: p?.invoice_status != null ? String(p.invoice_status) : 'finalized',
        date: p?.date,
        description: desc || (isAdvance ? 'Advance' : 'Payment'),
        amount: parseFloat(p?.amount || 0),
        invoice_no: p?.invoice_no || '',
        slip_number: p?.slip_number || '',
        mode,
        receiptKind: isAdvance ? 'advance' : 'charge',
      }
    }).sort((a, b) => {
      const voidA = a.rowKind === 'pharmacy_payment' ? false : (a.status === 'cancelled' || String(a.invoice_status || '').toLowerCase() === 'cancelled')
      const voidB = b.rowKind === 'pharmacy_payment' ? false : (b.status === 'cancelled' || String(b.invoice_status || '').toLowerCase() === 'cancelled')
      if (voidA !== voidB) return voidA ? 1 : -1
      const ta = a.date ? new Date(a.date).getTime() : 0
      const tb = b.date ? new Date(b.date).getTime() : 0
      return ta - tb
    })
  }, [ledger])

  const admissionLedgerStatementParts = useMemo(() => {
    const gc = ledger?.grouped_charges || []
    const active = []
    const cancelled = []
    for (const row of gc) {
      if (isIpdLedgerGroupedRowCancelled(row)) cancelled.push(row)
      else active.push(row)
    }
    const rooms = (ledger?.charges || []).filter(c => c.type === 'room_rent')
    return [
      ...active.map(row => ({ kind: 'group', row })),
      ...rooms.map(row => ({ kind: 'room', row })),
      ...cancelled.map(row => ({ kind: 'group', row })),
    ]
  }, [ledger?.grouped_charges, ledger?.charges])

  // Discharge State
  const [journey, setJourney] = useState(null) // { admission, step: 'form'|'billing' }
  const emptyVitals = () => ({ bp: '', pulse: '', spo2: '', temp: '', weight: '', rbs: '' })
  const emptySurgeryDraft = () => ({
    surgery_date: '',
    procedure_name: '',
    surgeon_name: '',
    assistant_name: '',
    anaesthetist_name: '',
    anaesthesia_type: '',
    operative_findings: '',
    intra_op_complications: '',
  })
  const [summary, setSummary] = useState({
    summary_notes: '', treatment_given: '', condition_at_discharge: 'Stable',
    medications_on_discharge: '', follow_up_advice: '',
    reason_for_admission: '', diagnosis: '', allergies: '', procedure_surgery: '',
    medical_history: '', physical_examination: '', investigations: '', course_in_hospital: '',
    diet_advice: '', activity_advice: '', warning_signs: '',
    chief_complaints: '', co_morbidities: '', family_history: '', personal_history: '',
    complications_during_stay: '', blood_transfusion_details: '', implants_used: '',
    indwelling_devices_on_discharge: '', vaccination_given: '', wound_care_instructions: '',
    stitch_removal_date: '',
    vitals_at_discharge: emptyVitals(),
    surgery_date: '', surgeon_name: '', assistant_name: '', anaesthetist_name: '', anaesthesia_type: '',
    operative_findings: '', intra_op_complications: '',
    discharge_date: '', discharge_time: '',
    discharge_type: 'routine', discharge_status: 'improved', mode_of_admission: 'opd',
    referred_to_facility: '', referral_reason: '',
    treating_consultant: '', consultant_registration_no: '', rmo_signed_by: '',
    next_follow_up_date: '', follow_up_doctor: '', follow_up_department: '',
    cause_of_death: '', time_of_death: '', notified_to: '', autopsy_required: false,
    abha_id: '', insurance_provider: '', tpa_name: '', policy_number: '', claim_number: '',
    patient_education_given: false, attendant_counselled_by: '',
    investigation_rows: [],
    surgery_rows: [],
  })
  const [surgeryDraft, setSurgeryDraft] = useState(emptySurgeryDraft())
  const [editingSurgeryIndex, setEditingSurgeryIndex] = useState(-1)
  /** Doctor-style discharge meds (pharmacy search + manual); synced to API as medication_rows */
  const [dischargeRxItems, setDischargeRxItems] = useState([])
  const [billing, setBilling] = useState(null)
  const [draftSaving, setDraftSaving] = useState(false)
  const [dischargeHydrated, setDischargeHydrated] = useState(false)
  const [settleMode, setSettleMode] = useState('cash')
  const [settleRef, setSettleRef] = useState('')
  const [settlePrint, setSettlePrint] = useState(true)
  const [settleSubmitting, setSettleSubmitting] = useState(false)
  const autoOpenedDischargeEditRef = useRef(false)
  const [dischargePreviewData, setDischargePreviewData] = useState(null)
  const dischargeScrollRootRef = useRef(null)
  const [activeDischargeSection, setActiveDischargeSection] = useState('')

  const dischargeSectionNavItems = useMemo(() => {
    const head = [
      { id: 'discharge-section-metadata', Icon: ClipboardList, label: 'Discharge metadata & identifiers' },
      { id: 'discharge-section-vitals', Icon: HeartPulse, label: 'Vitals at discharge' },
    ]
    const death =
      summary.discharge_type === 'death'
        ? [{ id: 'discharge-section-death', Icon: Skull, label: 'Death summary' }]
        : []
    const tail = [
      { id: 'discharge-section-narrative', Icon: ScrollText, label: 'Clinical narrative' },
      { id: 'discharge-section-operative', Icon: Syringe, label: 'Operative / procedure' },
      { id: 'discharge-section-investigations', Icon: FlaskConical, label: 'Investigations (structured)' },
      { id: 'discharge-section-course', Icon: Hospital, label: 'Hospital course & complications' },
      { id: 'discharge-section-prescriptions', Icon: Pill, label: 'Medications on discharge' },
      { id: 'discharge-section-advice', Icon: MessageSquare, label: 'Advice on discharge' },
    ]
    return [...head, ...death, ...tail]
  }, [summary.discharge_type])

  // Receive Money form state (renamed from Capture Advance)
  const [advAmount, setAdvAmount] = useState('')
  const [advMode, setAdvMode]     = useState('cash')
  const [advRef, setAdvRef]       = useState('')
  const [advPrint, setAdvPrint]   = useState(true)

  // Add Charge form state
  const [chgDesc, setChgDesc]         = useState('')
  const [chgQty, setChgQty]           = useState('1')
  const [chgUnitPrice, setChgUnitPrice] = useState('')
  const [chgStatus, setChgStatus]     = useState('due') // 'paid' | 'due'
  const [chgPaidMode, setChgPaidMode] = useState('cash')
  const [chgPrint, setChgPrint]       = useState(false)
  const [selectedExistingCharge, setSelectedExistingCharge] = useState('')
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false)
  const [highlightedServiceIndex, setHighlightedServiceIndex] = useState(-1)
  const serviceComboboxRef = useRef(null)

  // Apply Discount form state
  const [discReason, setDiscReason] = useState('')
  const [discAmount, setDiscAmount] = useState('')

  const [expandedChargeRows, setExpandedChargeRows] = useState({})

  const dsInp = 'w-full [box-sizing:border-box] bg-white border border-slate-300 hover:border-slate-400 shadow-sm rounded-lg px-4 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none [&[type=date]]:pr-10 [&[type=time]]:pr-11 [&[type=datetime-local]]:pr-10'
  const dsLbl = 'text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block'
  const setVital = (k, v) => setSummary(s => ({
    ...s,
    vitals_at_discharge: { ...emptyVitals(), ...(s.vitals_at_discharge || {}), [k]: v },
  }))
  const addInvRow = () => setSummary(s => ({
    ...s,
    investigation_rows: [...(s.investigation_rows || []), { category: 'lab', test_name: '', value: '', reference_range: '', test_date: '' }],
  }))
  const updateInvRow = (idx, key, val) => setSummary(s => {
    const rows = [...(s.investigation_rows || [])]
    if (!rows[idx]) return s
    rows[idx] = { ...rows[idx], [key]: val }
    return { ...s, investigation_rows: rows }
  })
  const removeInvRow = (idx) => setSummary(s => ({
    ...s,
    investigation_rows: (s.investigation_rows || []).filter((_, i) => i !== idx),
  }))
  const updateSurgeryDraftField = (key, val) => {
    setSurgeryDraft((s) => ({ ...s, [key]: val }))
  }
  const resetSurgeryDraft = () => {
    setSurgeryDraft(emptySurgeryDraft())
    setEditingSurgeryIndex(-1)
  }

  const autosaveSurgeryDraftLikeSave = () => {
    const procedure = (surgeryDraft.procedure_name || '').trim()
    if (!procedure) return
    const row = {
      surgery_date: surgeryDraft.surgery_date || '',
      procedure_name: procedure,
      surgeon_name: (surgeryDraft.surgeon_name || '').trim(),
      assistant_name: (surgeryDraft.assistant_name || '').trim(),
      anaesthetist_name: (surgeryDraft.anaesthetist_name || '').trim(),
      anaesthesia_type: (surgeryDraft.anaesthesia_type || '').trim(),
      operative_findings: (surgeryDraft.operative_findings || '').trim(),
      intra_op_complications: (surgeryDraft.intra_op_complications || '').trim(),
    }
    setSummary((s) => {
      const rows = [...(s.surgery_rows || [])]
      if (editingSurgeryIndex >= 0 && rows[editingSurgeryIndex]) {
        rows[editingSurgeryIndex] = row
      } else {
        rows.push(row)
      }
      return {
        ...s,
        surgery_rows: rows,
        // Keep legacy single fields mirrored from first row for backward-compatible consumers.
        procedure_surgery: rows[0]?.procedure_name || '',
        surgery_date: rows[0]?.surgery_date || '',
        surgeon_name: rows[0]?.surgeon_name || '',
        assistant_name: rows[0]?.assistant_name || '',
        anaesthetist_name: rows[0]?.anaesthetist_name || '',
        anaesthesia_type: rows[0]?.anaesthesia_type || '',
        operative_findings: rows[0]?.operative_findings || '',
        intra_op_complications: rows[0]?.intra_op_complications || '',
      }
    })
    resetSurgeryDraft()
  }
  const saveSurgeryRow = () => {
    const procedure = (surgeryDraft.procedure_name || '').trim()
    if (!procedure) {
      toast.error('Procedure name is required before saving surgery')
      return
    }
    const row = {
      surgery_date: surgeryDraft.surgery_date || '',
      procedure_name: procedure,
      surgeon_name: (surgeryDraft.surgeon_name || '').trim(),
      assistant_name: (surgeryDraft.assistant_name || '').trim(),
      anaesthetist_name: (surgeryDraft.anaesthetist_name || '').trim(),
      anaesthesia_type: (surgeryDraft.anaesthesia_type || '').trim(),
      operative_findings: (surgeryDraft.operative_findings || '').trim(),
      intra_op_complications: (surgeryDraft.intra_op_complications || '').trim(),
    }
    setSummary((s) => {
      const rows = [...(s.surgery_rows || [])]
      if (editingSurgeryIndex >= 0 && rows[editingSurgeryIndex]) {
        rows[editingSurgeryIndex] = row
      } else {
        rows.push(row)
      }
      return {
        ...s,
        surgery_rows: rows,
        // Keep legacy single fields mirrored from first row for backward-compatible consumers.
        procedure_surgery: rows[0]?.procedure_name || '',
        surgery_date: rows[0]?.surgery_date || '',
        surgeon_name: rows[0]?.surgeon_name || '',
        assistant_name: rows[0]?.assistant_name || '',
        anaesthetist_name: rows[0]?.anaesthetist_name || '',
        anaesthesia_type: rows[0]?.anaesthesia_type || '',
        operative_findings: rows[0]?.operative_findings || '',
        intra_op_complications: rows[0]?.intra_op_complications || '',
      }
    })
    resetSurgeryDraft()
  }
  const editSurgeryRow = (idx) => {
    const row = (summary.surgery_rows || [])[idx]
    if (!row) return
    const editDraft = {
      surgery_date: row.surgery_date || '',
      procedure_name: row.procedure_name || row.procedure_surgery || '',
      surgeon_name: row.surgeon_name || '',
      assistant_name: row.assistant_name || '',
      anaesthetist_name: row.anaesthetist_name || '',
      anaesthesia_type: row.anaesthesia_type || '',
      operative_findings: row.operative_findings || '',
      intra_op_complications: row.intra_op_complications || '',
    }
    setSurgeryDraft(editDraft)
    setEditingSurgeryIndex(idx)
  }
  const removeSurgeryRow = (idx) => {
    setSummary((s) => {
      const rows = (s.surgery_rows || []).filter((_, i) => i !== idx)
      return {
        ...s,
        surgery_rows: rows,
        procedure_surgery: rows[0]?.procedure_name || '',
        surgery_date: rows[0]?.surgery_date || '',
        surgeon_name: rows[0]?.surgeon_name || '',
        assistant_name: rows[0]?.assistant_name || '',
        anaesthetist_name: rows[0]?.anaesthetist_name || '',
        anaesthesia_type: rows[0]?.anaesthesia_type || '',
        operative_findings: rows[0]?.operative_findings || '',
        intra_op_complications: rows[0]?.intra_op_complications || '',
      }
    })
    if (editingSurgeryIndex === idx) {
      resetSurgeryDraft()
    } else if (editingSurgeryIndex > idx) {
      setEditingSurgeryIndex((i) => i - 1)
    }
  }

  useEffect(() => { fetchLedger() }, [admission.id])

  useEffect(() => {
    if (autoDischarge && ledger && !loading && !journey) {
      handleInitiateDischarge();
      if (onDischargeInitiated) onDischargeInitiated();
    }
  }, [autoDischarge, ledger, loading, journey])

  useEffect(() => {
    if (!journey || journey.step !== 'form') return
    if (!dischargeHydrated) return
    const timer = setTimeout(() => { saveSummaryDraft() }, 900)
    return () => clearTimeout(timer)
  }, [journey, summary, dischargeRxItems, dischargeHydrated])

  useEffect(() => {
    if (!journey || journey.step !== 'form') {
      setActiveDischargeSection('')
      return
    }
    const root = dischargeScrollRootRef.current
    if (!root) return

    const ids = dischargeSectionNavItems.map((i) => i.id)
    let raf = 0
    const onObserve = (entries) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const visible = entries.filter((e) => e.isIntersecting && e.target?.id)
        if (!visible.length) return
        const rootRect = root.getBoundingClientRect()
        const anchorY = rootRect.top + Math.min(100, rootRect.height * 0.2)
        let bestId = ''
        let bestDist = Infinity
        visible.forEach((e) => {
          const t = e.target.getBoundingClientRect().top
          const d = Math.abs(t - anchorY)
          if (d < bestDist) {
            bestDist = d
            bestId = e.target.id
          }
        })
        if (bestId) setActiveDischargeSection(bestId)
      })
    }

    const observer = new IntersectionObserver(onObserve, {
      root,
      threshold: [0, 0.02, 0.06, 0.12, 0.25, 0.5, 1],
      rootMargin: '-10% 0px -56% 0px',
    })

    ids.forEach((id) => {
      const el = root.querySelector(`#${CSS.escape(id)}`)
      if (el) observer.observe(el)
    })

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [journey?.step, journey?.admission?.id, dischargeSectionNavItems])

  async function fetchLedger() {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd-admissions/${admission.id}/ledger/`)
      setLedger(data)
    } catch { toast.error('Failed to load ledger') }
    finally { setLoading(false) }
  }

  async function openLedgerEditPayment(paymentId) {
    if (!paymentId) return
    setLedgerSavingPayment(true)
    try {
      const { data } = await api.get(`/payments/${paymentId}/`)
      const row = data?.data || data
      setLedgerEditingPayment({ ...row, paid_at: toDateTimeInputValue(row.paid_at) })
    } catch {
      toast.error('Failed to load payment')
    } finally {
      setLedgerSavingPayment(false)
    }
  }

  async function submitLedgerCancelPayment() {
    if (!ledgerCancelPayment?.paymentTransactionId) return
    const reason = ledgerCancelPaymentReason.trim()
    if (!reason) {
      toast.error('Please enter cancellation reason')
      return
    }
    setLedgerCancellingPayment(true)
    try {
      const ref = `CANCEL:${reason}`.slice(0, 120)
      await api.patch(`/payments/${ledgerCancelPayment.paymentTransactionId}/`, {
        status: 'cancelled',
        transaction_reference: ref,
      })
      toast.success('Payment receipt cancelled')
      setLedgerCancelPayment(null)
      setLedgerCancelPaymentReason('')
      await fetchLedger()
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to cancel payment'))
    } finally {
      setLedgerCancellingPayment(false)
    }
  }

  async function submitLedgerCancelInvoice() {
    if (!ledgerCancelInvoice?.invoice_id) return
    const reason = ledgerCancelInvoiceReason.trim()
    if (!reason) {
      toast.error('Please enter cancellation reason')
      return
    }
    setLedgerCancellingInvoice(true)
    try {
      await api.post(`/invoices/${ledgerCancelInvoice.invoice_id}/cancel/`, { reason })
      toast.success('Invoice cancelled')
      setLedgerCancelInvoice(null)
      setLedgerCancelInvoiceReason('')
      await fetchLedger()
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to cancel invoice'))
    } finally {
      setLedgerCancellingInvoice(false)
    }
  }

  async function handleLedgerSavePayment(e) {
    e.preventDefault()
    if (!ledgerEditingPayment?.id) return
    setLedgerSavingPayment(true)
    try {
      await api.patch(`/payments/${ledgerEditingPayment.id}/`, {
        payment_mode: ledgerEditingPayment.payment_mode || 'cash',
        amount: ledgerEditingPayment.amount || 0,
        transaction_reference: ledgerEditingPayment.transaction_reference || '',
        receipt_no: ledgerEditingPayment.receipt_no || '',
        status: ledgerEditingPayment.status || 'success',
        paid_at: ledgerEditingPayment.paid_at || null,
      })
      toast.success('Payment slip updated!')
      setLedgerEditingPayment(null)
      await fetchLedger()
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to update payment slip'))
    } finally {
      setLedgerSavingPayment(false)
    }
  }

  function openLedgerEditChargeFromEvent(ev, descriptionFallback) {
    if (!ev?.invoice_id) return
    const invStatus = String(ev.invoice_status || '').toLowerCase()
    if (invStatus !== 'finalized') {
      toast.error('Only finalized invoices can be edited from here')
      return
    }
    const qty = parseFloat(String(ev.quantity || '1')) || 1
    const price = parseFloat(String(ev.price || '0')) || 0
    const unit = qty > 0 ? price / qty : price
    setLedgerEditingCharge({
      invoice_id: ev.invoice_id,
      description: ev.name || descriptionFallback || 'Service',
      amount: String(price),
      quantity: String(ev.quantity ?? '1'),
      unit_price: String(Number.isFinite(unit) ? unit.toFixed(2) : '0'),
      isRoomRent: false,
    })
  }

  function openLedgerEditRoomRent(item) {
    const days = Math.max(1, parseInt(String(ledger?.days ?? '1'), 10) || 1)
    const fromApiDaily = item?.unit_price != null && String(item.unit_price) !== '' ? parseFloat(String(item.unit_price)) : NaN
    const amt = parseFloat(String(item?.amount ?? '0')) || 0
    const impliedDaily = days > 0 ? amt / days : amt
    const daily = Number.isFinite(fromApiDaily) ? fromApiDaily : impliedDaily
    const total = (Number.isFinite(daily) ? daily : 0) * days
    setLedgerEditingCharge({
      invoice_id: 'room_rent',
      description: item?.description || 'Room rent',
      amount: String(Number.isFinite(total) ? total.toFixed(2) : '0'),
      quantity: String(days),
      unit_price: String(Number.isFinite(daily) ? daily.toFixed(2) : '0'),
      isRoomRent: true,
    })
  }

  async function clearRoomRentOverride() {
    setLedgerSavingCharge(true)
    try {
      await api.patch(`/ipd-admissions/${admission.id}/update-charge/`, {
        invoice_id: 'room_rent',
        clear_room_rent_override: true,
      })
      toast.success('Room rent reset to calculated amount')
      setLedgerEditingCharge(null)
      await fetchLedger()
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to reset room rent'))
    } finally {
      setLedgerSavingCharge(false)
    }
  }

  async function handleLedgerSaveCharge(e) {
    e.preventDefault()
    if (!ledgerEditingCharge?.invoice_id) return
    setLedgerSavingCharge(true)
    try {
      const isRoom = ledgerEditingCharge.invoice_id === 'room_rent'
      const payload = { invoice_id: ledgerEditingCharge.invoice_id }
      if (isRoom) {
        payload.unit_price = parseFloat(String(ledgerEditingCharge.unit_price || '0'))
      } else {
        payload.amount = parseFloat(String(ledgerEditingCharge.amount || '0'))
        payload.quantity = parseFloat(String(ledgerEditingCharge.quantity || '1'))
        payload.unit_price = parseFloat(String(ledgerEditingCharge.unit_price || '0'))
      }
      await api.patch(`/ipd-admissions/${admission.id}/update-charge/`, payload)
      toast.success(isRoom ? 'Room rent updated' : 'Charge updated')
      setLedgerEditingCharge(null)
      await fetchLedger()
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to update charge'))
    } finally {
      setLedgerSavingCharge(false)
    }
  }

  function handleInitiateDischarge() {
    setDischargeHydrated(false)
    setJourney({ admission, step: 'form' })
    setSummary({
      summary_notes: admission.admission_notes || '',
      treatment_given: '',
      condition_at_discharge: 'Stable',
      medications_on_discharge: '',
      follow_up_advice: '',
      reason_for_admission: admission.admission_diagnosis || '',
      diagnosis: '',
      allergies: '',
      procedure_surgery: '',
      medical_history: '',
      physical_examination: '',
      investigations: '',
      course_in_hospital: '',
      diet_advice: '',
      activity_advice: '',
      warning_signs: '',
      chief_complaints: '', co_morbidities: '', family_history: '', personal_history: '',
      complications_during_stay: '', blood_transfusion_details: '', implants_used: '',
      indwelling_devices_on_discharge: '', vaccination_given: '', wound_care_instructions: '',
      stitch_removal_date: '',
      vitals_at_discharge: emptyVitals(),
      surgery_date: '', surgeon_name: '', assistant_name: '', anaesthetist_name: '', anaesthesia_type: '',
      operative_findings: '', intra_op_complications: '',
      discharge_date: '', discharge_time: '',
      discharge_type: 'routine', discharge_status: 'improved',
      mode_of_admission: (admission.opd_visit_id || admission.opd_visit) ? 'opd' : 'emergency',
      referred_to_facility: '', referral_reason: '',
      treating_consultant: (admission.assigned_doctor_name || '').trim(),
      consultant_registration_no: '', rmo_signed_by: '',
      next_follow_up_date: '', follow_up_doctor: '', follow_up_department: admission.department || '',
      cause_of_death: '', time_of_death: '', notified_to: '', autopsy_required: false,
      abha_id: '', insurance_provider: '', tpa_name: '', policy_number: '', claim_number: '',
      patient_education_given: false, attendant_counselled_by: '',
      investigation_rows: [],
      surgery_rows: [],
    })
    setSurgeryDraft(emptySurgeryDraft())
    setEditingSurgeryIndex(-1)
    setDischargeRxItems([])
    loadDischargeDraft(admission.id).finally(() => setDischargeHydrated(true))
  }

  async function loadDischargeDraft(admissionId) {
    try {
      const { data } = await api.get(`/summaries/?admission_id=${admissionId}&limit=20`)
      const list = Array.isArray(data) ? data : (data?.results ?? data?.data ?? [])
      const existing = list[0]
      if (!existing) return
      const v = existing.vitals_at_discharge && typeof existing.vitals_at_discharge === 'object'
        ? { ...emptyVitals(), ...existing.vitals_at_discharge }
        : emptyVitals()
      const normalizedSurgeryRows = Array.isArray(existing.surgery_rows)
        ? existing.surgery_rows
          .map(r => ({
            surgery_date: r.surgery_date || '',
            procedure_name: r.procedure_name || r.procedure_surgery || '',
            surgeon_name: r.surgeon_name || '',
            assistant_name: r.assistant_name || '',
            anaesthetist_name: r.anaesthetist_name || '',
            anaesthesia_type: r.anaesthesia_type || '',
            operative_findings: r.operative_findings || '',
            intra_op_complications: r.intra_op_complications || '',
          }))
          .filter(r => (r.procedure_name || '').trim())
        : []
      const legacySurgeryFallback = (
        existing.procedure_surgery
        || existing.surgery_date
        || existing.surgeon_name
        || existing.assistant_name
        || existing.anaesthetist_name
        || existing.anaesthesia_type
        || existing.operative_findings
        || existing.intra_op_complications
      )
        ? [{
            surgery_date: existing.surgery_date || '',
            procedure_name: existing.procedure_surgery || '',
            surgeon_name: existing.surgeon_name || '',
            assistant_name: existing.assistant_name || '',
            anaesthetist_name: existing.anaesthetist_name || '',
            anaesthesia_type: existing.anaesthesia_type || '',
            operative_findings: existing.operative_findings || '',
            intra_op_complications: existing.intra_op_complications || '',
          }]
        : []
      setSummary({
        summary_notes: existing.summary_notes || admission.admission_notes || '',
        treatment_given: existing.treatment_given || '',
        condition_at_discharge: existing.condition_at_discharge || 'Stable',
        medications_on_discharge: existing.medications_on_discharge || '',
        follow_up_advice: existing.follow_up_advice || '',
        reason_for_admission: existing.reason_for_admission || admission.admission_diagnosis || '',
        diagnosis: existing.diagnosis || '',
        allergies: existing.allergies || '',
        procedure_surgery: existing.procedure_surgery || '',
        medical_history: existing.medical_history || '',
        physical_examination: existing.physical_examination || '',
        investigations: existing.investigations || '',
        course_in_hospital: existing.course_in_hospital || '',
        diet_advice: existing.diet_advice || '',
        activity_advice: existing.activity_advice || '',
        warning_signs: existing.warning_signs || '',
        chief_complaints: existing.chief_complaints || '',
        co_morbidities: existing.co_morbidities || '',
        family_history: existing.family_history || '',
        personal_history: existing.personal_history || '',
        complications_during_stay: existing.complications_during_stay || '',
        blood_transfusion_details: existing.blood_transfusion_details || '',
        implants_used: existing.implants_used || '',
        indwelling_devices_on_discharge: existing.indwelling_devices_on_discharge || '',
        vaccination_given: existing.vaccination_given || '',
        wound_care_instructions: existing.wound_care_instructions || '',
        stitch_removal_date: existing.stitch_removal_date || '',
        vitals_at_discharge: v,
        surgery_date: existing.surgery_date || '',
        surgeon_name: existing.surgeon_name || '',
        assistant_name: existing.assistant_name || '',
        anaesthetist_name: existing.anaesthetist_name || '',
        anaesthesia_type: existing.anaesthesia_type || '',
        operative_findings: existing.operative_findings || '',
        intra_op_complications: existing.intra_op_complications || '',
        discharge_date: existing.discharge_date || '',
        discharge_time: existing.discharge_time || '',
        discharge_type: existing.discharge_type || 'routine',
        discharge_status: existing.discharge_status || 'improved',
        mode_of_admission: existing.mode_of_admission || ((admission.opd_visit_id || admission.opd_visit) ? 'opd' : 'emergency'),
        referred_to_facility: existing.referred_to_facility || '',
        referral_reason: existing.referral_reason || '',
        treating_consultant: existing.treating_consultant || (admission.assigned_doctor_name || '').trim(),
        consultant_registration_no: existing.consultant_registration_no || '',
        rmo_signed_by: existing.rmo_signed_by || '',
        next_follow_up_date: existing.next_follow_up_date || '',
        follow_up_doctor: existing.follow_up_doctor || '',
        follow_up_department: existing.follow_up_department || admission.department || '',
        cause_of_death: existing.cause_of_death || '',
        time_of_death: existing.time_of_death || '',
        notified_to: existing.notified_to || '',
        autopsy_required: !!existing.autopsy_required,
        abha_id: existing.abha_id || '',
        insurance_provider: existing.insurance_provider || '',
        tpa_name: existing.tpa_name || '',
        policy_number: existing.policy_number || '',
        claim_number: existing.claim_number || '',
        patient_education_given: !!existing.patient_education_given,
        attendant_counselled_by: existing.attendant_counselled_by || '',
        investigation_rows: Array.isArray(existing.investigation_rows) ? existing.investigation_rows.map(r => ({
          category: r.category || 'lab',
          test_name: r.test_name || '', value: r.value || '',
          reference_range: r.reference_range || '', test_date: r.test_date || '',
        })) : [],
        surgery_rows: normalizedSurgeryRows.length > 0 ? normalizedSurgeryRows : legacySurgeryFallback,
      })
      setSurgeryDraft(emptySurgeryDraft())
      setEditingSurgeryIndex(-1)
      setDischargeRxItems(medicationRowsToRxItems(existing.medication_rows))
    } catch {
      // Non-blocking: discharge flow can still continue without draft restore.
    }
  }

  const _computeCommittedSurgeryRows = ({ baseRows, draft, editingIndex }) => {
    const rows = Array.isArray(baseRows) ? [...baseRows] : []
    const procedure = String(draft?.procedure_name || '').trim()
    if (!procedure) return rows
    const row = {
      surgery_date: draft?.surgery_date || '',
      procedure_name: procedure,
      surgeon_name: String(draft?.surgeon_name || '').trim(),
      assistant_name: String(draft?.assistant_name || '').trim(),
      anaesthetist_name: String(draft?.anaesthetist_name || '').trim(),
      anaesthesia_type: String(draft?.anaesthesia_type || '').trim(),
      operative_findings: String(draft?.operative_findings || '').trim(),
      intra_op_complications: String(draft?.intra_op_complications || '').trim(),
    }
    if (editingIndex >= 0 && rows[editingIndex]) {
      rows[editingIndex] = row
    } else {
      rows.push(row)
    }
    return rows.filter((r) => String(r?.procedure_name || '').trim())
  }

  async function saveSummaryDraft(options = {}) {
    const admId = journey?.admission?.id || admission?.id
    if (!admId) return true
    const commitSurgeryDraft = options?.commitSurgeryDraft === true
    const clearSurgeryDraftAfter = options?.clearSurgeryDraftAfter === true

    const committedSurgeryRows = commitSurgeryDraft
      ? _computeCommittedSurgeryRows({
          baseRows: summary.surgery_rows,
          draft: surgeryDraft,
          editingIndex: editingSurgeryIndex,
        })
      : (summary.surgery_rows || [])

    setDraftSaving(true)
    try {
      const payload = {
        admission: admId,
        ...summary,
        surgery_rows: committedSurgeryRows,
        medication_rows: rxItemsToMedicationRows(dischargeRxItems, DEFAULT_DOSAGE_PATTERNS, DEFAULT_TIMING_OPTIONS),
      }
      await api.post('/summaries/', payload)

      if (commitSurgeryDraft) {
        setSummary((s) => ({
          ...s,
          surgery_rows: committedSurgeryRows,
          procedure_surgery: committedSurgeryRows[0]?.procedure_name || '',
          surgery_date: committedSurgeryRows[0]?.surgery_date || '',
          surgeon_name: committedSurgeryRows[0]?.surgeon_name || '',
          assistant_name: committedSurgeryRows[0]?.assistant_name || '',
          anaesthetist_name: committedSurgeryRows[0]?.anaesthetist_name || '',
          anaesthesia_type: committedSurgeryRows[0]?.anaesthesia_type || '',
          operative_findings: committedSurgeryRows[0]?.operative_findings || '',
          intra_op_complications: committedSurgeryRows[0]?.intra_op_complications || '',
        }))
        if (clearSurgeryDraftAfter) {
          setSurgeryDraft(emptySurgeryDraft())
          setEditingSurgeryIndex(-1)
        }
      }
      return true
    } catch {
      toast.error('Failed to save discharge summary draft')
      return false
    } finally {
      setDraftSaving(false)
    }
  }

  useEffect(() => {
    function persistOnUnload() {
      if (journey?.step === 'form' || journey?.step === 'billing') {
        // Best-effort autosave before tab/window close.
        try {
          const committed = _computeCommittedSurgeryRows({
            baseRows: summary.surgery_rows,
            draft: surgeryDraft,
            editingIndex: editingSurgeryIndex,
          })
          const payload = JSON.stringify({
            admission: journey?.admission?.id || admission?.id,
            ...summary,
            surgery_rows: committed,
            medication_rows: rxItemsToMedicationRows(dischargeRxItems, DEFAULT_DOSAGE_PATTERNS, DEFAULT_TIMING_OPTIONS),
          })
          if (navigator?.sendBeacon) {
            navigator.sendBeacon('/api/v1/summaries/', new Blob([payload], { type: 'application/json' }))
          }
        } catch {
          // ignore unload failures
        }
      }
    }
    window.addEventListener('beforeunload', persistOnUnload)
    return () => window.removeEventListener('beforeunload', persistOnUnload)
  }, [journey, admission?.id, dischargeRxItems, summary, surgeryDraft, editingSurgeryIndex])

  function openDischargeEditorForDischarged() {
    setDischargeHydrated(false)
    setJourney({ admission, step: 'form' })
    setDischargeRxItems([])
    loadDischargeDraft(admission.id).finally(() => setDischargeHydrated(true))
  }

  useEffect(() => {
    if (!autoOpenDischargeEdit || loading || !ledger) return
    if (String(admission?.status || '').toLowerCase() !== 'discharged') return
    if (autoOpenedDischargeEditRef.current) return
    autoOpenedDischargeEditRef.current = true
    setDischargeHydrated(false)
    setJourney({ admission, step: 'form' })
    setDischargeRxItems([])
    loadDischargeDraft(admission.id).finally(() => setDischargeHydrated(true))
  }, [autoOpenDischargeEdit, loading, ledger, admission?.id, admission?.status])

  async function goToBilling() {
    if (String(journey?.admission?.status || '').toLowerCase() === 'discharged') return
    setSubmitting(true)
    try {
      const saved = await saveSummaryDraft({ commitSurgeryDraft: true, clearSurgeryDraftAfter: true })
      if (!saved) return
      await refreshBillingSummary(journey.admission.id)
      setJourney(j => ({ ...j, step: 'billing' }))
    } catch { toast.error('Failed to fetch billing summary') }
    finally { setSubmitting(false) }
  }

  async function handleExitDischargeJourney() {
    await saveSummaryDraft({ commitSurgeryDraft: true, clearSurgeryDraftAfter: true })
    setJourney(null)
  }

  async function handleLedgerModalClose() {
    if (journey?.step === 'form' || journey?.step === 'billing') {
      await saveSummaryDraft({ commitSurgeryDraft: true, clearSurgeryDraftAfter: true })
    }
    setJourney(null)
    onClose()
  }

  async function saveDischargedSummaryExplicit() {
    const ok = await saveSummaryDraft()
    if (ok) toast.success('Discharge summary saved')
  }

  function buildDischargePreviewRecord() {
    const nowIso = new Date().toISOString()
    return {
      ...summary,
      id: summary?.id || `preview-${Date.now()}`,
      admission: admission?.id,
      patient_name: admission?.patient_name || '',
      patient_uhid: admission?.patient_uhid || '',
      admission_date: admission?.admission_date || '',
      admission_ipd_no: admission?.ipd_no || '',
      created_at: nowIso,
      total_billed: billing?.total_billed ?? summary.total_billed ?? 0,
      total_paid: billing?.total_paid ?? summary.total_paid ?? 0,
      outstanding_balance: billing?.outstanding ?? summary.outstanding_balance ?? 0,
      medication_rows: rxItemsToMedicationRows(dischargeRxItems, DEFAULT_DOSAGE_PATTERNS, DEFAULT_TIMING_OPTIONS),
      investigation_rows: Array.isArray(summary.investigation_rows) ? summary.investigation_rows : [],
    }
  }

  function openDischargePrintPreview() {
    setDischargePreviewData({
      rec: buildDischargePreviewRecord(),
      admission: journey?.admission || admission,
    })
  }

  async function refreshBillingSummary(admissionId = journey?.admission?.id) {
    if (!admissionId) return
    const { data } = await api.get(`/summaries/billing-summary/?admission_id=${admissionId}`)
    setBilling(data)
  }

  async function handleDueSettlement() {
    const outstanding = Number(billing?.outstanding || 0)
    if (outstanding <= 0) {
      toast.success('No pending due to settle')
      return
    }
    setSettleSubmitting(true)
    try {
      const { data } = await api.post(`/ipd-admissions/${admission.id}/capture-advance/`, {
        amount: outstanding,
        payment_mode: settleMode,
        reference: settleRef
      })
      toast.success('Due settled successfully')
      await refreshBillingSummary(admission.id)
      fetchLedger()
      if (settlePrint) {
        setReceipt({
          type: 'advance',
          data: {
            amount: outstanding,
            mode: settleMode,
            invoice_no: data.invoice_no,
            slip_number: data?.payment?.slip_number || '',
            description: 'Final Settlement Payment',
            paid_at: data?.payment?.paid_at || data?.payment?.created_at || undefined,
          },
        })
      }
      setSettleRef('')
    } catch {
      toast.error('Failed to settle due')
    } finally {
      setSettleSubmitting(false)
    }
  }

  async function finalizeDischarge() {
    if (!billing) {
      toast.error('Billing details are not ready')
      return
    }
    if (Number(billing.outstanding || 0) > 0) {
      toast.error('Please clear pending due before discharge finalization.')
      return
    }
    setSubmitting(true)
    try {
      const saved = await saveSummaryDraft()
      if (!saved) return
      const payload = {
        admission: journey.admission.id,
        ...summary,
        total_billed: billing.total_billed,
        total_paid: billing.total_paid,
        outstanding_balance: billing.outstanding,
        medication_rows: rxItemsToMedicationRows(dischargeRxItems, DEFAULT_DOSAGE_PATTERNS, DEFAULT_TIMING_OPTIONS),
      }
      await api.post('/summaries/', payload)
      toast.success('Discharge finalized successfully!')
      setJourney(null)
      onClose()
      window.dispatchEvent(new Event('refresh-admissions'))
    } catch { toast.error('Failed to finalize discharge') }
    finally { setSubmitting(false) }
  }

  const updateBilling = (key, val) => {
    setBilling(prev => {
      const next = { ...prev, [key]: Number(val) || 0 }
      next.total_billed = next.total_services + next.room_total
      next.outstanding = next.total_billed - next.total_paid
      return next
    })
  }

  async function handleAdvance(e) {
    e.preventDefault()
    if (!advAmount) return
    setSubmitting(true)
    try {
      const { data } = await api.post(`/ipd-admissions/${admission.id}/capture-advance/`, {
        amount: advAmount, payment_mode: advMode, reference: advRef
      })
      toast.success('Payment captured')
      fetchLedger()
      if (advPrint) {
        setReceipt({
          type: 'advance',
          data: {
            amount: advAmount,
            mode: advMode,
            invoice_no: data.invoice_no,
            slip_number: data?.payment?.slip_number || '',
            description: 'Advance Payment',
            paid_at: data?.payment?.paid_at || data?.payment?.created_at || undefined,
          }
        })
      }
      setAdvAmount(''); setAdvRef('')
    } catch { toast.error('Failed to save payment') }
    finally { setSubmitting(false) }
  }

  const chgLineTotal = (() => {
    const q = parseFloat(chgQty || 0)
    const u = parseFloat(chgUnitPrice || 0)
    if (!isFinite(q) || !isFinite(u)) return 0
    return q * u
  })()

  async function handleCharge(e) {
    e.preventDefault()
    const total = chgLineTotal
    if (!chgDesc.trim() || !total || total <= 0) {
      toast.error('Description, qty and price are required')
      return
    }
    const paymentMode = chgStatus === 'paid' ? chgPaidMode : 'credit'
    setSubmitting(true)
    try {
      const { data } = await api.post(`/ipd-admissions/${admission.id}/add-charge/`, {
        description: chgDesc,
        amount: total,
        quantity: parseFloat(chgQty || 0),
        unit_price: parseFloat(chgUnitPrice || 0),
        payment_mode: paymentMode,
      })
      toast.success(chgStatus === 'paid' ? 'Charge saved & paid' : 'Charge added to bill')
      fetchLedger()
      if (chgPrint) {
        setReceipt({
          type: 'charge',
          data: {
            amount: total,
            mode: paymentMode,
            invoice_no: data.invoice_no,
            slip_number: data?.payment?.slip_number || '',
            description: chgDesc,
            paid_at: data?.payment?.paid_at || data?.payment?.created_at || undefined,
          },
        })
      }
      setChgDesc(''); setChgQty('1'); setChgUnitPrice(''); setChgStatus('due'); setChgPaidMode('cash'); setSelectedExistingCharge(''); setIsServiceMenuOpen(false); setHighlightedServiceIndex(-1)
    } catch { toast.error('Failed to add charge') }
    finally { setSubmitting(false) }
  }

  async function handleDiscount(e) {
    e.preventDefault()
    const amt = parseFloat(discAmount || 0)
    if (!discReason.trim() || !amt || amt <= 0) {
      toast.error('Reason and discount amount are required')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/ipd-admissions/${admission.id}/add-charge/`, {
        description: discReason, amount: -Math.abs(amt), payment_mode: 'credit',
      })
      toast.success('Discount applied')
      fetchLedger()
      setDiscReason(''); setDiscAmount('')
    } catch { toast.error('Failed to apply discount') }
    finally { setSubmitting(false) }
  }

  function applyRoomRentDiscount() {
    setMode('discount')
    setDiscReason('Room Rent Discount')
    setDiscAmount('')
    setTimeout(() => document.getElementById('disc-amount-input')?.focus(), 80)
  }

  function toggleChargeRowExpand(rowId) {
    setExpandedChargeRows(prev => ({ ...prev, [rowId]: !prev[rowId] }))
  }

  const serviceOptions = useMemo(
    () =>
      (ledger?.grouped_charges || [])
        .filter((g) => (g?.description || "").trim())
        .filter((g) => !String(g.description || "").includes("(Cancelled)"))
        .map((g) => ({
          id: g.id,
          description: String(g.description || "").trim(),
          quantity: parseInt(g.quantity || 0, 10) || 0,
          events: g.events || [],
        })),
    [ledger?.grouped_charges]
  )

  const filteredServiceOptions = useMemo(() => {
    const q = String(chgDesc || "").trim().toLowerCase()
    if (!q) return serviceOptions
    return serviceOptions.filter((opt) => opt.description.toLowerCase().includes(q))
  }, [serviceOptions, chgDesc])

  function getLatestUnitPrice(events) {
    const lastEvent = [...(events || [])].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    const lineTotal = Math.abs(parseFloat(lastEvent?.price) || 0)
    const qty = Math.abs(parseFloat(lastEvent?.quantity) || 0)
    if (!lineTotal) return 0
    if (qty > 0) return lineTotal / qty
    return lineTotal
  }

  function handleSelectExistingCharge(value) {
    setSelectedExistingCharge(value)
    if (!value) {
      setHighlightedServiceIndex(-1)
      return
    }
    const selected = (ledger?.grouped_charges || []).find(g => g.id === value)
    if (!selected) return
    // Only fill description; user can add new qty / unit price for the new entry.
    setChgDesc(selected.description || '')
    const last = getLatestUnitPrice(selected.events || [])
    if (last) setChgUnitPrice(String(last))
    setIsServiceMenuOpen(false)
    setHighlightedServiceIndex(-1)
  }

  const inp = 'w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-gray-50 hover:bg-white transition-colors'

  useEffect(() => {
    function handleOutsideClick(e) {
      if (!serviceComboboxRef.current) return
      if (!serviceComboboxRef.current.contains(e.target)) {
        setIsServiceMenuOpen(false)
        setHighlightedServiceIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])


  if (receipt) {
    return (
      <PrintMiniReceipt
        admission={admission}
        data={receipt.data}
        type={receipt.type}
        viewOnly={!!receipt.viewOnly}
        onClose={() => setReceipt(null)}
      />
    )
  }
  if (dischargePreviewData) {
    return (
      <PrintDischargeSummary
        rec={dischargePreviewData.rec}
        admission={dischargePreviewData.admission}
        onClose={() => setDischargePreviewData(null)}
      />
    )
  }
  if (showPrint && ledger) return <PrintIpdLedger admission={admission} ledger={ledger} onClose={() => setShowPrint(false)} />

  if (journey) {
    const isStep1 = journey.step === 'form'
    const dischargedEditing = String(journey.admission?.status || '').toLowerCase() === 'discharged'

    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-md transition-opacity">
        <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] border border-white/20 transform transition-all duration-300">
          
          {/* Header */}
          <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 py-2.5 text-white overflow-hidden shrink-0">
            {/* Background patterns */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-10 mix-blend-overlay animate-pulse"></div>
            <div className="absolute bottom-0 right-32 -mb-20 w-48 h-48 rounded-full bg-white opacity-10 mix-blend-overlay"></div>
            
            <div className="relative flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30">
                  <Activity size={18} className="text-white" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-black text-lg tracking-tight leading-none drop-shadow-sm flex items-center gap-2 flex-wrap">
                    {dischargedEditing ? 'Edit discharge summary' : 'Discharge Process'}
                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ml-2">IPD: {journey.admission.ipd_no || 'N/A'}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ml-2">UHID: {journey.admission.patient_uhid || 'N/A'}</span>
                  </h3>
                  <p className="text-emerald-50 mt-0.5 text-xs font-medium opacity-90 drop-shadow-sm">
                    {journey.admission.patient_name}
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleExitDischargeJourney} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/30 transition-all active:scale-95 text-emerald-50 hover:text-white backdrop-blur-md border border-white/10">
                <XCircle size={20} strokeWidth={2} />
              </button>
            </div>
            
            {/* Modern Stepper */}
            {!dischargedEditing ? (
              <div className="mt-2 relative z-10 flex items-center justify-center max-w-md mx-auto">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-white/20 rounded-full -translate-y-1/2"></div>
                <div className={`absolute top-1/2 left-0 h-1 bg-white rounded-full -translate-y-1/2 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,255,255,0.7)] ${isStep1 ? 'w-[15%]' : 'w-full'}`}></div>
                
                <div className="w-full flex justify-between relative">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-500 bg-white text-emerald-600 shadow-lg ring-4 ring-emerald-600/30`}>
                      1
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest text-white drop-shadow-sm transition-all duration-300`}>Clinical Summary</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-500 delay-100 ${!isStep1 ? 'bg-white text-emerald-600 shadow-lg ring-4 ring-emerald-600/30' : 'bg-emerald-700/50 text-emerald-200 border border-emerald-400/50 backdrop-blur-sm'}`}>
                      2
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${!isStep1 ? 'text-white drop-shadow-sm' : 'text-emerald-200 opacity-70'}`}>Billing Review</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 relative z-10 text-center text-xs font-semibold text-emerald-50/95 max-w-xl mx-auto">
                Changes auto-save while you edit. Use Save summary for confirmation, or close to keep the latest draft on the server.
              </p>
            )}
          </div>

          <div className="flex flex-1 min-h-0 bg-slate-50">
            {isStep1 && (
              <aside className="shrink-0 w-12 sm:w-[52px] flex flex-col items-center gap-1.5 py-3 sm:py-4 px-0.5 sm:px-1 border-r border-slate-200/80 bg-gradient-to-b from-white via-slate-50/95 to-slate-100/90 shadow-[inset_-1px_0_0_rgba(15,23,42,0.05)] overflow-y-auto max-h-full">
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1 select-none text-center leading-tight px-0.5">Jump</span>
                {dischargeSectionNavItems.map(({ id, Icon, label }, idx) => (
                  <React.Fragment key={id}>
                    {idx > 0 && <div className="w-px h-1.5 sm:h-2 bg-gradient-to-b from-transparent via-slate-300/80 to-transparent" aria-hidden />}
                    <button
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-current={activeDischargeSection === id ? 'step' : undefined}
                      onClick={() => {
                        const scrollRoot = dischargeScrollRootRef.current
                        const el = scrollRoot?.querySelector(`#${CSS.escape(id)}`)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-50 ${
                        activeDischargeSection === id
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/35 scale-110 ring-2 ring-emerald-200 ring-offset-2 ring-offset-slate-50'
                          : 'bg-white text-slate-500 shadow-sm border border-slate-200/90 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md hover:-translate-y-px active:scale-95'
                      }`}
                    >
                      <Icon size={activeDischargeSection === id ? 17 : 16} strokeWidth={activeDischargeSection === id ? 2.25 : 2} className="transition-transform duration-300" />
                      {activeDischargeSection === id && (
                        <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-white/40 animate-pulse" aria-hidden />
                      )}
                    </button>
                  </React.Fragment>
                ))}
              </aside>
            )}
            <div ref={dischargeScrollRootRef} className="flex-1 overflow-y-auto min-h-0 scroll-smooth px-5 sm:px-7 py-4 sm:py-5 custom-scrollbar scroll-pt-3">
            {isStep1 ? (
              <div className="space-y-4 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">Clinical Documentation</h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Use sections below; structured meds & labs print as tables.</p>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                    Ward: {journey.admission.ward_name || 'N/A'} | Bed: {journey.admission.bed_code || 'N/A'} | Dept: {journey.admission.department || '—'}
                  </div>
                </div>

                <details id="discharge-section-metadata" open className="scroll-mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200/80">Discharge metadata & identifiers</summary>
                  <div className="px-4 sm:px-5 py-4 space-y-4 bg-slate-50/70 border-t border-slate-200">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
                      <div><span className={dsLbl}>Discharge type</span>
                        <select value={summary.discharge_type} onChange={e => setSummary(s => ({ ...s, discharge_type: e.target.value }))} className={dsInp}>
                          {[{ v: 'routine', l: 'Routine' }, { v: 'lama', l: 'LAMA' }, { v: 'dama', l: 'DAMA' }, { v: 'referred', l: 'Referred' }, { v: 'transferred', l: 'Transferred' }, { v: 'death', l: 'Death' }, { v: 'absconded', l: 'Absconded' }].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select></div>
                      <div><span className={dsLbl}>Condition / status</span>
                        <select value={summary.discharge_status} onChange={e => setSummary(s => ({ ...s, discharge_status: e.target.value }))} className={dsInp}>
                          {[{ v: 'cured', l: 'Cured' }, { v: 'improved', l: 'Improved' }, { v: 'unchanged', l: 'Unchanged' }, { v: 'worsened', l: 'Worsened' }, { v: 'deceased', l: 'Deceased' }].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select></div>
                      <div><span className={dsLbl}>Mode of admission</span>
                        <select value={summary.mode_of_admission} onChange={e => setSummary(s => ({ ...s, mode_of_admission: e.target.value }))} className={dsInp}>
                          <option value="emergency">Emergency</option><option value="opd">OPD</option><option value="referral">Referral</option>
                        </select></div>
                      <div><span className={dsLbl}>Condition at discharge (text)</span>
                        <input value={summary.condition_at_discharge} onChange={e => setSummary(s => ({ ...s, condition_at_discharge: e.target.value }))} className={dsInp} placeholder="e.g. Stable, afebrile" /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
                      <div><span className={dsLbl}>Discharge date</span><input type="date" value={summary.discharge_date || ''} onChange={e => setSummary(s => ({ ...s, discharge_date: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Discharge time</span><input type="time" value={summary.discharge_time || ''} onChange={e => setSummary(s => ({ ...s, discharge_time: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Next follow-up</span><input type="date" value={summary.next_follow_up_date || ''} onChange={e => setSummary(s => ({ ...s, next_follow_up_date: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Stitch removal</span><input type="date" value={summary.stitch_removal_date || ''} onChange={e => setSummary(s => ({ ...s, stitch_removal_date: e.target.value }))} className={dsInp} /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
                      <div><span className={dsLbl}>Treating consultant</span><input value={summary.treating_consultant} onChange={e => setSummary(s => ({ ...s, treating_consultant: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Consultant reg. no.</span><input value={summary.consultant_registration_no} onChange={e => setSummary(s => ({ ...s, consultant_registration_no: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>RMO / Signatory name</span><input value={summary.rmo_signed_by} onChange={e => setSummary(s => ({ ...s, rmo_signed_by: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Follow-up doctor</span><input value={summary.follow_up_doctor} onChange={e => setSummary(s => ({ ...s, follow_up_doctor: e.target.value }))} className={dsInp} placeholder="Doctor name" /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
                      <div><span className={dsLbl}>Follow-up department</span><input value={summary.follow_up_department} onChange={e => setSummary(s => ({ ...s, follow_up_department: e.target.value }))} className={dsInp} placeholder="Department" /></div>
                      <div><span className={dsLbl}>Referred to facility</span><input value={summary.referred_to_facility} onChange={e => setSummary(s => ({ ...s, referred_to_facility: e.target.value }))} className={dsInp} /></div>
                      <div className="sm:col-span-2 lg:col-span-2"><span className={dsLbl}>Referral reason</span><input value={summary.referral_reason} onChange={e => setSummary(s => ({ ...s, referral_reason: e.target.value }))} className={dsInp} /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 [&>*]:min-w-0">
                      <div className="sm:col-span-2"><span className={dsLbl}>ABHA ID</span><input value={summary.abha_id} onChange={e => setSummary(s => ({ ...s, abha_id: e.target.value }))} className={dsInp} /></div>
                      <div className="sm:col-span-2"><span className={dsLbl}>Insurance provider</span><input value={summary.insurance_provider} onChange={e => setSummary(s => ({ ...s, insurance_provider: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>TPA</span><input value={summary.tpa_name} onChange={e => setSummary(s => ({ ...s, tpa_name: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Policy no.</span><input value={summary.policy_number} onChange={e => setSummary(s => ({ ...s, policy_number: e.target.value }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Claim no.</span><input value={summary.claim_number} onChange={e => setSummary(s => ({ ...s, claim_number: e.target.value }))} className={dsInp} /></div>
                      <div className="flex items-center gap-2.5 pt-5">
                        <input type="checkbox" id="patient_edu" checked={summary.patient_education_given} onChange={e => setSummary(s => ({ ...s, patient_education_given: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                        <label htmlFor="patient_edu" className="text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer select-none">Patient education given</label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
                      <div className="col-span-2 sm:col-span-2"><span className={dsLbl}>Attendant counselled by</span><input value={summary.attendant_counselled_by} onChange={e => setSummary(s => ({ ...s, attendant_counselled_by: e.target.value }))} className={dsInp} /></div>
                    </div>
                  </div>
                </details>

                <details id="discharge-section-vitals" open className="scroll-mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200/80">Vitals at discharge</summary>
                  <div className="px-4 sm:px-5 py-4 grid grid-cols-3 sm:grid-cols-6 gap-4 bg-slate-50/70 border-t border-slate-200">
                    {['bp', 'pulse', 'spo2', 'temp', 'weight', 'rbs'].map(k => (
                      <div key={k}><span className={dsLbl}>{k === 'bp' ? 'BP' : k.toUpperCase()}</span>
                        <input value={(summary.vitals_at_discharge || {})[k] || ''} onChange={e => setVital(k, e.target.value)} className={dsInp} /></div>
                    ))}
                  </div>
                </details>

                {summary.discharge_type === 'death' && (
                  <details id="discharge-section-death" open className="scroll-mt-3 bg-red-50 rounded-xl border border-red-200 overflow-hidden shadow-sm">
                    <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-red-800 bg-red-100">Death summary</summary>
                    <div className="px-5 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-red-50/60 border-t border-red-200">
                      <div className="sm:col-span-2"><span className={dsLbl}>Cause of death</span><textarea rows={2} value={summary.cause_of_death} onChange={e => setSummary(s => ({ ...s, cause_of_death: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Time of death</span><input type="datetime-local" value={summary.time_of_death ? summary.time_of_death.slice(0, 16) : ''} onChange={e => setSummary(s => ({ ...s, time_of_death: e.target.value ? `${e.target.value}:00` : '' }))} className={dsInp} /></div>
                      <div><span className={dsLbl}>Notified to</span><input value={summary.notified_to} onChange={e => setSummary(s => ({ ...s, notified_to: e.target.value }))} className={dsInp} /></div>
                      <label className="flex items-center gap-2 text-sm text-slate-800 pt-5"><input type="checkbox" checked={summary.autopsy_required} onChange={e => setSummary(s => ({ ...s, autopsy_required: e.target.checked }))} /> Autopsy required</label>
                    </div>
                  </details>
                )}

                <details id="discharge-section-narrative" open className="scroll-mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200/80">Clinical narrative</summary>
                  <div className="px-5 sm:px-6 py-5 space-y-5 bg-slate-50/70 border-t border-slate-200">
                    <div><span className={dsLbl}>Discharge summary / overview</span><textarea rows={2} value={summary.summary_notes} onChange={e => setSummary(s => ({ ...s, summary_notes: e.target.value }))} className={`${dsInp} min-h-[52px]`} placeholder="Brief overview..." /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><span className={dsLbl}>Chief complaints</span><textarea rows={2} value={summary.chief_complaints} onChange={e => setSummary(s => ({ ...s, chief_complaints: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Reason for admission</span><textarea rows={2} value={summary.reason_for_admission} onChange={e => setSummary(s => ({ ...s, reason_for_admission: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Diagnosis</span><textarea rows={2} value={summary.diagnosis} onChange={e => setSummary(s => ({ ...s, diagnosis: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Co-morbidities</span><textarea rows={2} value={summary.co_morbidities} onChange={e => setSummary(s => ({ ...s, co_morbidities: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Medical history</span><textarea rows={2} value={summary.medical_history} onChange={e => setSummary(s => ({ ...s, medical_history: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Family history</span><textarea rows={2} value={summary.family_history} onChange={e => setSummary(s => ({ ...s, family_history: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Personal history</span><textarea rows={2} value={summary.personal_history} onChange={e => setSummary(s => ({ ...s, personal_history: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Physical examination</span><textarea rows={2} value={summary.physical_examination} onChange={e => setSummary(s => ({ ...s, physical_examination: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Allergies</span><textarea rows={2} value={summary.allergies} onChange={e => setSummary(s => ({ ...s, allergies: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                      <div><span className={dsLbl}>Treatment given</span><textarea rows={2} value={summary.treatment_given} onChange={e => setSummary(s => ({ ...s, treatment_given: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    </div>
                  </div>
                </details>

                <details id="discharge-section-operative" className="scroll-mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200/80">Operative / procedure</summary>
                  <div className="px-5 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 border-t border-slate-200">
                    <div><span className={dsLbl}>Surgery date</span><input type="date" value={surgeryDraft.surgery_date || ''} onChange={e => updateSurgeryDraftField('surgery_date', e.target.value)} className={dsInp} /></div>
                    <div><span className={dsLbl}>Procedure (short)</span><textarea rows={2} value={surgeryDraft.procedure_name} onChange={e => updateSurgeryDraftField('procedure_name', e.target.value)} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Surgeon</span><input value={surgeryDraft.surgeon_name} onChange={e => updateSurgeryDraftField('surgeon_name', e.target.value)} className={dsInp} /></div>
                    <div><span className={dsLbl}>Assistant</span><input value={surgeryDraft.assistant_name} onChange={e => updateSurgeryDraftField('assistant_name', e.target.value)} className={dsInp} /></div>
                    <div><span className={dsLbl}>Anaesthetist</span><input value={surgeryDraft.anaesthetist_name} onChange={e => updateSurgeryDraftField('anaesthetist_name', e.target.value)} className={dsInp} /></div>
                    <div><span className={dsLbl}>Anaesthesia</span><input value={surgeryDraft.anaesthesia_type} onChange={e => updateSurgeryDraftField('anaesthesia_type', e.target.value)} className={dsInp} /></div>
                    <div className="md:col-span-2"><span className={dsLbl}>Operative findings</span><textarea rows={2} value={surgeryDraft.operative_findings} onChange={e => updateSurgeryDraftField('operative_findings', e.target.value)} className={`${dsInp} min-h-[52px]`} /></div>
                    <div className="md:col-span-2"><span className={dsLbl}>Intra-op complications</span><textarea rows={2} value={surgeryDraft.intra_op_complications} onChange={e => updateSurgeryDraftField('intra_op_complications', e.target.value)} className={`${dsInp} min-h-[52px]`} /></div>
                    <div className="md:col-span-2 flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={saveSurgeryRow}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                      >
                        {editingSurgeryIndex >= 0 ? 'Update Surgery' : 'Save Surgery'}
                      </button>
                      {editingSurgeryIndex >= 0 && (
                        <button
                          type="button"
                          onClick={resetSurgeryDraft}
                          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <span className={dsLbl}>Saved surgeries</span>
                      <div className="rounded-lg border border-slate-200 overflow-x-auto bg-white">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left">
                              <th className="p-2">Date</th>
                              <th className="p-2">Procedure</th>
                              <th className="p-2">Surgeon</th>
                              <th className="p-2">Anaesthesia</th>
                              <th className="p-2 w-24">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(summary.surgery_rows || []).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-3 text-slate-400">No surgery rows saved yet.</td>
                              </tr>
                            ) : (
                              (summary.surgery_rows || []).map((row, idx) => (
                                <tr key={`surgery-row-${idx}`} className="border-t border-slate-100">
                                  <td className="p-2">{row.surgery_date || '—'}</td>
                                  <td className="p-2">{row.procedure_name || row.procedure_surgery || '—'}</td>
                                  <td className="p-2">{row.surgeon_name || '—'}</td>
                                  <td className="p-2">{row.anaesthesia_type || '—'}</td>
                                  <td className="p-2">
                                    <div className="flex items-center gap-2">
                                      <button type="button" onClick={() => editSurgeryRow(idx)} className="text-blue-600 font-bold">Edit</button>
                                      <button type="button" onClick={() => removeSurgeryRow(idx)} className="text-red-600 font-bold">Delete</button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </details>

                <details id="discharge-section-investigations" open className="scroll-mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200/80">Investigations (structured)</summary>
                  <div className="px-5 sm:px-6 py-5 bg-slate-50/70 border-t border-slate-200 space-y-3">
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-50 text-left"><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2">Test</th><th className="px-2.5 py-2">Value</th><th className="px-2.5 py-2">Ref</th><th className="px-2.5 py-2">Date</th><th className="px-2 py-2 w-8" /></tr></thead>
                        <tbody>
                          {(summary.investigation_rows || []).map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-100">
                              <td className="px-2.5 py-1.5"><select value={row.category || 'lab'} onChange={e => updateInvRow(idx, 'category', e.target.value)} className={dsInp}><option value="lab">Lab</option><option value="imaging">Imaging</option></select></td>
                              <td className="px-2.5 py-1.5"><input value={row.test_name} onChange={e => updateInvRow(idx, 'test_name', e.target.value)} className={dsInp} placeholder="Test name" /></td>
                              <td className="px-2.5 py-1.5"><input value={row.value} onChange={e => updateInvRow(idx, 'value', e.target.value)} className={dsInp} /></td>
                              <td className="px-2.5 py-1.5"><input value={row.reference_range} onChange={e => updateInvRow(idx, 'reference_range', e.target.value)} className={dsInp} /></td>
                              <td className="px-2.5 py-1.5"><input type="date" value={row.test_date || ''} onChange={e => updateInvRow(idx, 'test_date', e.target.value)} className={dsInp} /></td>
                              <td className="px-2 py-1.5"><button type="button" onClick={() => removeInvRow(idx)} className="text-red-600 font-bold px-1">×</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button type="button" onClick={addInvRow} className="text-xs font-bold text-emerald-700 hover:underline">+ Add investigation row</button>
                    <div><span className={dsLbl}>Investigations — free text (extra notes)</span><textarea rows={2} value={summary.investigations} onChange={e => setSummary(s => ({ ...s, investigations: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                  </div>
                </details>

                <details id="discharge-section-course" open className="scroll-mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200/80">Hospital course & complications</summary>
                  <div className="px-5 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 border-t border-slate-200">
                    <div className="md:col-span-2"><span className={dsLbl}>Course in hospital</span><textarea rows={2} value={summary.course_in_hospital} onChange={e => setSummary(s => ({ ...s, course_in_hospital: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Complications</span><textarea rows={2} value={summary.complications_during_stay} onChange={e => setSummary(s => ({ ...s, complications_during_stay: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Blood transfusion</span><textarea rows={2} value={summary.blood_transfusion_details} onChange={e => setSummary(s => ({ ...s, blood_transfusion_details: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Implants</span><textarea rows={2} value={summary.implants_used} onChange={e => setSummary(s => ({ ...s, implants_used: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Indwelling devices</span><textarea rows={2} value={summary.indwelling_devices_on_discharge} onChange={e => setSummary(s => ({ ...s, indwelling_devices_on_discharge: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Vaccination</span><textarea rows={2} value={summary.vaccination_given} onChange={e => setSummary(s => ({ ...s, vaccination_given: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                  </div>
                </details>

                <div id="discharge-section-prescriptions" className="scroll-mt-3 space-y-2">
                  <DischargePrescriptionPanel
                    items={dischargeRxItems}
                    onChange={setDischargeRxItems}
                    dosagePatternOptions={DEFAULT_DOSAGE_PATTERNS}
                    timingOptions={DEFAULT_TIMING_OPTIONS}
                  />
                  <details className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-50 hover:bg-slate-100">Extra medication notes (optional)</summary>
                    <div className="px-5 sm:px-6 py-5 bg-slate-50/70 border-t border-slate-200">
                      <textarea rows={2} value={summary.medications_on_discharge} onChange={e => setSummary(s => ({ ...s, medications_on_discharge: e.target.value }))} className={`${dsInp} min-h-[52px] font-mono w-full`} placeholder="Additional instructions not covered above..." />
                    </div>
                  </details>
                </div>

                <details id="discharge-section-advice" open className="scroll-mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200/80">Advice on discharge</summary>
                  <div className="px-5 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 border-t border-slate-200">
                    <div><span className={dsLbl}>Diet</span><textarea rows={2} value={summary.diet_advice} onChange={e => setSummary(s => ({ ...s, diet_advice: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Activity</span><textarea rows={2} value={summary.activity_advice} onChange={e => setSummary(s => ({ ...s, activity_advice: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Wound care</span><textarea rows={2} value={summary.wound_care_instructions} onChange={e => setSummary(s => ({ ...s, wound_care_instructions: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div><span className={dsLbl}>Follow-up advice</span><textarea rows={2} value={summary.follow_up_advice} onChange={e => setSummary(s => ({ ...s, follow_up_advice: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                    <div className="md:col-span-2"><span className={dsLbl}>Warning signs</span><textarea rows={2} value={summary.warning_signs} onChange={e => setSummary(s => ({ ...s, warning_signs: e.target.value }))} className={`${dsInp} min-h-[52px]`} /></div>
                  </div>
                </details>

                <div className="pt-3 mt-1 border-t border-slate-200/60 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={openDischargePrintPreview}
                    className="bg-white text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-95 focus:ring-4 focus:ring-slate-200"
                  >
                    <Eye size={16} /> Preview print
                  </button>
                  {dischargedEditing ? (
                    <button type="button" onClick={saveDischargedSummaryExplicit} disabled={submitting || draftSaving}
                      className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-800 flex items-center gap-2 transition-all active:scale-95 focus:ring-4 focus:ring-emerald-300 disabled:opacity-60">
                      {draftSaving ? 'Saving...' : 'Save summary'}
                    </button>
                  ) : (
                    <button type="button" onClick={goToBilling} disabled={submitting}
                      className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-black hover:shadow-lg hover:shadow-black/20 flex items-center gap-2 transition-all active:scale-95 group focus:ring-4 focus:ring-slate-300">
                      {draftSaving ? 'Saving...' : 'Review Billing Summary'} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500 py-1">
                <div className="flex bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 items-start gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Receipt size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">Financial Review & Adjustments</h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                      You can manually adjust the amounts below before finalizing. The totals will reflect in the patient's final discharge invoice automatically.
                    </p>
                  </div>
                </div>
                
                {billing && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-white rounded-2xl p-5 border shadow-sm border-slate-200 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-all hover:-translate-y-0.5 group">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 group-focus-within:text-emerald-600 transition-colors">Service Invoices (Surgery, etc.)</p>
                         <div className="flex items-center gap-2">
                           <span className="text-slate-300 font-bold text-2xl group-focus-within:text-emerald-500 transition-colors">₹</span>
                           <input type="number" value={billing.total_services} onChange={e => updateBilling('total_services', e.target.value)}
                             className="text-3xl font-black text-slate-800 outline-none w-full bg-transparent" />
                         </div>
                      </div>
                      <div className="bg-white rounded-2xl p-5 border shadow-sm border-slate-200 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-all hover:-translate-y-0.5 group">
                         <p className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 group-focus-within:text-emerald-600 transition-colors">
                           Room Charges
                           <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-md tracking-normal text-xs">{billing.stay_days} Days</span>
                         </p>
                         <div className="flex items-center gap-2">
                           <span className="text-slate-300 font-bold text-2xl group-focus-within:text-emerald-500 transition-colors">₹</span>
                           <input type="number" value={billing.room_total} onChange={e => updateBilling('room_total', e.target.value)}
                             className="text-3xl font-black text-slate-800 outline-none w-full bg-transparent" />
                         </div>
                      </div>
                    </div>

                    <div className="bg-slate-800 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-800/20 border border-slate-700/50">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full translate-x-1/3 -translate-y-1/3 blur-2xl"></div>
                       
                       <div className="relative z-10 flex justify-between items-center mb-5">
                          <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">Gross Billed Amount</span>
                          <span className="text-2xl font-black text-slate-100">₹{Number(billing.total_billed).toLocaleString()}</span>
                       </div>
                       <div className="relative z-10 flex justify-between items-center mb-6 pb-6 border-b border-slate-700/80">
                          <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">Recorded Payments & Advances</span>
                          <span className="text-2xl font-black text-emerald-400">₹{Number(billing.total_paid).toLocaleString()}</span>
                       </div>
                       <div className="relative z-10 flex justify-between items-end">
                          <div>
                             <p className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-1.5 drop-shadow-sm">Final Settlement Due</p>
                             <div className="flex items-start gap-1">
                               <span className="text-2xl font-bold mt-1 opacity-70">₹</span>
                               <span className="text-[3.5rem] leading-none tracking-tighter font-black text-white">{Number(billing.outstanding).toLocaleString()}</span>
                             </div>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Room: {journey.admission.room_name || 'N/A'}</span>
                          </div>
                       </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm">
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <p className="text-sm font-black text-slate-800 tracking-tight">Settle Due Now</p>
                          <p className="text-xs text-slate-500 font-medium">Clear the pending amount directly from billing review.</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                          Due: ₹{Number(billing.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select
                          value={settleMode}
                          onChange={e => setSettleMode(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="card">Card</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          value={settleRef}
                          onChange={e => setSettleRef(e.target.value)}
                          placeholder="Reference (optional)"
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
                        />
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                          <input type="checkbox" checked={settlePrint} onChange={e => setSettlePrint(e.target.checked)} />
                          Print slip
                        </label>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleDueSettlement}
                          disabled={settleSubmitting || Number(billing.outstanding || 0) <= 0}
                          className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {settleSubmitting ? 'Settling...' : 'Clear Due & Continue'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200/80 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
                        <AlertTriangle size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-amber-900 tracking-tight">Final Confirmation Notice</p>
                        <p className="text-xs text-amber-800/80 mt-1 font-medium leading-relaxed">Completing this step will permanently finalize the invoice, log the discharge summary, and release bed <strong className="bg-amber-200/50 px-1 py-0.5 rounded">{journey.admission.bed_code}</strong> for cleaning. Ensure all dues are settled or accounted for.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-6 mt-2 border-t border-slate-200/60 flex items-center justify-between gap-6">
                  <button onClick={() => setJourney(j => ({ ...j, step: 'form' }))} className="px-6 py-3.5 rounded-2xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-2 transition-colors active:scale-95">
                    <ArrowRight size={16} className="rotate-180" /> Back to Clinical
                  </button>
                  <button onClick={finalizeDischarge} disabled={submitting}
                    className={`flex-1 py-4 text-white rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 border ${
                      Number(billing?.outstanding || 0) > 0
                        ? 'bg-slate-400 border-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_40px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 active:translate-y-0 group border-emerald-400'
                    }`}>
                    {submitting ? 'Finalizing Discharge...' : (
                      <>
                        Approve & Execute Discharge 
                        <CheckCircle size={22} className="group-hover:scale-110 drop-shadow-md transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[80vw] min-w-0 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight flex items-center gap-2">
                {admission.patient_name || '--'}
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                  IPD ID: {admission.ipd_no || 'N/A'}
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                  UHID: {admission.patient_uhid || 'N/A'}
                </span>
              </h3>
              <p className="text-blue-100 text-xs text-blue-100/90 font-medium">IPD Ledger · {admission.ward_name} · Bed {admission.bed_code} · Adm: {admission.admission_date ? `${format(new Date(admission.admission_date), 'd/M/yyyy')} (${format(new Date(admission.created_at || Date.now()), 'HH:mm')})` : '--'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {String(admission.status || '').toLowerCase() === 'discharged' ? (
              <button type="button" onClick={openDischargeEditorForDischarged} className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-md hover:bg-emerald-700 transition-all border border-emerald-500">
                <Edit2 size={16} /> Edit discharge summary
              </button>
            ) : (
              <button type="button" onClick={handleInitiateDischarge} className="flex items-center gap-2 bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-md hover:bg-red-600 transition-all border border-red-400">
                <LogOut size={16} /> Discharge Patient
              </button>
            )}
            <button type="button" onClick={() => setShowPrint(true)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white rounded-xl px-4 py-2 text-sm font-bold transition-colors">
              <Printer size={16} /> Print A4 Bill
            </button>
            <button type="button" onClick={handleLedgerModalClose} className="text-white/70 hover:text-white transition-colors">
              <XCircle size={24} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-blue-500 animate-spin" />
          </div>
        ) : ledger ? (
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-5 gap-5 bg-gray-50/40">

            {/* ── Left: Account Statement (3 cols) ── */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Summary cards */}
              {(() => {
                const chargesCount = (ledger.grouped_charges || []).length + (ledger.charges || []).filter(c => c.type === 'room_rent').length
                const paidEvents = ledger.payments?.length || 0
                const balance = parseFloat(ledger.balance_due || 0)
                const isDue = balance > 0
                const cards = [
                  {
                    label: 'Total Charges', val: ledger.total_charges, sub: `${chargesCount} item${chargesCount === 1 ? '' : 's'}`,
                    Icon: Receipt, color: 'text-gray-800', iconColor: 'text-blue-500', bg: 'bg-white', border: 'border-gray-200',
                  },
                  {
                    label: 'Total Paid', val: ledger.total_paid, sub: `${paidEvents} receipt${paidEvents === 1 ? '' : 's'}`,
                    Icon: CheckCircle, color: 'text-emerald-700', iconColor: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200',
                  },
                  {
                    label: 'Balance Due', val: ledger.balance_due, sub: isDue ? 'Outstanding' : 'Settled',
                    Icon: isDue ? AlertTriangle : CheckCircle,
                    color: isDue ? 'text-red-600' : 'text-emerald-600',
                    iconColor: isDue ? 'text-red-500' : 'text-emerald-500',
                    bg: isDue ? 'bg-red-50' : 'bg-emerald-50',
                    border: isDue ? 'border-red-200' : 'border-emerald-200',
                    big: true,
                  },
                ]
                return (
                  <div className="grid grid-cols-3 gap-3">
                    {cards.map(s => {
                      const Icon = s.Icon
                        const isTotalPaid = s.label === 'Total Paid'
                      return (
                        <div
                          key={s.label}
                          role={isTotalPaid ? 'button' : undefined}
                          tabIndex={isTotalPaid ? 0 : undefined}
                          onClick={isTotalPaid ? () => setShowReceiptsModal(true) : undefined}
                          onKeyDown={e => {
                            if (!isTotalPaid) return
                            if (e.key === 'Enter' || e.key === ' ') setShowReceiptsModal(true)
                          }}
                          className={`${s.bg} border ${s.border} rounded-2xl p-3 shadow-sm ${isTotalPaid ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{s.label}</p>
                            <Icon size={14} className={s.iconColor} />
                          </div>
                          <p className={`${s.big ? 'text-2xl' : 'text-xl'} font-black ${s.color} text-right tabular-nums leading-tight`}>
                            ₹{parseFloat(s.val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] font-medium text-gray-500 text-right mt-0.5">{s.sub}</p>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {showReceiptsModal && (
                <div
                  className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowReceiptsModal(false)}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-[75vw] min-w-0 overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-4 py-3 bg-emerald-600 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} />
                        <div>
                          <div className="font-bold text-sm leading-tight">Receipts</div>
                          <div className="text-[11px] text-white/80">{paidReceipts.length} receipt{paidReceipts.length === 1 ? '' : 's'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowReceiptsModal(false)}
                        className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-lg font-bold text-sm"
                      >
                        Close
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="overflow-x-auto min-w-0">
                        <table className="w-full min-w-[640px] table-fixed text-xs border border-gray-200 rounded-lg overflow-hidden">
                          <colgroup>
                            <col className="w-[17%]" />
                            <col className="w-[30%]" />
                            <col className="w-[11%]" />
                            <col className="w-[12%]" />
                            <col className="w-[14%]" />
                            <col style={{ width: 300 }} />
                          </colgroup>
                          <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                            <tr>
                              <th className="px-3 py-2 text-left">Date &amp; time</th>
                              <th className="px-3 py-2 text-left">Description</th>
                              <th className="px-3 py-2 text-center">Status</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                              <th className="px-3 py-2 text-left">Ref</th>
                              <th className="px-3 py-2 text-center align-middle">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paidReceipts.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                                  No receipts found.
                                </td>
                              </tr>
                            ) : (
                              paidReceipts.map((r) => {
                                const invSt = String(r.invoice_status || 'finalized').toLowerCase()
                                const isVoidReceipt = r.status === 'cancelled' || invSt === 'cancelled'
                                const canMutateLedgerPayment = r.rowKind === 'payment' && r.status !== 'cancelled' && invSt === 'finalized' && r.paymentTransactionId
                                return (
                                <tr key={r.id} className={`border-t border-gray-100 hover:bg-emerald-50/30 ${isVoidReceipt ? 'bg-slate-50/80 opacity-90' : ''}`}>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                                    {formatReceiptDateTime(r.date)}
                                  </td>
                                  <td className="px-3 py-2.5 text-gray-800 font-medium min-w-0 truncate" title={r.description || ''}>{r.description || '—'}</td>
                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    {isVoidReceipt ? (
                                      <span className="text-[9px] font-black uppercase tracking-wide text-red-700 bg-red-100 px-2 py-0.5 rounded">Cancelled</span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-emerald-700 font-bold whitespace-nowrap">₹{parseFloat(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.invoice_no || '—'}</td>
                                  <td className="px-2 py-2.5 text-center align-middle w-[300px] max-w-[300px] min-w-[300px] overflow-visible relative z-[1]">
                                    <div className="flex flex-nowrap items-center justify-center gap-1.5 py-0.5 w-full min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowReceiptsModal(false)
                                          setReceipt({
                                            viewOnly: true,
                                            type: r.receiptKind === 'advance' ? 'advance' : 'charge',
                                            data: {
                                              description: r.description,
                                              amount: r.amount,
                                              mode: r.mode,
                                              invoice_no: r.invoice_no,
                                              slip_number: r.slip_number || '',
                                              paid_at: r.date,
                                            },
                                          })
                                        }}
                                        title="View"
                                        aria-label="View receipt"
                                        className="h-8 w-8 hover:w-[72px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition-all duration-150 border border-indigo-100 shadow-sm hover:shadow-md active:scale-95 group"
                                      >
                                        <Eye size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                        <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[40px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">View</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowReceiptsModal(false)
                                          setReceipt({
                                            viewOnly: isVoidReceipt,
                                            type: r.receiptKind === 'advance' ? 'advance' : 'charge',
                                            data: {
                                              description: r.description,
                                              amount: r.amount,
                                              mode: r.mode,
                                              invoice_no: r.invoice_no,
                                              slip_number: r.slip_number || '',
                                              paid_at: r.date,
                                            },
                                          })
                                        }}
                                        title="Print"
                                        aria-label="Print receipt"
                                        className="h-8 w-8 hover:w-[74px] shrink-0 flex items-center justify-center gap-1 overflow-hidden rounded-lg transition-all duration-150 border shadow-sm hover:shadow-md active:scale-95 group text-sky-600 hover:text-white bg-sky-50 hover:bg-sky-600 border-sky-100"
                                      >
                                        <Printer size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                        <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[44px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Print</span>
                                      </button>
                                      {canMutateLedgerPayment ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => openLedgerEditPayment(r.paymentTransactionId)}
                                            title="Edit"
                                            aria-label="Edit payment"
                                            className="h-8 w-8 hover:w-[68px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 rounded-lg transition-all duration-150 border border-emerald-100 shadow-sm hover:shadow-md active:scale-95 group"
                                          >
                                            <Edit2 size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                            <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[36px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Edit</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { setLedgerCancelPayment(r); setLedgerCancelPaymentReason('') }}
                                            title="Cancel"
                                            aria-label="Cancel payment"
                                            className="h-8 w-8 hover:w-[84px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-red-600 hover:text-white bg-red-50 hover:bg-red-600 rounded-lg transition-all duration-150 border border-red-100 shadow-sm hover:shadow-md active:scale-95 group"
                                          >
                                            <X size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                            <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[52px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Cancel</span>
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {ledgerCancelPayment && (
                <div
                  className="fixed inset-0 z-[660] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                  onClick={() => { if (!ledgerCancellingPayment) { setLedgerCancelPayment(null); setLedgerCancelPaymentReason('') } }}
                >
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="px-4 py-3 bg-red-600 text-white flex items-center justify-between">
                      <h3 className="font-bold">Cancel payment receipt</h3>
                      <button type="button" onClick={() => { if (!ledgerCancellingPayment) { setLedgerCancelPayment(null); setLedgerCancelPaymentReason('') } }} className="text-white/80 hover:text-white" disabled={ledgerCancellingPayment}><X size={18} /></button>
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        Cancelling payment for <span className="font-black">{ledgerCancelPayment.invoice_no || '—'}</span>
                        {' · '}
                        <span className="font-semibold">₹{parseFloat(ledgerCancelPayment.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Cancellation reason *</label>
                        <textarea value={ledgerCancelPaymentReason} onChange={e => setLedgerCancelPaymentReason(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none" placeholder="Enter reason" disabled={ledgerCancellingPayment} />
                      </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
                      <button type="button" onClick={() => { if (!ledgerCancellingPayment) { setLedgerCancelPayment(null); setLedgerCancelPaymentReason('') } }} disabled={ledgerCancellingPayment} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200">Close</button>
                      <button type="button" onClick={submitLedgerCancelPayment} disabled={ledgerCancellingPayment} className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700">{ledgerCancellingPayment ? 'Cancelling…' : 'Confirm cancel'}</button>
                    </div>
                  </div>
                </div>
              )}

              {ledgerCancelInvoice && (
                <div
                  className="fixed inset-0 z-[660] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                  onClick={() => { if (!ledgerCancellingInvoice) { setLedgerCancelInvoice(null); setLedgerCancelInvoiceReason('') } }}
                >
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="px-4 py-3 bg-red-600 text-white flex items-center justify-between">
                      <h3 className="font-bold">Cancel invoice / service slip</h3>
                      <button type="button" onClick={() => { if (!ledgerCancellingInvoice) { setLedgerCancelInvoice(null); setLedgerCancelInvoiceReason('') } }} className="text-white/80 hover:text-white" disabled={ledgerCancellingInvoice}><X size={18} /></button>
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        Cancelling invoice <span className="font-black">{ledgerCancelInvoice.label || '—'}</span>. Linked successful payments will be voided.
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Cancellation reason *</label>
                        <textarea value={ledgerCancelInvoiceReason} onChange={e => setLedgerCancelInvoiceReason(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none" placeholder="Enter reason" disabled={ledgerCancellingInvoice} />
                      </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
                      <button type="button" onClick={() => { if (!ledgerCancellingInvoice) { setLedgerCancelInvoice(null); setLedgerCancelInvoiceReason('') } }} disabled={ledgerCancellingInvoice} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200">Close</button>
                      <button type="button" onClick={submitLedgerCancelInvoice} disabled={ledgerCancellingInvoice} className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700">{ledgerCancellingInvoice ? 'Cancelling…' : 'Confirm cancel'}</button>
                    </div>
                  </div>
                </div>
              )}

              {ledgerEditingPayment && (
                <div className="fixed inset-0 z-[660] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !ledgerSavingPayment && setLedgerEditingPayment(null)}>
                  <form onSubmit={handleLedgerSavePayment} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
                    <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
                      <h2 className="text-white font-bold">Edit payment slip</h2>
                      <button type="button" onClick={() => !ledgerSavingPayment && setLedgerEditingPayment(null)} className="text-white/80 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="p-4 overflow-y-auto space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Paid at</label>
                        <input type="datetime-local" value={ledgerEditingPayment.paid_at || ''} onChange={e => setLedgerEditingPayment({ ...ledgerEditingPayment, paid_at: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Amount</label>
                          <input type="number" step="0.01" value={ledgerEditingPayment.amount ?? ''} onChange={e => setLedgerEditingPayment({ ...ledgerEditingPayment, amount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Payment mode</label>
                          <select value={ledgerEditingPayment.payment_mode || 'cash'} onChange={e => setLedgerEditingPayment({ ...ledgerEditingPayment, payment_mode: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="card">Card</option>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Transaction reference</label>
                        <input type="text" value={ledgerEditingPayment.transaction_reference || ''} onChange={e => setLedgerEditingPayment({ ...ledgerEditingPayment, transaction_reference: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Receipt number</label>
                        <input type="text" value={ledgerEditingPayment.receipt_no || ''} onChange={e => setLedgerEditingPayment({ ...ledgerEditingPayment, receipt_no: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                        <select value={ledgerEditingPayment.status || 'success'} onChange={e => setLedgerEditingPayment({ ...ledgerEditingPayment, status: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                          <option value="success">Success</option>
                          <option value="pending">Pending</option>
                          <option value="failed">Failed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 flex gap-2 justify-end bg-gray-50">
                      <button type="button" onClick={() => !ledgerSavingPayment && setLedgerEditingPayment(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200">Close</button>
                      <button type="submit" disabled={ledgerSavingPayment} className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700">{ledgerSavingPayment ? 'Saving…' : 'Save'}</button>
                    </div>
                  </form>
                </div>
              )}

              {ledgerEditingCharge && (
                <div className="fixed inset-0 z-[660] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !ledgerSavingCharge && setLedgerEditingCharge(null)}>
                  <form onSubmit={handleLedgerSaveCharge} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="bg-blue-600 px-4 py-3 flex items-center justify-between text-white">
                      <h2 className="font-bold">{ledgerEditingCharge.invoice_id === 'room_rent' ? 'Edit room rent' : 'Edit charge'}</h2>
                      <button type="button" onClick={() => !ledgerSavingCharge && setLedgerEditingCharge(null)}><X size={18} /></button>
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-gray-500 font-medium">{ledgerEditingCharge.description}</p>
                      {ledgerEditingCharge.invoice_id === 'room_rent' && (
                        <p className="text-[11px] text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-snug">
                          Edit the <span className="font-bold">bed charge for one day</span>. Total room rent is <span className="font-bold">daily rate × {ledger?.days ?? '—'}</span> day(s). Reset uses the bed&apos;s default daily rate from master data.
                          {ledger?.room_rent_computed != null && (
                            <span className="block mt-1 text-blue-900/90">System total (reference): ₹{parseFloat(ledger.room_rent_computed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          )}
                        </p>
                      )}
                      {ledgerEditingCharge.invoice_id === 'room_rent' ? (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Bed / room charge per day (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={ledgerEditingCharge.unit_price}
                              onChange={(e) => {
                                const unit = e.target.value
                                const days = Math.max(1, parseFloat(String(ledgerEditingCharge.quantity || ledger?.days || 1)) || 1)
                                const tot = (parseFloat(unit) || 0) * days
                                setLedgerEditingCharge({
                                  ...ledgerEditingCharge,
                                  unit_price: unit,
                                  amount: Number.isFinite(tot) ? String(tot.toFixed(2)) : '',
                                })
                              }}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Stay days</label>
                            <input
                              type="number"
                              step="1"
                              value={ledgerEditingCharge.quantity}
                              readOnly
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-gray-50 text-gray-600"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Total room rent (₹)</label>
                            <input
                              type="text"
                              readOnly
                              value={(() => {
                                const days = Math.max(1, parseFloat(String(ledgerEditingCharge.quantity || ledger?.days || 1)) || 1)
                                const u = parseFloat(String(ledgerEditingCharge.unit_price)) || 0
                                return (u * days).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              })()}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-gray-50 text-gray-800 font-semibold"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Line amount (₹)</label>
                            <input type="number" step="0.01" value={ledgerEditingCharge.amount} onChange={e => setLedgerEditingCharge({ ...ledgerEditingCharge, amount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" required />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">Qty</label>
                              <input type="number" step="0.01" value={ledgerEditingCharge.quantity} onChange={e => setLedgerEditingCharge({ ...ledgerEditingCharge, quantity: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" required />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">Unit price (₹)</label>
                              <input type="number" step="0.01" value={ledgerEditingCharge.unit_price} onChange={e => setLedgerEditingCharge({ ...ledgerEditingCharge, unit_price: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" required />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="p-4 border-t flex flex-wrap justify-end gap-2 bg-gray-50">
                      {ledgerEditingCharge.invoice_id === 'room_rent' && (ledger?.room_rent_override != null || ledger?.room_rent_daily_charge_override != null) && (
                        <button
                          type="button"
                          onClick={clearRoomRentOverride}
                          disabled={ledgerSavingCharge}
                          className="px-4 py-2 rounded-xl text-sm font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-200 mr-auto"
                        >
                          Use calculated rent
                        </button>
                      )}
                      <button type="button" onClick={() => !ledgerSavingCharge && setLedgerEditingCharge(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200">Close</button>
                      <button type="submit" disabled={ledgerSavingCharge} className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700">{ledgerSavingCharge ? 'Saving…' : 'Save'}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={13} className="text-blue-500" /> Account Statement
                  </span>
                  <button onClick={fetchLedger} className="text-gray-400 hover:text-blue-500 transition-colors"><RefreshCw size={13} /></button>
                </div>
                <div className="overflow-x-auto flex-1 max-h-[60vh]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-2 py-2.5 w-8"></th>
                        <th className="px-4 py-2.5">Date &amp; time</th>
                        <th className="px-4 py-2.5">Description</th>
                        <th className="px-4 py-2.5 text-center">Qty</th>
                        <th className="px-4 py-2.5 text-right">Charges (₹)</th>
                        <th className="px-4 py-2.5 text-right text-emerald-600">Paid (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {admissionLedgerStatementParts.map((part, idx) => {
                        if (part.kind === 'room') {
                          const item = part.row
                          const roomDays = Math.max(1, parseInt(String(ledger?.days ?? '1'), 10) || 1)
                          const roomRowId = String(item.id || 'room_rent')
                          const expanded = !!expandedChargeRows[roomRowId]
                          const amt = parseFloat(String(item.amount || '0')) || 0
                          const impliedDaily = roomDays > 0 ? amt / roomDays : amt
                          return (
                            <React.Fragment key={`room-${item.id || idx}`}>
                              <tr className="hover:bg-blue-50/40 transition-colors">
                                <td className="px-2 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleChargeRowExpand(roomRowId)}
                                    className="text-gray-400 hover:text-blue-600 transition-colors"
                                    aria-expanded={expanded}
                                    aria-label={expanded ? 'Collapse room rent details' : 'Expand room rent details'}
                                  >
                                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">{format(new Date(item.date), 'd/M/yy HH:mm')}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold shrink-0">RENT</span>
                                    <span className="text-xs font-semibold text-gray-800 min-w-0">{item.description}</span>
                                    {((ledger?.room_rent_override != null && ledger.room_rent_override !== '') ||
                                      (ledger?.room_rent_daily_charge_override != null && ledger.room_rent_daily_charge_override !== '')) ? (
                                      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">Adjusted</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-700 tabular-nums">{roomDays}</td>
                                <td className="px-4 py-2.5 text-right font-bold whitespace-nowrap text-gray-700 tabular-nums">{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="px-4 py-2.5 text-right text-gray-300">—</td>
                              </tr>
                              {expanded && (
                                <tr className="bg-slate-50/70">
                                  <td colSpan={6} className="px-4 py-3">
                                    <div className="space-y-2 border border-slate-200 bg-white rounded-xl p-3">
                                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-bold text-slate-800">{item.description}</p>
                                          <p className="text-[11px] text-slate-500 tabular-nums mt-1">
                                            {item.date ? formatReceiptDateTime(item.date) : '—'}
                                            {' · '}
                                            {roomDays} day(s)
                                            {' · '}
                                            Effective ₹{impliedDaily.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/day
                                            {' · '}
                                            Total ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </p>
                                          {(admission?.ward_name || admission?.room_name || admission?.bed_code) && (
                                            <p className="text-[11px] text-slate-600 mt-1">
                                              {admission.ward_name ? <span>Ward: {admission.ward_name}</span> : null}
                                              {admission.room_name ? <span>{admission.ward_name ? ' · ' : ''}Room: {admission.room_name}</span> : null}
                                              {admission.bed_code ? <span>{(admission.ward_name || admission.room_name) ? ' · ' : ''}Bed: {admission.bed_code}</span> : null}
                                            </p>
                                          )}
                                          {ledger?.room_rent_computed != null && (
                                            <p className="text-[11px] text-blue-700 mt-1 font-medium">
                                              System calculation: ₹{parseFloat(ledger.room_rent_computed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </p>
                                          )}
                                        </div>
                                        <div className="inline-flex flex-nowrap items-center gap-1.5 shrink-0 max-w-full overflow-x-auto py-0.5">
                                          <button
                                            type="button"
                                            onClick={() => openLedgerEditRoomRent(item)}
                                            title="Edit amount"
                                            aria-label="Edit room rent amount"
                                            className="h-8 w-8 hover:w-[68px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 rounded-lg transition-all duration-150 border border-emerald-100 shadow-sm hover:shadow-md active:scale-95 group"
                                          >
                                            <Edit2 size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                            <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[36px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Edit</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        }
                        const row = part.row
                        const expanded = !!expandedChargeRows[row.id]
                        const events = row.events || []
                        const latest = events[events.length - 1]
                        const totalAmount = parseFloat(row.total_amount || 0)
                        const totalPaid = parseFloat(row.total_paid || 0)
                        const isDiscount = totalAmount < 0
                        const isPaymentRow = totalPaid > 0 && totalAmount === 0
                        const isCancelledChargeGroup = String(row.description || '').includes('(Cancelled)')
                        let badge = null
                        if (isDiscount) badge = { label: 'DISCOUNT', cls: 'bg-amber-100 text-amber-700' }
                        else if (isPaymentRow) badge = { label: 'PAYMENT', cls: 'bg-emerald-100 text-emerald-700' }
                        else if (isCancelledChargeGroup) badge = { label: 'CANCELLED', cls: 'bg-red-100 text-red-700' }
                        else badge = { label: 'SERVICE', cls: 'bg-blue-100 text-blue-700' }
                        return (
                          <React.Fragment key={`grp-${row.id}-${idx}`}>
                            <tr className={`hover:bg-blue-50/40 transition-colors ${isDiscount ? 'bg-amber-50/40' : ''} ${isCancelledChargeGroup ? 'bg-slate-50/70 opacity-90' : ''}`}>
                              <td className="px-2 py-2.5 text-center">
                                <button onClick={() => toggleChargeRowExpand(row.id)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">{latest?.date ? formatReceiptDateTime(latest.date) : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${badge.cls}`}>{badge.label}</span>
                                  <span className={`text-xs font-semibold ${isDiscount ? 'text-amber-700' : 'text-gray-800'}`}>{row.description}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-700 tabular-nums">{parseInt(row.quantity || 0, 10) || <span className="text-gray-300 font-normal">—</span>}</td>
                              <td className="px-4 py-2.5 text-right font-bold whitespace-nowrap text-gray-700 tabular-nums">
                                {totalAmount === 0 ? <span className="text-gray-300 font-normal">—</span> : parseFloat(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                                {totalPaid === 0 ? <span className="text-gray-300 font-normal">—</span> : parseFloat(totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="bg-slate-50/70">
                                <td colSpan={6} className="px-4 py-3">
                                  <div className="space-y-2 border border-slate-200 bg-white rounded-xl p-3">
                                    {events.length === 0 ? (
                                      <p className="text-xs text-gray-400">No item logs available.</p>
                                    ) : events.map((ev, evIdx) => {
                                      const evInv = String(ev.invoice_status || '').toLowerCase()
                                      const isEvInvoiceCancelled = evInv === 'cancelled'
                                      return (
                                      <div key={`${row.id}-event-${ev.id}-${evIdx}`} className={`flex items-center justify-between gap-3 border-b border-slate-100 last:border-b-0 pb-2 last:pb-0 ${isEvInvoiceCancelled ? 'opacity-90' : ''}`}>
                                        <div>
                                          <p className="text-xs font-bold text-slate-800">{ev.name || row.description}</p>
                                          <p className="text-[11px] text-slate-500 tabular-nums">
                                            {formatReceiptDateTime(ev.date)}
                                            {' · '}
                                            ₹{parseFloat(ev.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            {' · '}
                                            {(ev.payment_mode || 'credit').toUpperCase()}
                                            {' · Paid '}
                                            ₹{parseFloat(ev.paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </p>
                                          {isEvInvoiceCancelled && ev.cancelled_reason ? (
                                            <p className="text-[10px] text-red-600 mt-0.5 font-medium">Reason: {ev.cancelled_reason}</p>
                                          ) : null}
                                        </div>
                                        <div className="inline-flex flex-nowrap items-center gap-1.5 shrink-0 max-w-full overflow-x-auto py-0.5">
                                          <button
                                            type="button"
                                            onClick={() => setReceipt({
                                              viewOnly: true,
                                              type: 'charge',
                                              data: {
                                                amount: ev.price,
                                                mode: ev.payment_mode || 'other',
                                                invoice_no: ev.invoice_no,
                                                slip_number: ev.slip_number || '',
                                                description: ev.name || row.description,
                                                paid_at: ev.date,
                                              },
                                            })}
                                            title="View"
                                            aria-label="View receipt"
                                            className="h-8 w-8 hover:w-[72px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition-all duration-150 border border-indigo-100 shadow-sm hover:shadow-md active:scale-95 group"
                                          >
                                            <Eye size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                            <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[40px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">View</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setReceipt({
                                              viewOnly: isEvInvoiceCancelled,
                                              type: 'charge',
                                              data: {
                                                amount: ev.price,
                                                mode: ev.payment_mode || 'other',
                                                invoice_no: ev.invoice_no,
                                                slip_number: ev.slip_number || '',
                                                description: ev.name || row.description,
                                                paid_at: ev.date,
                                              },
                                            })}
                                            title="Print"
                                            aria-label="Print receipt"
                                            className="h-8 w-8 hover:w-[74px] shrink-0 flex items-center justify-center gap-1 overflow-hidden rounded-lg transition-all duration-150 border shadow-sm hover:shadow-md active:scale-95 group text-sky-600 hover:text-white bg-sky-50 hover:bg-sky-600 border-sky-100"
                                          >
                                            <Printer size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                            <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[44px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Print</span>
                                          </button>
                                          {ev.invoice_id && evInv === 'finalized' ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => openLedgerEditChargeFromEvent(ev, row.description)}
                                                title="Edit"
                                                aria-label="Edit charge"
                                                className="h-8 w-8 hover:w-[68px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 rounded-lg transition-all duration-150 border border-emerald-100 shadow-sm hover:shadow-md active:scale-95 group"
                                              >
                                                <Edit2 size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                                <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[36px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Edit</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setLedgerCancelInvoice({
                                                    invoice_id: ev.invoice_id,
                                                    label: ev.invoice_no || ev.name || row.description,
                                                  })
                                                  setLedgerCancelInvoiceReason('')
                                                }}
                                                title="Cancel"
                                                aria-label="Cancel invoice"
                                                className="h-8 w-8 hover:w-[84px] shrink-0 flex items-center justify-center gap-1 overflow-hidden text-red-600 hover:text-white bg-red-50 hover:bg-red-600 rounded-lg transition-all duration-150 border border-red-100 shadow-sm hover:shadow-md active:scale-95 group"
                                              >
                                                <X size={13} className="group-hover:scale-110 transition-transform shrink-0" />
                                                <span className="max-w-0 opacity-0 translate-x-1 group-hover:max-w-[52px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Cancel</span>
                                              </button>
                                            </>
                                          ) : null}
                                        </div>
                                      </div>
                                    )})}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                      {admissionLedgerStatementParts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-xs text-gray-400">
                            No entries yet. Use the right panel to add charges, receive payments or apply a discount.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-600 uppercase sticky bottom-0">
                        <td colSpan={4} className="px-4 py-2.5 text-right">Total</td>
                        <td className="px-4 py-2.5 text-right text-gray-800 tabular-nums">₹{parseFloat(ledger.total_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 tabular-nums">₹{parseFloat(ledger.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Room rent discount shortcut (jumps to Discount mode in right panel) */}
              {parseFloat(ledger.room_rent) > 0 && (
                <button onClick={applyRoomRentDiscount}
                  className="self-start flex items-center gap-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-xl font-bold border border-amber-200 transition-colors">
                  <Tag size={13} /> Apply Room Rent Discount
                </button>
              )}
            </div>

            {/* ── Right: Action Panel (2 cols) ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Mode Picker */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-2 grid grid-cols-3 gap-2 bg-gray-50/70 border-b border-gray-100">
                  {[
                    { id: 'charge',   label: 'Add Charge',    icon: Plus,         theme: 'blue'    },
                    { id: 'receive',  label: 'Receive Money', icon: IndianRupee,  theme: 'emerald' },
                    { id: 'discount', label: 'Discount',      icon: Tag,          theme: 'amber'   },
                  ].map(seg => {
                    const active = mode === seg.id
                    const Icon = seg.icon
                    const themeMap = {
                      blue:    'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200',
                      emerald: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200',
                      amber:   'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200',
                    }
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => setMode(seg.id)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${active ? themeMap[seg.theme] : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'}`}
                      >
                        <Icon size={14} /> {seg.label}
                      </button>
                    )
                  })}
                </div>

                <div className="p-4">
                  {/* ─── Add Charge ─── */}
                  {mode === 'charge' && (
                    <form onSubmit={handleCharge} className="space-y-3">
                      <div ref={serviceComboboxRef} className="relative">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Description *</label>
                        <input
                          value={chgDesc}
                          onChange={e => {
                            const next = e.target.value
                            setChgDesc(next)
                            setIsServiceMenuOpen(true)
                            const exact = serviceOptions.find(
                              (opt) => opt.description.toLowerCase() === next.trim().toLowerCase()
                            )
                            if (exact) {
                              setSelectedExistingCharge(exact.id)
                            } else if (selectedExistingCharge) {
                              setSelectedExistingCharge('')
                            }
                            setHighlightedServiceIndex(0)
                          }}
                          onFocus={() => {
                            if (serviceOptions.length > 0) {
                              setIsServiceMenuOpen(true)
                              setHighlightedServiceIndex(0)
                            }
                          }}
                          onClick={() => {
                            if (serviceOptions.length > 0) {
                              setIsServiceMenuOpen(true)
                              setHighlightedServiceIndex(0)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (!serviceOptions.length) return
                            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isServiceMenuOpen) {
                              e.preventDefault()
                              setIsServiceMenuOpen(true)
                              setHighlightedServiceIndex(0)
                              return
                            }
                            if (!isServiceMenuOpen) return
                            if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              setHighlightedServiceIndex((prev) =>
                                Math.min((prev < 0 ? 0 : prev + 1), Math.max(filteredServiceOptions.length - 1, 0))
                              )
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              setHighlightedServiceIndex((prev) => Math.max((prev < 0 ? 0 : prev - 1), 0))
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              setIsServiceMenuOpen(false)
                              setHighlightedServiceIndex(-1)
                            } else if (e.key === 'Enter') {
                              if (isServiceMenuOpen) {
                                e.preventDefault()
                                if (highlightedServiceIndex >= 0 && filteredServiceOptions.length > 0) {
                                  handleSelectExistingCharge(filteredServiceOptions[highlightedServiceIndex].id)
                                } else {
                                  setIsServiceMenuOpen(false)
                                  setHighlightedServiceIndex(-1)
                                }
                              }
                            }
                          }}
                          required
                          placeholder="e.g. Doctor Visit, Surgery, Medicine"
                          className={`mt-1 ${inp}`}
                        />
                        {isServiceMenuOpen && serviceOptions.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-52 overflow-auto">
                            {filteredServiceOptions.length > 0 ? (
                              filteredServiceOptions.map((opt, idx) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    handleSelectExistingCharge(opt.id)
                                  }}
                                  className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 border-gray-100 ${
                                    idx === highlightedServiceIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <p className="text-sm font-semibold text-gray-800 truncate">{opt.description}</p>
                                  <p className="text-[11px] text-gray-500">
                                    Qty so far: {opt.quantity}
                                    {getLatestUnitPrice(opt.events)
                                      ? ` · Last price: ₹${getLatestUnitPrice(opt.events).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                      : ''}
                                  </p>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-2.5 text-xs text-gray-500">
                                No matching service - press Enter to use typed description
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1 italic">
                          Click or type to search existing services. You can also enter a new custom service.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Qty *</label>
                          <input id="chg-qty-input" type="number" step="1" min="1" value={chgQty}
                            onChange={e => setChgQty(e.target.value)} required placeholder="1"
                            className={`mt-1 ${inp}`} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Unit Price (₹) *</label>
                          <input id="chg-unit-input" type="number" step="0.01" min="0" value={chgUnitPrice}
                            onChange={e => setChgUnitPrice(e.target.value)} required placeholder="e.g. 500"
                            className={`mt-1 ${inp}`} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Line Total</span>
                        <span className="text-base font-black text-blue-800 tabular-nums">
                          ₹{parseFloat(chgLineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Status *</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {[
                            { val: 'due',  label: 'Add to Bill (Due)' },
                            { val: 'paid', label: 'Paid Now' },
                          ].map(s => (
                            <button key={s.val} type="button" onClick={() => setChgStatus(s.val)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-colors ${chgStatus === s.val ? (s.val === 'paid' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {chgStatus === 'paid' && (
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Payment Mode *</label>
                          <div className="grid grid-cols-4 gap-2 mt-1">
                            {['cash', 'upi', 'card', 'other'].map(m => (
                              <button key={m} type="button" onClick={() => setChgPaidMode(m)}
                                className={`py-2 rounded-xl text-xs font-bold border transition-colors capitalize ${chgPaidMode === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-400'}`}>
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 font-medium">
                        <input type="checkbox" checked={chgPrint} onChange={e => setChgPrint(e.target.checked)}
                          className="w-4 h-4 accent-blue-600 rounded" />
                        Print receipt after save
                      </label>
                      <button type="submit" disabled={submitting}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm text-sm disabled:opacity-60">
                        {submitting ? 'Saving…' : <><Plus size={16} /> Save Charge</>}
                      </button>
                    </form>
                  )}

                  {/* ─── Receive Money ─── */}
                  {mode === 'receive' && (
                    <form onSubmit={handleAdvance} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Amount (₹) *</label>
                        <input type="number" step="1" min="0" value={advAmount}
                          onChange={e => setAdvAmount(e.target.value)} required placeholder="e.g. 5000"
                          className={`mt-1 ${inp}`} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Payment Mode *</label>
                        <div className="grid grid-cols-4 gap-2 mt-1">
                          {['cash', 'upi', 'card', 'other'].map(m => (
                            <button key={m} type="button" onClick={() => setAdvMode(m)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-colors capitalize ${advMode === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-400'}`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Reference / Txn ID</label>
                        <input value={advRef} onChange={e => setAdvRef(e.target.value)} placeholder="Optional (UPI Ref etc.)"
                          className={`mt-1 ${inp}`} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 font-medium">
                        <input type="checkbox" checked={advPrint} onChange={e => setAdvPrint(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded" />
                        Print receipt after save
                      </label>
                      <button type="submit" disabled={submitting}
                        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm text-sm disabled:opacity-60">
                        {submitting ? 'Saving…' : <><IndianRupee size={16} /> Save Payment</>}
                      </button>
                    </form>
                  )}

                  {/* ─── Apply Discount ─── */}
                  {mode === 'discount' && (
                    <form onSubmit={handleDiscount} className="space-y-3">
                      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                        <Tag size={14} className="text-amber-600 mt-0.5" />
                        <p className="text-[11px] text-amber-800 font-medium leading-snug">
                          Discount is added as a negative line so it subtracts from the total bill.
                        </p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Reason *</label>
                        <input value={discReason} onChange={e => setDiscReason(e.target.value)} required
                          placeholder="e.g. Senior Citizen Discount, Room Rent Concession"
                          className={`mt-1 ${inp}`} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Discount Amount (₹) *</label>
                        <input id="disc-amount-input" type="number" step="1" min="0" value={discAmount}
                          onChange={e => setDiscAmount(e.target.value)} required placeholder="e.g. 500"
                          className={`mt-1 ${inp}`} />
                        <p className="text-[10px] text-gray-400 mt-1 italic">Enter a positive number; it will be saved as a discount.</p>
                      </div>

                      {parseFloat(ledger.room_rent) > 0 && (
                        <button type="button" onClick={applyRoomRentDiscount}
                          className="w-full flex items-center justify-center gap-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-2 rounded-xl font-bold border border-amber-200 transition-colors">
                          <Tag size={13} /> Use “Room Rent Discount”
                        </button>
                      )}

                      <button type="submit" disabled={submitting}
                        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm text-sm disabled:opacity-60">
                        {submitting ? 'Saving…' : <><Tag size={16} /> Save Discount</>}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Room rent info */}
              {parseFloat(ledger.room_rent) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Auto Room Rent</p>
                  <p className="font-black text-blue-800 text-lg">₹{parseFloat(ledger.room_rent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  <p className="text-blue-600 text-xs mt-0.5">{ledger.days} day{ledger.days !== 1 ? 's' : ''} · Bed {admission.bed_code}</p>
                </div>
              )}
            </div>

          </div>
        ) : null}
      </div>
    </div>
  )
}


function PrintIpdLedger({ admission, ledger, onClose }) {
  const printRef = useRef(null)
  const slipProfile = getPaymentSlipProfile()
  const hospitalName = (slipProfile.hospital_name || DEFAULT_PAYMENT_SLIP_PROFILE.hospital_name).toUpperCase()
  const address = slipProfile.address || DEFAULT_PAYMENT_SLIP_PROFILE.address
  const pinCode = slipProfile.pin_code || DEFAULT_PAYMENT_SLIP_PROFILE.pin_code
  const phone = slipProfile.phone || DEFAULT_PAYMENT_SLIP_PROFILE.phone
  const email = slipProfile.email || DEFAULT_PAYMENT_SLIP_PROFILE.email
  const website = slipProfile.website || DEFAULT_PAYMENT_SLIP_PROFILE.website
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (printRef.current) {
        receptionistLastPrintKind = 'ipd_ledger'
        window.print()
      }
    }, 800)

    function handleAfterPrint() {
      onClose()
    }
    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  const now = formatReceiptDateTime(new Date())

  const billingItems = ledger ? (() => {
    const raw = (ledger.charges || []).filter(c => {
      if (c.type === 'payment' || c.type === 'pharmacy_payment') return false
      return String(c.invoice_status || '').toLowerCase() !== 'cancelled'
    })
    const grouped = {}
    raw.forEach(c => {
      let desc = (c.description || 'Service').trim()
      let key = desc
      const lower = key.toLowerCase()
      if (lower.includes('room rent') || lower.includes('bed charge') || lower.includes('room charge')) {
        key = 'Room Rent / Bed Charges'
        desc = 'Room Rent / Bed Charges'
      }
      if (!grouped[key]) {
        grouped[key] = { description: desc, quantity: 1, total_amount: parseFloat(c.amount || 0) }
      } else {
        grouped[key].quantity += 1
        grouped[key].total_amount += parseFloat(c.amount || 0)
      }
    })
    return Object.values(grouped).sort((a, b) => a.description.localeCompare(b.description))
  })() : []
  const payments = ledger ? [...(ledger.payments || [])].filter(p => {
    if (p.type === 'pharmacy_payment') return true
    if (String(p.status || '').toLowerCase() === 'cancelled') return false
    if (String(p.invoice_status || 'finalized').toLowerCase() === 'cancelled') return false
    return true
  }).sort((a, b) => new Date(a.date) - new Date(b.date)) : []

  const content = (
    <div id="__ipd_ledger_root" className="fixed inset-0 z-[600] bg-white overflow-y-auto print:p-0 p-4 sm:p-8 print:static print:h-auto print:overflow-visible print:bg-transparent">
      <div className="absolute top-4 right-4 print:hidden flex gap-3">
        <button
          type="button"
          onClick={() => {
            receptionistLastPrintKind = 'ipd_ledger'
            window.print()
          }}
          className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-emerald-200"
        >
          Print Bill
        </button>
        <button onClick={onClose} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-bold">Cancel</button>
      </div>

      <div ref={printRef} className="ipd-ledger-sheet mx-auto w-full max-w-[210mm] text-black bg-white print:shadow-none shadow-2xl">
        <div className="p-4 sm:p-[15mm] print:p-0 flex flex-col relative bg-white">
          {/* Bill Header */}
          <div className="ipd-ledger-header text-center mb-6">
            <h1 className="text-4xl font-black tracking-widest text-gray-900 leading-none">{hospitalName}</h1>
            <p className="text-sm font-medium text-gray-500 mt-1 uppercase tracking-wider">{address}, {pinCode}</p>
            <div className="mt-6 border-y-2 border-gray-900 py-2">
              <h2 className="text-2xl font-black uppercase tracking-[0.3em]">Final Bill</h2>
            </div>
          </div>

          {/* Bill Info Grid */}
          <div className="ipd-ledger-info grid grid-cols-2 gap-x-12 gap-y-2 text-sm mb-6">
            <div className="space-y-1">
              <div className="flex"><span className="w-24 font-bold">Patient Name</span><span className="font-medium">: {admission.patient_name}</span></div>
              <div className="flex"><span className="w-24 font-bold">Guardian Name</span><span className="font-medium">: {admission.guardian_name || '—'}</span></div>
              <div className="flex"><span className="w-24 font-bold">Address</span><span className="font-medium">: {admission.address || '—'}</span></div>
              <div className="flex"><span className="w-24 font-bold">Mobile No</span><span className="font-medium">: {admission.mobile_number || '—'}</span></div>
              <div className="flex"><span className="w-24 font-bold">Consultant</span><span className="font-medium">: {admission.assigned_doctor_name || '—'}</span></div>
            </div>
            <div className="space-y-1">
              <div className="flex"><span className="w-28 font-bold">Bill No</span><span className="font-medium">: BILL-{String(admission.ipd_no || admission.id).slice(0,6).toUpperCase()}</span></div>
              <div className="flex"><span className="w-28 font-bold">UHID No</span><span className="font-medium">: {admission.patient_uhid}</span></div>
              <div className="flex"><span className="w-28 font-bold">IPD No</span><span className="font-medium">: {admission.ipd_no}</span></div>
              <div className="flex"><span className="w-28 font-bold">Room / Bed</span><span className="font-medium">: {admission.room_name} / {admission.bed_code}</span></div>
              <div className="flex"><span className="w-28 font-bold">{'Bill date & time'}</span><span className="font-medium">: {now}</span></div>
              <div className="flex"><span className="w-28 font-bold">Stay Period</span><span className="font-medium">: {admission.admission_date ? format(new Date(admission.admission_date), 'd/M/yy') : '—'} to {format(new Date(), 'd/M/yy')}</span></div>
            </div>
          </div>

          {/* Billing Table */}
          <div className="flex-1">
            <table className="ipd-ledger-table w-full border-collapse border border-gray-800 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-800 px-3 py-2 text-left w-12">S.No</th>
                  <th className="border border-gray-800 px-3 py-2 text-left">Description</th>
                  <th className="border border-gray-800 px-3 py-2 text-right w-20">Unit</th>
                  <th className="border border-gray-800 px-3 py-2 text-right w-24">Rate</th>
                  <th className="border border-gray-800 px-3 py-2 text-right w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {billingItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-800 px-3 py-2">{idx + 1}</td>
                    <td className="border border-gray-800 px-3 py-2 font-bold uppercase break-words">{item.description}</td>
                    <td className="border border-gray-800 px-3 py-2 text-right">{item.quantity}</td>
                    <td className="border border-gray-800 px-3 py-2 text-right">{parseFloat(item.total_amount / item.quantity || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="border border-gray-800 px-3 py-2 text-right font-bold">{parseFloat(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 1 - billingItems.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}><td className="border border-gray-800 px-3 py-2.5 text-center text-gray-200">—</td><td className="border border-gray-800 px-3 py-2.5" /><td className="border border-gray-800 px-3 py-2.5" /><td className="border border-gray-800 px-3 py-2.5" /><td className="border border-gray-800 px-3 py-2.5" /></tr>
                ))}
              </tbody>
            </table>

            <div className="mt-0 border-x border-b border-gray-800 flex divide-x divide-gray-800 break-inside-avoid">
               <div className="flex-1 p-3 text-xs">
                 <p className="font-black underline mb-2">Receipt Details :</p>
                 {payments.length > 0 ? (
                    <div className="space-y-0.5">
                      {payments.map((p, i) => (
                        <p key={i}>R.No: {p.invoice_no || '--'} - Dt. {formatReceiptDateTime(p.date)} - Amt. {parseFloat(p.amount).toLocaleString('en-IN')}</p>
                      ))}
                    </div>
                 ) : <p className="italic opacity-50">No payments recorded</p>}
               </div>
               <div className="w-80 font-bold text-sm">
                 <div className="flex justify-between border-b border-gray-200 p-2"><span>GROSS AMOUNT :</span> <span>₹{parseFloat(ledger.total_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                 <div className="flex justify-between border-b border-gray-200 p-2"><span>ROUND OFF :</span> <span>₹0.00</span></div>
                 <div className="flex justify-between bg-gray-50 p-2 text-base font-black"><span>NET AMOUNT :</span> <span>₹{parseFloat(ledger.total_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                 <div className="flex justify-between border-b border-gray-200 p-2"><span>PAYMENT RECD :</span> <span className="text-emerald-700">₹{parseFloat(ledger.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                 <div className="flex justify-between p-2"><span>REFUND / DUE :</span> <span className={ledger.balance_due > 0 ? 'text-red-600' : 'text-blue-600'}>₹{parseFloat(Math.abs(ledger.balance_due || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
               </div>
            </div>
          </div>

          <div className="ipd-ledger-sign mt-auto pt-8 flex justify-between items-end break-inside-avoid">
            <div className="text-xs font-bold italic">
               <p>E. & O.E.</p>
               <p className="mt-4">Doc. Prepared by : {admission.created_by_name || 'System'}</p>
            </div>
            <div className="text-center w-56">
              <div className="h-12 print:h-5 flex items-center justify-center italic text-gray-300">Signatory</div>
              <div className="border-t-2 border-gray-900 pt-1 font-black text-xs uppercase tracking-wider">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 5mm; }
          body, html { background: #fff !important; height: auto !important; overflow: visible !important; }
          body > *:not(#__ipd_ledger_root) { display: none !important; }
          /* Ensure bill wins if another portaled print stylesheet (e.g. discharge summary) loads earlier */
          html body > #__ipd_ledger_root { display: block !important; visibility: visible !important; }
          #__ipd_ledger_root { 
            position: static !important; display: block !important; overflow: visible !important; 
            height: auto !important; padding: 0 !important; margin: 0 !important; zoom: 1;
          }
          #__ipd_ledger_root > div:last-child { margin: 0 !important; box-shadow: none !important; border: none !important; }
          .print\\:hidden, .print\\:hidden * { display: none !important; visibility: hidden !important; }

          /* Keep bill to one page whenever content permits. */
          #__ipd_ledger_root .ipd-ledger-sheet { font-size: 92%; }
          #__ipd_ledger_root .ipd-ledger-header { margin-bottom: 8px !important; }
          #__ipd_ledger_root .ipd-ledger-header .mt-6 { margin-top: 8px !important; }
          #__ipd_ledger_root .ipd-ledger-info { margin-bottom: 8px !important; gap: 4px 18px !important; font-size: 12px !important; }
          #__ipd_ledger_root .ipd-ledger-table th,
          #__ipd_ledger_root .ipd-ledger-table td { padding-top: 4px !important; padding-bottom: 4px !important; }
          #__ipd_ledger_root .ipd-ledger-body { flex: 0 0 auto !important; }
          #__ipd_ledger_root .ipd-ledger-sign { margin-top: 8px !important; padding-top: 6px !important; }
          #__ipd_ledger_root .ipd-ledger-sign p { margin-top: 4px !important; }
        }
      `}</style>
    </div>
  )
  return createPortal(content, document.body)
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ReceptionistPortal() {
  const [section, setSection] = useState('opd')
  const [ipdAdmissionDraft, setIpdAdmissionDraft] = useState(null)
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [rooms, setRooms] = useState(getRoomsConfig())
  const [tvGroups, setTvGroups] = useState(getTvGroupsConfig(getRoomsConfig()))
  const [alerts, setAlerts] = useState([])
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef(null)

  function logout() {
    clearAuthStorage()
    nav('/login')
  }

  useEffect(() => {
    loadReceptionPortalSettings()
  }, [])

  useEffect(() => { saveRoomsConfig(rooms) }, [rooms])

  useEffect(() => {
    const roomCodes = new Set(rooms.map(r => r.code))
    const sanitized = tvGroups.map(g => ({
      ...g,
      left_room: roomCodes.has(g.left_room) ? g.left_room : null,
      right_room: roomCodes.has(g.right_room) ? g.right_room : null,
    }))
    setTvGroups(sanitized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms])

  useEffect(() => { saveTvGroupsConfig(tvGroups) }, [tvGroups])

  // Fetch follow-up alerts
  useEffect(() => {
    fetchFollowUpAlerts()
    const t = setInterval(fetchFollowUpAlerts, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  async function fetchFollowUpAlerts() {
    try {
      const { data } = await api.get('/follow-up-alerts/')
      setAlerts(data)
    } catch { }
  }

  async function markFollowUpDone(id) {
    try {
      await api.patch(`/opd-visits/${id}/`, { follow_up_completed: true })
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast.success('Follow-up marked as completed')
    } catch {
      toast.error('Failed to mark as done')
    }
  }

  // Close bell dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const todayAlerts = alerts.filter(a => a.is_today)
  const tomorrowAlerts = alerts.filter(a => a.is_tomorrow)
  const sectionTitle = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === section)?.label || 'Receptionist'

  function handleMoveOpdToIpd(visitDraft) {
    setIpdAdmissionDraft(visitDraft || null)
    setSection('new_admission')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <Hospital size={20} />
          <div>
            <h1 className="font-bold text-sm leading-tight">
              {user.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Receptionist Portal'}
            </h1>
            <p className="text-xs opacity-75">{user.role?.replace(/_/g, ' ') || user.email || 'Reception Desk'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">{sectionTitle}</span>

          {/* Follow-up Bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(o => !o)}
              className={`relative flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                todayAlerts.length > 0
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : tomorrowAlerts.length > 0
                  ? 'bg-amber-400 hover:bg-amber-500 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <Bell size={14} />
              Follow-up
              {alerts.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white text-emerald-700 text-[9px] font-black rounded-full flex items-center justify-center shadow">
                  {alerts.length}
                </span>
              )}
            </button>

            {/* Dropdown panel */}
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Bell size={14} />
                    <span className="text-sm font-bold">Follow-up Alerts</span>
                  </div>
                  <button onClick={() => setBellOpen(false)} className="text-white/70 hover:text-white"><X size={14} /></button>
                </div>

                {alerts.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">No follow-up alerts</div>
                ) : (
                  <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                    {alerts.map(alert => (
                      <div key={alert.id} className={`p-3 ${
                        alert.is_today ? 'bg-red-50' : 'bg-amber-50'
                      }`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="text-sm font-bold text-gray-800">{alert.patient_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-gray-500 font-mono italic">#{alert.uhid}</p>
                              {alert.patient_phone && (
                                <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                  <Phone size={9} /> {alert.patient_phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                              alert.is_today ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                            }`}>
                              {alert.is_today ? '🔴 TODAY' : '🟡 TOMORROW'}
                            </span>
                            <span className="text-[9px] text-gray-400 font-bold bg-white/50 px-1.5 py-0.5 rounded border border-gray-100 uppercase tracking-tighter">
                              Visited: {format(new Date(alert.original_visit_date), 'dd MMM')}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2 line-clamp-1 italic">"{alert.visit_reason || alert.revisit_advice || 'Follow-up'}"</p>
                        
                        <div className="flex gap-2">
                          {alert.patient_phone && (
                            <a href={`tel:${alert.patient_phone}`}
                              className="flex items-center justify-center gap-1.5 flex-1 text-xs font-bold bg-emerald-600 text-white py-2 rounded-xl hover:bg-emerald-700 transition-all shadow-sm">
                              <Phone size={12} /> Call
                            </a>
                          )}
                          <button
                            onClick={() => markFollowUpDone(alert.id)}
                            className="flex items-center justify-center gap-1.5 flex-1 text-xs font-bold bg-gray-100 text-gray-600 py-2 rounded-xl hover:bg-gray-200 transition-all border border-gray-200"
                          >
                            <CheckCircle size={12} /> Done
                          </button>
                        </div>
                        {alert.doctor_name && <p className="text-[10px] text-gray-400 mt-1 text-center">Dr. {alert.doctor_name}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={logout} className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeSection={section} onSelect={setSection} />
        <main className={`flex-1 flex flex-col min-h-0 ${section === 'opd' ? 'overflow-hidden p-0' : section === 'payment_slip' ? 'overflow-hidden p-4' : section === 'settings' ? 'overflow-hidden p-5' : 'overflow-auto p-5'}`}>
          {section === 'opd' && <OPDSection rooms={rooms} />}
            {section === 'ipd' && <IPDSection mode="ipd" initialAdmissionDraft={ipdAdmissionDraft} />}
            {section === 'new_admission' && <IPDSection mode="new_admission" initialAdmissionDraft={ipdAdmissionDraft} />}
            {section === 'emergency' && <EmergencySection />}
            {section === 'patients' && <PatientListSection />}
            {section === 'opd_history' && <OpdSlipsSection onMoveToIpd={ handleMoveOpdToIpd} />}
            {section === 'register' && <RegisterPatientSection />}
            {section === 'payment_slip' && <PaymentSlipSection />}
            {section === 'payment_slip_list' && <PaymentSlipsListSection />}
            {section === 'discharge' && <DischargeSection />}
            {section === 'attendance' && <StaffAttendanceSection />}
            {section === 'settings' && (
              <ReceptionSettingsSection
                rooms={rooms}
                setRooms={setRooms}
                tvGroups={tvGroups}
                setTvGroups={setTvGroups}
              />
            )}
          </main>
      </div>
    </div>
  )
}


