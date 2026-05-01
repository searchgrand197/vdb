import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDesignations,
  createDesignation,
  patchDesignation,
  deleteDesignation,
} from '@/services/designationService';

export const designationsQueryKey = ['designations'];

export function useDesignationsQuery(params = {}) {
  return useQuery({
    queryKey: [...designationsQueryKey, params],
    queryFn: () => fetchDesignations(params),
    refetchInterval: 10000,
  });
}

export function useDesignationMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: designationsQueryKey });

  const create = useMutation({
    mutationFn: createDesignation,
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }) => patchDesignation(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deleteDesignation,
    onSuccess: invalidate,
  });

  return { create, patch, remove, invalidate };
}
