import React, { useEffect, useMemo, useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

let idSeq = 0
const listeners = new Set()

function emit(event) {
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // ignore listener errors
    }
  })
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function pushToast(message, type = 'info') {
  const id = `toast-${Date.now()}-${idSeq++}`
  emit({ id, type, message: String(message || '') })
  return id
}

function baseToast(message) {
  return pushToast(message, 'info')
}

baseToast.success = (message) => pushToast(message, 'success')
baseToast.error = (message) => pushToast(message, 'error')
baseToast.loading = (message) => pushToast(message, 'info')
baseToast.dismiss = () => {
  emit({ clear: true })
}
baseToast.promise = async (promise, messages = {}) => {
  const loadingId = baseToast.loading(messages.loading || 'Loading...')
  try {
    const result = await promise
    emit({ dismissId: loadingId })
    baseToast.success(typeof messages.success === 'function' ? messages.success(result) : messages.success || 'Done')
    return result
  } catch (error) {
    emit({ dismissId: loadingId })
    baseToast.error(typeof messages.error === 'function' ? messages.error(error) : messages.error || 'Something went wrong')
    throw error
  }
}

export default baseToast

export function Toaster({ position = 'top-right', toastOptions = {} }) {
  const [items, setItems] = useState([])
  const duration = toastOptions.duration ?? 3000

  useEffect(
    () =>
      subscribe((event) => {
        if (event.clear) {
          setItems([])
          return
        }
        if (event.dismissId) {
          setItems((prev) => prev.filter((item) => item.id !== event.dismissId))
          return
        }
        if (event.id) {
          setItems((prev) => [...prev, event])
        }
      }),
    [],
  )

  const anchorOrigin = useMemo(() => {
    const vertical = position.includes('bottom') ? 'bottom' : 'top'
    const horizontal = position.includes('left') ? 'left' : position.includes('center') ? 'center' : 'right'
    return { vertical, horizontal }
  }, [position])

  return (
    <>
      {items.map((item, index) => (
        <Snackbar
          key={item.id}
          open
          autoHideDuration={duration}
          onClose={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
          anchorOrigin={anchorOrigin}
          sx={{
            ...(anchorOrigin.vertical === 'top' ? { mt: index * 7 } : { mb: index * 7 }),
          }}
        >
          <Alert
            severity={item.type === 'error' ? 'error' : item.type === 'success' ? 'success' : 'info'}
            variant="filled"
            onClose={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
            sx={{ width: '100%' }}
          >
            {item.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  )
}

