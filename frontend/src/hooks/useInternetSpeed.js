import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Below 8 Mbps (= 1 MB/s) → "Low" badge + toast. */
export const LOW_SPEED_MBPS = 8

/** Ignore tiny responses — they underestimate link speed. */
const MIN_TRANSFER_BYTES = 8 * 1024

/** Minimum download phase length to avoid divide-by-near-zero spikes. */
const MIN_DOWNLOAD_MS = 15

/** Rolling average over recent large transfers. */
const ROLLING_WINDOW = 5

/** Re-scan resource timing every 30 s (picks up poll responses with no extra traffic). */
const RESCAN_MS = 30_000

/** Measured samples older than this fall back to the browser estimate. */
const SAMPLE_TTL_MS = 10 * 60 * 1000

// ---------------------------------------------------------------------------
// Browser fallback (Chromium only — often stale on small API traffic)
// ---------------------------------------------------------------------------

function readBrowserEstimate() {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return { downlinkMbps: null, effectiveType: null, rttMs: null }
  }
  const c = navigator.connection
  return {
    downlinkMbps:
      typeof c.downlink === 'number' && c.downlink > 0 ? c.downlink : null,
    effectiveType: c.effectiveType ?? null,
    rttMs: typeof c.rtt === 'number' && c.rtt > 0 ? c.rtt : null,
  }
}

function isSlowConnection({ mbps, effectiveType, rttMs }) {
  if (mbps != null && mbps < LOW_SPEED_MBPS) return true
  if (rttMs != null && rttMs > 800) return true
  return effectiveType === 'slow-2g' || effectiveType === '2g'
}

// ---------------------------------------------------------------------------
// Passive throughput — uses bytes the app already downloaded (zero extra cost)
// ---------------------------------------------------------------------------

function isMeasurableResource(entry) {
  if (!entry?.name) return false
  const type = entry.initiatorType
  if (
    type !== 'fetch' &&
    type !== 'xmlhttprequest' &&
    type !== 'script' &&
    type !== 'css' &&
    type !== 'other'
  ) {
    return false
  }
  try {
    const url = new URL(entry.name, window.location.origin)
    if (url.origin !== window.location.origin) return false
    return (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/static/') ||
      type === 'script' ||
      type === 'css'
    )
  } catch {
    return false
  }
}

/** Mbps from the actual download phase of a completed resource transfer. */
function throughputFromEntry(entry) {
  if (!isMeasurableResource(entry)) return null

  const bytes = entry.transferSize || 0
  if (bytes < MIN_TRANSFER_BYTES) return null

  const downloadMs = entry.responseEnd - entry.responseStart
  if (!Number.isFinite(downloadMs) || downloadMs < MIN_DOWNLOAD_MS) return null

  return (bytes * 8) / (downloadMs / 1000) / 1_000_000
}

function pushSample(history, mbps) {
  if (!Number.isFinite(mbps) || mbps <= 0) return history
  const next = [...history, { mbps, at: Date.now() }]
  if (next.length > ROLLING_WINDOW) next.shift()
  return next
}

function averageRecent(history) {
  const cutoff = Date.now() - SAMPLE_TTL_MS
  const fresh = history.filter((s) => s.at >= cutoff)
  if (!fresh.length) return null
  return fresh.reduce((sum, s) => sum + s.mbps, 0) / fresh.length
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Measures link speed passively from the app's own network activity.
 * No speed-test downloads — zero extra bandwidth.
 *
 * @returns {{
 *   mbps: number | null,
 *   status: 'offline' | 'low' | 'ok' | 'unknown' | 'measuring',
 *   online: boolean,
 *   hasEstimate: boolean,
 *   source: 'measured' | 'browser' | null,
 * }}
 */
export function useInternetSpeed() {
  const [online, setOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  )
  const [browserInfo, setBrowserInfo] = useState(() => readBrowserEstimate())
  const [measuredMbps, setMeasuredMbps] = useState(null)
  const [source, setSource] = useState(null)

  const historyRef = useRef([])
  const seenRef = useRef(new Set())

  const ingestEntry = useCallback((entry) => {
    const key = `${entry.name}|${entry.responseEnd}|${entry.transferSize}`
    if (seenRef.current.has(key)) return
    seenRef.current.add(key)
    if (seenRef.current.size > 400) {
      seenRef.current = new Set([...seenRef.current].slice(-200))
    }

    const mbps = throughputFromEntry(entry)
    if (mbps == null) return

    historyRef.current = pushSample(historyRef.current, mbps)
    const avg = averageRecent(historyRef.current)
    if (avg != null) {
      setMeasuredMbps(avg)
      setSource('measured')
    }
  }, [])

  const scanResources = useCallback(() => {
    if (typeof performance === 'undefined') return
    performance.getEntriesByType('resource').forEach(ingestEntry)
  }, [ingestEntry])

  useEffect(() => {
    const refreshBrowser = () => setBrowserInfo(readBrowserEstimate())
    const onOnline = () => {
      setOnline(true)
      refreshBrowser()
      scanResources()
    }
    const onOffline = () => {
      setOnline(false)
      setMeasuredMbps(null)
      setSource(null)
      historyRef.current = []
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    navigator.connection?.addEventListener?.('change', refreshBrowser)

    scanResources()

    let observer
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(ingestEntry)
        })
        observer.observe({ type: 'resource', buffered: true })
      } catch {
        observer = null
      }
    }

    const rescanTimer = setInterval(scanResources, RESCAN_MS)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      navigator.connection?.removeEventListener?.('change', refreshBrowser)
      observer?.disconnect()
      clearInterval(rescanTimer)
    }
  }, [ingestEntry, scanResources])

  const displayMbps = measuredMbps ?? browserInfo.downlinkMbps
  const hasEstimate = displayMbps != null
  const slow =
    online &&
    isSlowConnection({
      mbps: displayMbps,
      effectiveType: browserInfo.effectiveType,
      rttMs: browserInfo.rttMs,
    })

  const status = !online
    ? 'offline'
    : !hasEstimate
      ? 'measuring'
      : slow
        ? 'low'
        : 'ok'

  return {
    mbps: displayMbps,
    status,
    online,
    hasEstimate,
    source: hasEstimate ? source ?? (browserInfo.downlinkMbps != null ? 'browser' : null) : null,
  }
}
