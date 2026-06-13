import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const FLOORS_BASE = '/beds/floors/';
const ROOMS_BASE = '/beds/rooms/';
const BEDS_BASE = '/beds/beds/';
const CLEANING_BASE = '/beds/cleaning-tasks/';

/* ═══════════════════════════════════════════════════════════════════════
   FLOORS — CRUD
   ═══════════════════════════════════════════════════════════════════════ */

export async function fetchFloors(params = {}) {
  const { data } = await api.get(FLOORS_BASE, { params });
  return { data: unwrapListPayload(data) };
}

export async function createFloor(payload) {
  const { data } = await api.post(FLOORS_BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchFloor(id, payload) {
  const { data } = await api.patch(`${FLOORS_BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}

export async function deleteFloor(id) {
  await api.delete(`${FLOORS_BASE}${id}/`);
}

/* ═══════════════════════════════════════════════════════════════════════
   ROOMS — CRUD
   ═══════════════════════════════════════════════════════════════════════ */

export async function fetchRooms(params = {}) {
  const { data } = await api.get(ROOMS_BASE, { params });
  return { data: unwrapListPayload(data) };
}

export async function createRoom(payload) {
  const { data } = await api.post(ROOMS_BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchRoom(id, payload) {
  const { data } = await api.patch(`${ROOMS_BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}

export async function deleteRoom(id) {
  await api.delete(`${ROOMS_BASE}${id}/`);
}

/* ═══════════════════════════════════════════════════════════════════════
   BEDS — CRUD + status actions
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Floor → Room → Bed tree (single call) ──────────────────────────── */
export async function fetchBedsByFloor() {
  const { data } = await api.get(`${BEDS_BASE}by-floor/`);
  const floors = data?.data ?? data;
  return Array.isArray(floors) ? floors : [];
}

/* ── Flat bed list with filters ─────────────────────────────────────── */
export async function fetchBeds(params = {}) {
  const { data } = await api.get(BEDS_BASE, { params });
  return { data: unwrapListPayload(data) };
}

export async function createBed(payload) {
  const { data } = await api.post(BEDS_BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchBed(id, payload) {
  const { data } = await api.patch(`${BEDS_BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}

export async function deleteBed(id) {
  await api.delete(`${BEDS_BASE}${id}/`);
}

/* ── Change bed status (available / occupied / reserved / maintenance / cleaning) */
export async function patchBedStatus(id, payload) {
  const { data } = await api.patch(`${BEDS_BASE}${id}/set-status/`, payload);
  return { data: unwrapOnePayload(data) };
}

/* ── Housekeeping staff on duty ─────────────────────────────────────── */
export async function fetchHousekeepingOnDuty() {
  const { data } = await api.get(`${BEDS_BASE}housekeeping-on-duty/`);
  const rows = data?.data ?? data;
  return Array.isArray(rows) ? rows : [];
}

/* ── Fast-clean a bed ───────────────────────────────────────────────── */
export async function fastCleanBed(id, payload) {
  const { data } = await api.post(`${BEDS_BASE}${id}/fast-clean/`, payload);
  return { data: unwrapOnePayload(data) };
}

/* ═══════════════════════════════════════════════════════════════════════
   CLEANING TASKS
   ═══════════════════════════════════════════════════════════════════════ */

export async function fetchCleaningTasks(params = {}) {
  const { data } = await api.get(CLEANING_BASE, { params });
  return { data: unwrapListPayload(data) };
}

export async function startCleaningTask(id) {
  const { data } = await api.post(`${CLEANING_BASE}${id}/start/`);
  return { data: unwrapOnePayload(data) };
}

export async function completeCleaningTask(id) {
  const { data } = await api.post(`${CLEANING_BASE}${id}/complete/`);
  return { data: unwrapOnePayload(data) };
}
