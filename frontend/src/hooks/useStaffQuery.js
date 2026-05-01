import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStaff, createStaff, patchStaff, deleteStaff } from '@/services/staffService';

export const staffQueryKey = ['staff'];

export function useStaffQuery(params = {}) {
  return useQuery({
    queryKey: [...staffQueryKey, params],
    queryFn: () => fetchStaff(params),
    refetchInterval: 10000,
  });
}

export function useStaffMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: staffQueryKey });

  const create = useMutation({
    mutationFn: createStaff,
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }) => patchStaff(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deleteStaff,
    onSuccess: invalidate,
  });

  return { create, patch, remove, invalidate };
}
