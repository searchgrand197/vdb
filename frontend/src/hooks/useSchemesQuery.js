import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createScheme, deleteScheme, fetchSchemes, patchScheme } from '@/services/schemeService';

export const schemesQueryKey = ['schemes'];

export function useSchemesQuery(params = { all: true }) {
  return useQuery({
    queryKey: [...schemesQueryKey, params],
    queryFn: () => fetchSchemes(params),
    refetchInterval: 10000,
  });
}

export function useSchemeMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: schemesQueryKey });

  const create = useMutation({
    mutationFn: createScheme,
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }) => patchScheme(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deleteScheme,
    onSuccess: invalidate,
  });

  return { create, patch, remove, invalidate };
}
