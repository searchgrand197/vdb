import { useQuery } from '@tanstack/react-query'
import { fetchApiSchema } from '@/utils/apiSchema'

export function useApiSchema(endpoint, options = {}) {
  const key = String(endpoint || '').trim()
  return useQuery({
    queryKey: ['api-schema', key],
    queryFn: () => fetchApiSchema(key),
    enabled: Boolean(key) && options.enabled !== false,
    staleTime: options.staleTime ?? 5 * 60 * 1000,
    ...options,
  })
}

