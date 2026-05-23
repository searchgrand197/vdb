import { useQuery } from '@tanstack/react-query';
import { fetchPatients } from '@/services/patientService';

export const patientsQueryKey = (params) => ['patients', params];

/** React Query hook for patient list. */
export function usePatientsQuery(params) {
  return useQuery({
    queryKey: patientsQueryKey(params),
    queryFn: () => fetchPatients(params),
    refetchInterval: 60000,
  });
}
