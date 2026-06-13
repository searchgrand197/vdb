import { useCallback, useEffect, useState } from 'react'
import api from '../../api'

export function useDischargeFieldCatalog(enabled = true) {
  const [catalog, setCatalog] = useState({ fields: {}, child_fields: {}, vitals: {} })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    api.get('/summaries/field-catalog/')
      .then(({ data }) => {
        if (cancelled) return
        setCatalog({
          fields: data?.fields || {},
          child_fields: data?.child_fields || {},
          vitals: data?.vitals || {},
        })
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog({ fields: {}, child_fields: {}, vitals: {} })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [enabled])

  const getSuggestions = useCallback((fieldKey, scope = 'fields') => {
    const bucket = catalog?.[scope] || {}
    return Array.isArray(bucket[fieldKey]) ? bucket[fieldKey] : []
  }, [catalog])

  return { catalog, loading, getSuggestions }
}
