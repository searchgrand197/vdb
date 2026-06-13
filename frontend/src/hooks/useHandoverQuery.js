import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchHandoverBalance,
  fetchHospitalCollection,
  fetchPendingHandovers,
  verifyHandover,
} from '@/services/handoverService';

export const handoverBalanceQueryKey = ['handover', 'balance'];
export const handoverPendingQueryKey = ['handover', 'pending'];
export const hospitalCollectionQueryKey = ['handover', 'hospital-collection'];

export function useHandoverBalanceQuery(options = {}) {
  return useQuery({
    queryKey: handoverBalanceQueryKey,
    queryFn: fetchHandoverBalance,
    refetchInterval: 10000,
    ...options,
  });
}

export function usePendingHandoversQuery(options = {}) {
  return useQuery({
    queryKey: handoverPendingQueryKey,
    queryFn: fetchPendingHandovers,
    refetchInterval: 10000,
    ...options,
  });
}

export function useHospitalCollectionQuery({ dateFrom, dateTo }, options = {}) {
  return useQuery({
    queryKey: [...hospitalCollectionQueryKey, dateFrom, dateTo],
    queryFn: () => fetchHospitalCollection({ dateFrom, dateTo }),
    refetchInterval: 15000,
    ...options,
  });
}

export function useVerifyHandoverMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ handoverId, action }) => verifyHandover(handoverId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoverBalanceQueryKey });
      queryClient.invalidateQueries({ queryKey: handoverPendingQueryKey });
      queryClient.invalidateQueries({ queryKey: hospitalCollectionQueryKey });
    },
  });
}
