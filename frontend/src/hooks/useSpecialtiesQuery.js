import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSpecialties,
  createSpecialty,
  patchSpecialty,
  deleteSpecialty,
} from '@/services/specialtyService';

export const specialtiesQueryKey = ['specialties'];

export function useSpecialtiesQuery(params = {}) {
  return useQuery({
    queryKey: [...specialtiesQueryKey, params],
    queryFn: () => fetchSpecialties(params),
    refetchInterval: 10000,
  });
}

export function useSpecialtyMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: specialtiesQueryKey });

  const create = useMutation({
    mutationFn: createSpecialty,
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }) => patchSpecialty(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deleteSpecialty,
    onSuccess: invalidate,
  });

  return { create, patch, remove, invalidate };
}
