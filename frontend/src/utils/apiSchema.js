import api from '@/api'

const schemaCache = new Map()

function normalizeSchemaPayload(payload) {
  if (!payload || typeof payload !== 'object') return {}
  if (payload.data && typeof payload.data === 'object') return payload.data
  return payload
}

export async function fetchApiSchema(endpoint) {
  const key = String(endpoint || '').trim()
  if (!key) return {}
  if (schemaCache.has(key)) return schemaCache.get(key)

  const response = await api.options(key)
  const schema = normalizeSchemaPayload(response?.data)
  schemaCache.set(key, schema)
  return schema
}

export function getCachedApiSchema(endpoint) {
  const key = String(endpoint || '').trim()
  if (!key) return null
  return schemaCache.get(key) || null
}

export function clearApiSchemaCache(endpoint) {
  if (endpoint) {
    schemaCache.delete(String(endpoint).trim())
    return
  }
  schemaCache.clear()
}

