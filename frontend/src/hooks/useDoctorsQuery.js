import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDoctors, createDoctor, patchDoctor, deleteDoctor } from '@/services/doctorService';

export const doctorsQueryKey = ['doctor-profiles'];

export function useDoctorsQuery(params = {}) {
  return useQuery({
    queryKey: [...doctorsQueryKey, params],
    queryFn: () => fetchDoctors(params),
    refetchInterval: 10000,
  });
}

export function useDoctorMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: doctorsQueryKey });

  const create = useMutation({
    mutationFn: createDoctor,
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }) => patchDoctor(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deleteDoctor,
    onSuccess: invalidate,
  });

  return { create, patch, remove, invalidate };
}
