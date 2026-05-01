import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEarnedLeaveAllocations, saveEarnedLeaveAllocations } from '@/services/earnedLeaveService';

export const earnedLeaveQueryKey = ['earned-leave-allocations'];

export function useEarnedLeaveAllocations(year) {
  return useQuery({
    queryKey: [...earnedLeaveQueryKey, { year }],
    queryFn: () => fetchEarnedLeaveAllocations({ year }),
    enabled: Boolean(year),
    refetchInterval: 0,
  });
}

export function useEarnedLeaveMutations() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: earnedLeaveQueryKey,
    });

  const save = useMutation({
    mutationFn: saveEarnedLeaveAllocations,
    onSuccess: invalidate,
  });

  return { save, invalidate };
}
