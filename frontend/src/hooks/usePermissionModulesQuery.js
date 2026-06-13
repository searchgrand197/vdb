import { useQuery } from '@tanstack/react-query';
import { fetchPermissionModules } from '@/services/permissionModuleService';

export const permissionModulesQueryKey = ['permission-modules'];

export function usePermissionModulesQuery() {
  return useQuery({
    queryKey: permissionModulesQueryKey,
    queryFn: fetchPermissionModules,
    staleTime: 60_000,
  });
}
