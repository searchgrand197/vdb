import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createDepartment, deleteDepartment, fetchDepartments, patchDepartment } from '@/services/departmentService';

export const departmentsQueryKey = ['departments'];

export function useDepartmentsQuery() {
  return useQuery({
    queryKey: departmentsQueryKey,
    queryFn: () => fetchDepartments(),
    refetchInterval: 60000,
  });
}

export function useDepartmentMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: departmentsQueryKey });

  const create = useMutation({
    mutationFn: createDepartment,
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }) => patchDepartment(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: invalidate,
  });

  return { create, patch, remove, invalidate };
}
