import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDesignationPermissionProfile,
  fetchDesignationPermissionProfiles,
  patchDesignationPermissionProfile,
} from '@/services/designationPermissionService';

export const designationPermissionsQueryKey = ['designation-permission-profiles'];

export function useDesignationPermissionProfilesQuery(params = {}) {
  return useQuery({
    queryKey: [...designationPermissionsQueryKey, params],
    queryFn: () => fetchDesignationPermissionProfiles(params),
  });
}

export function useDesignationPermissionMutations() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: designationPermissionsQueryKey });

  const create = useMutation({
    mutationFn: createDesignationPermissionProfile,
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }) => patchDesignationPermissionProfile(id, payload),
    onSuccess: invalidate,
  });

  return { create, patch, invalidate };
}
