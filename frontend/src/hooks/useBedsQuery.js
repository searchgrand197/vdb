import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchFloors,
  createFloor,
  patchFloor,
  deleteFloor,
  fetchRooms,
  createRoom,
  patchRoom,
  deleteRoom,
  fetchBedsByFloor,
  fetchBeds,
  createBed,
  patchBed,
  deleteBed,
  patchBedStatus,
  fetchHousekeepingOnDuty,
  fastCleanBed,
  fetchCleaningTasks,
  startCleaningTask,
  completeCleaningTask,
} from '@/services/bedService';

/* ── Query keys ─────────────────────────────────────────────────────── */
export const floorsKey = ['beds', 'floors'];
export const roomsKey = ['beds', 'rooms'];
export const bedsByFloorKey = ['beds', 'by-floor'];
export const bedsListKey = ['beds', 'list'];
export const housekeepingKey = ['beds', 'housekeeping'];
export const cleaningTasksKey = ['beds', 'cleaning-tasks'];

/* ═══════════════════════════════════════════════════════════════════════
   FLOORS
   ═══════════════════════════════════════════════════════════════════════ */

export function useFloorsQuery(params = {}) {
  return useQuery({
    queryKey: [floorsKey, params],
    queryFn: () => fetchFloors(params),
  });
}

export function useFloorMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: floorsKey });
    queryClient.invalidateQueries({ queryKey: bedsByFloorKey });
  };

  return {
    create: useMutation({ mutationFn: createFloor, onSuccess: invalidate }),
    patch: useMutation({ mutationFn: ({ id, payload }) => patchFloor(id, payload), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteFloor, onSuccess: invalidate }),
    invalidate,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   ROOMS
   ═══════════════════════════════════════════════════════════════════════ */

export function useRoomsQuery(params = {}) {
  return useQuery({
    queryKey: [roomsKey, params],
    queryFn: () => fetchRooms(params),
  });
}

export function useRoomMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: roomsKey });
    queryClient.invalidateQueries({ queryKey: bedsByFloorKey });
  };

  return {
    create: useMutation({ mutationFn: createRoom, onSuccess: invalidate }),
    patch: useMutation({ mutationFn: ({ id, payload }) => patchRoom(id, payload), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteRoom, onSuccess: invalidate }),
    invalidate,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   BEDS — tree + flat list + CRUD + status actions
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Floor → Room → Bed tree ────────────────────────────────────────── */
export function useBedsByFloorQuery() {
  return useQuery({
    queryKey: bedsByFloorKey,
    queryFn: () => fetchBedsByFloor(),
    refetchInterval: 15000,
  });
}

/* ── Flat bed list ──────────────────────────────────────────────────── */
export function useBedsQuery(params = {}) {
  return useQuery({
    queryKey: [bedsListKey, params],
    queryFn: () => fetchBeds(params),
  });
}

/* ── Bed CRUD mutations ─────────────────────────────────────────────── */
export function useBedMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: bedsByFloorKey });
    queryClient.invalidateQueries({ queryKey: [bedsListKey] });
  };

  return {
    create: useMutation({ mutationFn: createBed, onSuccess: invalidate }),
    patch: useMutation({ mutationFn: ({ id, payload }) => patchBed(id, payload), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteBed, onSuccess: invalidate }),
    invalidate,
  };
}

/* ── Housekeeping on duty ───────────────────────────────────────────── */
export function useHousekeepingQuery() {
  return useQuery({
    queryKey: housekeepingKey,
    queryFn: () => fetchHousekeepingOnDuty(),
  });
}

/* ── Bed status mutation ────────────────────────────────────────────── */
export function useBedStatusMutation() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: bedsByFloorKey });

  return useMutation({
    mutationFn: ({ id, payload }) => patchBedStatus(id, payload),
    onSuccess: invalidate,
  });
}

/* ── Fast clean mutation ────────────────────────────────────────────── */
export function useFastCleanMutation() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: bedsByFloorKey });
    queryClient.invalidateQueries({ queryKey: [cleaningTasksKey] });
  };

  return useMutation({
    mutationFn: ({ id, payload }) => fastCleanBed(id, payload),
    onSuccess: invalidate,
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   CLEANING TASKS
   ═══════════════════════════════════════════════════════════════════════ */

export function useCleaningTasksQuery(params = {}) {
  return useQuery({
    queryKey: [cleaningTasksKey, params],
    queryFn: () => fetchCleaningTasks(params),
    refetchInterval: 15000,
  });
}

export function useStartCleaningTaskMutation() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [cleaningTasksKey] });

  return useMutation({
    mutationFn: (id) => startCleaningTask(id),
    onSuccess: invalidate,
  });
}

export function useCompleteCleaningTaskMutation() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [cleaningTasksKey] });
    queryClient.invalidateQueries({ queryKey: bedsByFloorKey });
  };

  return useMutation({
    mutationFn: (id) => completeCleaningTask(id),
    onSuccess: invalidate,
  });
}
