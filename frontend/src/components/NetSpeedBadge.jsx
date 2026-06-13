import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { useInternetSpeed } from '../hooks/useInternetSpeed'

// ---------------------------------------------------------------------------
// Formatting — always MB/s (never ms)
// ---------------------------------------------------------------------------

/** Converts browser Mbps estimate → MB/s label. */
export function formatSpeedLabel(mbps) {
  if (mbps == null || !Number.isFinite(mbps)) return null
  const mbPerSec = mbps / 8
  if (mbPerSec < 0.1) return '< 0.1 MB/s'
  if (mbPerSec < 1) return `${mbPerSec.toFixed(2)} MB/s`
  if (mbPerSec < 10) return `${mbPerSec.toFixed(1)} MB/s`
  return `${Math.round(mbPerSec)} MB/s`
}

const ESTIMATE_TITLE =
  'Link speed from recent app downloads (page assets & API). No extra data is downloaded for this reading.'

const BROWSER_ESTIMATE_TITLE =
  'Browser link estimate — updates when larger downloads complete in this app.'

// ---------------------------------------------------------------------------
// Toast config
// ---------------------------------------------------------------------------

const LOW_SPEED_TOAST_REPEAT_MS = 10_000
const LOW_SPEED_TOAST_VISIBLE_MS = 5_000

const lowSpeedToastStyle = {
  minWidth: '420px',
  maxWidth: '480px',
  padding: '18px 28px',
  fontSize: '15px',
  lineHeight: '1.45',
  borderRadius: '12px',
}

// ---------------------------------------------------------------------------
// Offline modal
// ---------------------------------------------------------------------------

function OfflineModal() {
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-100 px-8 py-10 text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600"
          aria-hidden
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.53l-.53.53-.53-.53a.75.75 0 011.06 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          </svg>
        </div>
        <h2 id="offline-modal-title" className="text-2xl font-bold text-gray-900 tracking-tight">
          Offline
        </h2>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          No internet connection. Some features may not work until you are back online.
        </p>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export default function NetSpeedBadge() {
  const { mbps, status, source } = useInternetSpeed()
  const speedLabel = formatSpeedLabel(mbps)
  const title =
    source === 'measured'
      ? ESTIMATE_TITLE
      : source === 'browser'
        ? BROWSER_ESTIMATE_TITLE
        : ESTIMATE_TITLE

  const speedLabelRef = useRef(speedLabel)
  speedLabelRef.current = speedLabel

  useEffect(() => {
    if (status !== 'low') return undefined

    const showToast = () => {
      const label = speedLabelRef.current
      toast.error(`Low internet connection${label ? ` (${label})` : ''}`, {
        id: 'low-internet-speed',
        duration: LOW_SPEED_TOAST_VISIBLE_MS,
        style: lowSpeedToastStyle,
      })
    }

    showToast()
    const timer = window.setInterval(showToast, LOW_SPEED_TOAST_REPEAT_MS)
    return () => window.clearInterval(timer)
  }, [status])

  let badge

  if (status === 'offline') {
    badge = (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500 text-white shadow-sm"
        title="No internet connection"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />
        Offline
      </span>
    )
  } else if (status === 'measuring') {
    badge = (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 text-white/90"
        title="Waiting for a large enough download in this app to measure speed…"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" aria-hidden />
        …
      </span>
    )
  } else if (status === 'low') {
    badge = (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500 text-white shadow-sm"
        title={title}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />
        Low{speedLabel ? ` ${speedLabel}` : ''}
      </span>
    )
  } else if (status === 'unknown') {
    badge = (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white shadow-sm"
        title="Online — this browser does not expose link speed (use Chrome or Edge for MB/s estimate)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden />
        Online
      </span>
    )
  } else {
    badge = (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white shadow-sm"
        title={title}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden />
        {speedLabel ?? 'Online'}
      </span>
    )
  }

  return (
    <>
      {badge}
      {status === 'offline' && <OfflineModal />}
    </>
  )
}
