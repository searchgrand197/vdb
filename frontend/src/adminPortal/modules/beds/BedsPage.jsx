import { useMemo, useState, useEffect } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormControl,
  Switch,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  useBedsByFloorQuery,
  useFloorsQuery,
  useFloorMutations,
  useRoomsQuery,
  useRoomMutations,
  useBedMutations,
  useBedStatusMutation,
  useFastCleanMutation,
  useCleaningTasksQuery,
  useStartCleaningTaskMutation,
  useCompleteCleaningTaskMutation,
  useHousekeepingQuery,
} from '@/hooks/useBedsQuery';
import { AppDialog } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@admin/context/ToastContext';
import { useAuth } from '@admin/context/AuthContext';
import api from '@/api';

/* ── Constants ──────────────────────────────────────────────────────── */

const BED_STATUS_META = {
  available: { label: 'Available', color: 'success', bg: '#e8f5e9' },
  occupied: { label: 'Occupied', color: 'error', bg: '#ffebee' },
  reserved: { label: 'Reserved', color: 'info', bg: '#e3f2fd' },
  maintenance: { label: 'Under Maintenance', color: 'warning', bg: '#fff8e1' },
  cleaning: { label: 'Being Cleaned', color: 'secondary', bg: '#f3e5f5' },
};

const ROOM_TYPE_META = {
  ward: { label: 'Ward' },
  personal: { label: 'Personal Room' },
  shared: { label: 'Shared Room' },
  icu: { label: 'ICU' },
  emergency: { label: 'Emergency' },
};

const STATUS_OPTIONS = Object.entries(BED_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const CLEANING_STATUS_META = {
  pending: { label: 'Pending', color: 'warning' },
  in_progress: { label: 'In Progress', color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'default' },
};

/* ── Summary stats component ────────────────────────────────────────── */

function BedStats({ floors }) {
  const stats = useMemo(() => {
    const s = { total: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0, cleaning: 0 };
    for (const floor of floors) {
      for (const room of floor.rooms || []) {
        for (const bed of room.beds || []) {
          s.total += 1;
          const key = bed.status || 'available';
          if (key in s) s[key] += 1;
        }
      }
    }
    return s;
  }, [floors]);

  const items = [
    { label: 'Total', value: stats.total, color: 'default' },
    { label: 'Available', value: stats.available, color: 'success' },
    { label: 'Occupied', value: stats.occupied, color: 'error' },
    { label: 'Reserved', value: stats.reserved, color: 'info' },
    { label: 'Maintenance', value: stats.maintenance, color: 'warning' },
    { label: 'Cleaning', value: stats.cleaning, color: 'secondary' },
  ];

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {items.map((item) => (
        <Chip
          key={item.label}
          label={`${item.label}: ${item.value}`}
          color={item.color}
          variant={item.color === 'default' ? 'outlined' : 'filled'}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      ))}
    </Stack>
  );
}

/* ── Single bed chip ────────────────────────────────────────────────── */

function BedChip({ bed, room, onClick }) {
  const meta = BED_STATUS_META[bed.status] || BED_STATUS_META.available;
  return (
    <Chip
      icon={<HotelOutlinedIcon sx={{ fontSize: 16 }} />}
      label={`${bed.bed_code} — ${meta.label}`}
      color={meta.color}
      variant="outlined"
      size="small"
      onClick={() => onClick(bed, room)}
      sx={{
        cursor: 'pointer',
        fontWeight: 600,
        '&:hover': { boxShadow: 2 },
        transition: 'box-shadow 0.15s',
      }}
    />
  );
}

/* ── Room card inside a floor ───────────────────────────────────────── */

function RoomCard({
  room,
  onBedClick,
  statusFilter,
  canManage,
  onEditRoom,
  onDeleteRoom,
  onEditBed,
  onDeleteBed,
}) {
  const roomMeta = ROOM_TYPE_META[room.room_type] || ROOM_TYPE_META.ward;
  const beds = room.beds || [];

  const filteredBeds = statusFilter && statusFilter !== 'all'
    ? beds.filter((b) => b.status === statusFilter)
    : beds;

  if (filteredBeds.length === 0 && statusFilter && statusFilter !== 'all') return null;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        mb: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <Typography variant="subtitle2" fontWeight={700}>
          {room.name}
        </Typography>
        <Chip
          label={roomMeta.label}
          size="small"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
        {room.is_ac && (
          <Chip label="AC" size="small" color="info" variant="outlined" sx={{ fontSize: 11 }} />
        )}
        <Typography variant="caption" color="text.secondary">
          ₹{Number(room.daily_charge || 0).toLocaleString()}/day
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {room.available_bed_count}/{room.total_bed_count} free
        </Typography>
        {canManage && (
          <Stack direction="row" spacing={0.25} sx={{ ml: 'auto' }}>
            <IconButton size="small" onClick={() => onEditRoom(room)} title="Edit room">
              <EditOutlinedIcon fontSize="inherit" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => onDeleteRoom(room)} title="Delete room">
              <DeleteOutlinedIcon fontSize="inherit" />
            </IconButton>
          </Stack>
        )}
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {filteredBeds.map((bed) => (
          <Stack key={bed.id} direction="row" spacing={0.4} alignItems="center">
            <BedChip bed={bed} room={room} onClick={onBedClick} />
            {canManage && (
              <>
                <IconButton size="small" onClick={() => onEditBed(bed)} title="Edit bed">
                  <EditOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDeleteBed(bed)} title="Delete bed">
                  <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </>
            )}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/* ── Cleaning task row ──────────────────────────────────────────────── */

function CleaningTaskRow({ task, onStart, onComplete }) {
  const meta = CLEANING_STATUS_META[task.status] || CLEANING_STATUS_META.pending;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        mb: 1,
        bgcolor: 'background.paper',
      }}
    >
      <CleaningServicesOutlinedIcon fontSize="small" color={meta.color} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {task.bed_code || '—'} · {task.bed_room || '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {task.assigned_staff_name || 'Unassigned'} · {meta.label}
        </Typography>
      </Box>
      <Chip label={meta.label} color={meta.color} size="small" variant="outlined" />
      {task.status === 'pending' && (
        <IconButton size="small" color="info" onClick={() => onStart(task.id)} title="Start">
          <PlayArrowOutlinedIcon fontSize="small" />
        </IconButton>
      )}
      {(task.status === 'pending' || task.status === 'in_progress') && (
        <IconButton size="small" color="success" onClick={() => onComplete(task.id)} title="Complete">
          <CheckCircleOutlineOutlinedIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */

export function BedsPage() {
  const { user } = useAuth();
  const canManage = user?.is_superuser === true;
  const { showToast } = useToast();

  /* ── Data ──────────────────────────────────────────────────────────── */
  const { data: floors, isLoading, isError, error } = useBedsByFloorQuery();
  const { data: floorsData } = useFloorsQuery();
  const { data: roomsData } = useRoomsQuery();
  const { data: cleaningData } = useCleaningTasksQuery();
  const { data: housekeepers } = useHousekeepingQuery();

  const floorMut = useFloorMutations();
  const roomMut = useRoomMutations();
  const bedMut = useBedMutations();
  const bedStatusMut = useBedStatusMutation();
  const fastCleanMut = useFastCleanMutation();
  const startTaskMut = useStartCleaningTaskMutation();
  const completeTaskMut = useCompleteCleaningTaskMutation();

  const cleaningTasks = useMemo(
    () =>
      (cleaningData?.data ?? []).filter(
        (task) => task?.status === 'pending' || task?.status === 'in_progress'
      ),
    [cleaningData?.data]
  );

  /* ── Local state ───────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedFloors, setExpandedFloors] = useState([]);

  // Admission bed picker label mode (reception portal setting)
  const [bedLabelMode, setBedLabelMode] = useState('bed_code');
  const [labelModeLoading, setLabelModeLoading] = useState(true);
  const [labelModeSaving, setLabelModeSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/settings/reception-portal/');
        const row = data?.data || data || {};
        if (!cancelled) {
          setBedLabelMode(row.admission_bed_label_mode === 'bed_number' ? 'bed_number' : 'bed_code');
        }
      } catch {
        // keep default
      } finally {
        if (!cancelled) setLabelModeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleBedLabelToggle(checked) {
    const next = checked ? 'bed_number' : 'bed_code';
    setLabelModeSaving(true);
    try {
      await api.patch('/settings/reception-portal/', { admission_bed_label_mode: next });
      setBedLabelMode(next);
      showToast({
        type: 'success',
        message: checked
          ? 'Admission picker will show bed numbers'
          : 'Admission picker will show bed codes',
      });
    } catch (e) {
      showToast({ type: 'error', message: getErrorMessage(e, 'Could not save bed label setting') });
    } finally {
      setLabelModeSaving(false);
    }
  }

  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusError, setStatusError] = useState('');

  // Fast clean dialog
  const [fastCleanOpen, setFastCleanOpen] = useState(false);
  const [fastCleanBedId, setFastCleanBedId] = useState('');
  const [fastStaffId, setFastStaffId] = useState('');
  const [fastNotes, setFastNotes] = useState('');

  // Floor CRUD
  const [floorFormOpen, setFloorFormOpen] = useState(false);
  const [floorMode, setFloorMode] = useState('create');
  const [editingFloorId, setEditingFloorId] = useState(null);
  const [floorError, setFloorError] = useState('');
  const [floorForm, setFloorForm] = useState({
    floor_number: '',
    name: '',
    description: '',
    is_active: true,
  });

  // Room CRUD
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [roomMode, setRoomMode] = useState('create');
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [roomError, setRoomError] = useState('');
  const [roomForm, setRoomForm] = useState({
    floor: '',
    name: '',
    room_number: '',
    room_type: 'ward',
    is_ac: false,
    daily_charge: '',
    max_beds: '',
    is_active: true,
    notes: '',
  });

  // Bed CRUD
  const [bedFormOpen, setBedFormOpen] = useState(false);
  const [bedMode, setBedMode] = useState('create');
  const [editingBedId, setEditingBedId] = useState(null);
  const [bedError, setBedError] = useState('');
  const [bedForm, setBedForm] = useState({
    room: '',
    bed_code: '',
    bed_number: '',
    status: 'available',
    notes: '',
  });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  /* ── Derived data ──────────────────────────────────────────────────── */
  const floorsList = Array.isArray(floors) ? floors : [];
  const floorRows = useMemo(() => {
    if (Array.isArray(floorsList) && floorsList.length > 0) {
      return floorsList.map((f) => ({
        id: f.id,
        name: f.name,
        floor_number: f.floor_number,
      }));
    }
    return floorsData?.data ?? [];
  }, [floorsList, floorsData?.data]);

  const roomRows = useMemo(() => {
    if (Array.isArray(floorsList) && floorsList.length > 0) {
      const flat = [];
      for (const floor of floorsList) {
        for (const room of floor.rooms || []) {
          flat.push({
            id: room.id,
            name: room.name,
            room_number: room.room_number,
          });
        }
      }
      return flat;
    }
    return roomsData?.data ?? [];
  }, [floorsList, roomsData?.data]);

  const filteredFloors = useMemo(() => {
    let result = floorsList;

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.map((floor) => ({
        ...floor,
        rooms: (floor.rooms || []).map((room) => ({
          ...room,
          beds: (room.beds || []).filter(
            (bed) =>
              bed.bed_code.toLowerCase().includes(q) ||
              room.name.toLowerCase().includes(q) ||
              floor.name.toLowerCase().includes(q)
          ),
        })).filter((room) => room.beds.length > 0),
      })).filter((floor) => floor.rooms.length > 0);
    }

    // Room type filter
    if (roomTypeFilter && roomTypeFilter !== 'all') {
      result = result.map((floor) => ({
        ...floor,
        rooms: (floor.rooms || []).filter((room) => room.room_type === roomTypeFilter),
      })).filter((floor) => floor.rooms.length > 0);
    }

    return result;
  }, [floorsList, search, roomTypeFilter]);

  /* ── Handlers ──────────────────────────────────────────────────────── */

  function handleBedClick(bed, room) {
    setSelectedBed(bed);
    setSelectedRoom(room);
    setNewStatus(bed.status);
    setStatusNotes('');
    setStatusError('');
    setStatusDialogOpen(true);
  }

  async function handleStatusSave() {
    if (!selectedBed || !newStatus) return;
    setStatusError('');
    try {
      await bedStatusMut.mutateAsync({
        id: selectedBed.id,
        payload: { status: newStatus, notes: statusNotes },
      });
      showToast({ type: 'success', message: `Bed ${selectedBed.bed_code} status updated` });
      setStatusDialogOpen(false);
    } catch (e) {
      setStatusError(e?.response?.data?.error || e?.message || 'Failed to update status');
    }
  }

  function openFastClean() {
    setFastCleanBedId('');
    setFastStaffId('');
    setFastNotes('');
    setFastCleanOpen(true);
  }

  async function handleFastClean(markAvailable) {
    if (!fastCleanBedId) return;
    try {
      await fastCleanMut.mutateAsync({
        id: fastCleanBedId,
        payload: {
          staff_id: fastStaffId || null,
          mark_available: markAvailable,
          notes: fastNotes,
        },
      });
      showToast({ type: 'success', message: 'Fast clean processed' });
      setFastCleanOpen(false);
    } catch (e) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'Fast clean failed' });
    }
  }

  async function handleStartTask(id) {
    try {
      await startTaskMut.mutateAsync(id);
      showToast({ type: 'success', message: 'Cleaning task started' });
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to start task' });
    }
  }

  async function handleCompleteTask(id) {
    try {
      await completeTaskMut.mutateAsync(id);
      showToast({ type: 'success', message: 'Cleaning task completed — bed now available' });
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to complete task' });
    }
  }

  function getErrorMessage(e, fallback = 'Request failed') {
    const data = e?.response?.data;
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.detail === 'string') return data.detail;
    if (data && typeof data === 'object') {
      const fieldEntry = Object.entries(data).find(([, value]) => Array.isArray(value) && value.length);
      if (fieldEntry) {
        const [field, msgs] = fieldEntry;
        return `${field}: ${msgs[0]}`;
      }
    }
    if (typeof e?.message === 'string') return e.message;
    return fallback;
  }

  function openCreateFloor() {
    setFloorMode('create');
    setEditingFloorId(null);
    setFloorError('');
    setFloorForm({ floor_number: '', name: '', description: '', is_active: true });
    setFloorFormOpen(true);
  }

  function openEditFloor(floor) {
    setFloorMode('edit');
    setEditingFloorId(floor.id);
    setFloorError('');
    setFloorForm({
      floor_number: floor.floor_number ?? '',
      name: floor.name ?? '',
      description: floor.description ?? '',
      is_active: floor.is_active !== false,
    });
    setFloorFormOpen(true);
  }

  async function saveFloor() {
    setFloorError('');
    if (!floorForm.name?.trim() || floorForm.floor_number === '') {
      setFloorError('Floor number and name are required.');
      return;
    }
    const payload = {
      floor_number: Number(floorForm.floor_number),
      name: floorForm.name.trim(),
      description: floorForm.description.trim(),
      is_active: Boolean(floorForm.is_active),
    };
    try {
      if (floorMode === 'create') {
        await floorMut.create.mutateAsync(payload);
        showToast({ type: 'success', message: 'Floor created' });
      } else {
        await floorMut.patch.mutateAsync({ id: editingFloorId, payload });
        showToast({ type: 'success', message: 'Floor updated' });
      }
      setFloorFormOpen(false);
    } catch (e) {
      setFloorError(getErrorMessage(e, 'Failed to save floor'));
    }
  }

  function openCreateRoom(initialFloorId = '') {
    setRoomMode('create');
    setEditingRoomId(null);
    setRoomError('');
    setRoomForm({
      floor: initialFloorId || '',
      name: '',
      room_number: '',
      room_type: 'ward',
      is_ac: false,
      daily_charge: '',
      max_beds: '',
      is_active: true,
      notes: '',
    });
    setRoomFormOpen(true);
  }

  function openEditRoom(room) {
    setRoomMode('edit');
    setEditingRoomId(room.id);
    setRoomError('');
    setRoomForm({
      floor: room.floor ?? '',
      name: room.name ?? '',
      room_number: room.room_number ?? '',
      room_type: room.room_type ?? 'ward',
      is_ac: room.is_ac === true,
      daily_charge: room.daily_charge ?? '',
      max_beds: room.max_beds ?? '',
      is_active: room.is_active !== false,
      notes: room.notes ?? '',
    });
    setRoomFormOpen(true);
  }

  async function saveRoom() {
    setRoomError('');
    if (!roomForm.floor || !roomForm.name?.trim() || !roomForm.room_number?.trim()) {
      setRoomError('Floor, room number, and room name are required.');
      return;
    }
    const maxBeds = Number(roomForm.max_beds);
    const dailyCharge = Number(roomForm.daily_charge);
    if (!Number.isFinite(maxBeds) || maxBeds < 1) {
      setRoomError('Max beds must be at least 1.');
      return;
    }
    if (!Number.isFinite(dailyCharge) || dailyCharge < 0) {
      setRoomError('Daily charge cannot be negative.');
      return;
    }
    const payload = {
      floor: roomForm.floor,
      name: roomForm.name.trim(),
      room_number: roomForm.room_number.trim(),
      room_type: roomForm.room_type,
      is_ac: Boolean(roomForm.is_ac),
      daily_charge: dailyCharge,
      max_beds: maxBeds,
      is_active: Boolean(roomForm.is_active),
      notes: roomForm.notes.trim(),
    };
    try {
      if (roomMode === 'create') {
        await roomMut.create.mutateAsync(payload);
        showToast({ type: 'success', message: 'Room created' });
      } else {
        await roomMut.patch.mutateAsync({ id: editingRoomId, payload });
        showToast({ type: 'success', message: 'Room updated' });
      }
      setRoomFormOpen(false);
    } catch (e) {
      setRoomError(getErrorMessage(e, 'Failed to save room'));
    }
  }

  function openCreateBed(initialRoomId = '') {
    setBedMode('create');
    setEditingBedId(null);
    setBedError('');
    setBedForm({
      room: initialRoomId || '',
      bed_code: '',
      bed_number: '',
      status: 'available',
      notes: '',
    });
    setBedFormOpen(true);
  }

  function openEditBed(bed) {
    setBedMode('edit');
    setEditingBedId(bed.id);
    setBedError('');
    setBedForm({
      room: bed.room ?? '',
      bed_code: bed.bed_code ?? '',
      bed_number: bed.bed_number ?? '',
      status: bed.status ?? 'available',
      notes: bed.notes ?? '',
    });
    setBedFormOpen(true);
  }

  async function saveBed() {
    setBedError('');
    if (!bedForm.room || !bedForm.bed_code?.trim() || bedForm.bed_number === '') {
      setBedError('Room, bed code, and bed number are required.');
      return;
    }
    const payload = {
      room: bedForm.room,
      bed_code: bedForm.bed_code.trim(),
      bed_number: String(bedForm.bed_number).trim(),
      status: bedForm.status,
      notes: bedForm.notes.trim(),
    };
    try {
      if (bedMode === 'create') {
        await bedMut.create.mutateAsync(payload);
        showToast({ type: 'success', message: 'Bed created' });
      } else {
        await bedMut.patch.mutateAsync({ id: editingBedId, payload });
        showToast({ type: 'success', message: 'Bed updated' });
      }
      setBedFormOpen(false);
    } catch (e) {
      setBedError(getErrorMessage(e, 'Failed to save bed'));
    }
  }

  function openDelete(type, row) {
    setDeleteError('');
    setDeleteTarget({ type, id: row.id, name: row.name || row.bed_code || row.room_number || String(row.id) });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      if (deleteTarget.type === 'floor') await floorMut.remove.mutateAsync(deleteTarget.id);
      if (deleteTarget.type === 'room') await roomMut.remove.mutateAsync(deleteTarget.id);
      if (deleteTarget.type === 'bed') await bedMut.remove.mutateAsync(deleteTarget.id);
      showToast({
        type: 'success',
        message: `${deleteTarget.type[0].toUpperCase()}${deleteTarget.type.slice(1)} deleted`,
      });
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(getErrorMessage(e, 'Delete failed'));
    }
  }

  /* ── Cleaning beds for fast-clean dropdown ─────────────────────────── */
  const cleaningBeds = useMemo(() => {
    const list = [];
    for (const floor of floorsList) {
      for (const room of floor.rooms || []) {
        for (const bed of room.beds || []) {
          if (bed.status === 'cleaning') {
            list.push({ ...bed, room_name: room.name, floor_name: floor.name });
          }
        }
      }
    }
    return list;
  }, [floorsList]);

  function handleFloorExpand(floorId) {
    setExpandedFloors((prev) =>
      prev.includes(floorId) ? prev.filter((id) => id !== floorId) : [...prev, floorId]
    );
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load bed data: {error?.message || 'Unknown error'}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={1.5}
      >
        <Typography variant="h5" fontWeight={700}>
          Bed Management
        </Typography>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap alignItems="center">
          {canManage && (
            <>
              <AppButton variant="contained" startIcon={<AddIcon />} onClick={openCreateFloor}>
                Add Floor
              </AppButton>
              <AppButton variant="outlined" startIcon={<AddIcon />} onClick={() => openCreateRoom()}>
                Add Room
              </AppButton>
              <AppButton variant="outlined" startIcon={<AddIcon />} onClick={() => openCreateBed()}>
                Add Bed
              </AppButton>
            </>
          )}
          {canManage && (
            <AppButton
              variant="outlined"
              startIcon={<CleaningServicesOutlinedIcon />}
              onClick={openFastClean}
              disabled={cleaningBeds.length === 0}
            >
              Fast Clean
            </AppButton>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.25,
              py: 0.25,
              border: 1,
              borderColor: 'primary.main',
              borderRadius: '999px',
              bgcolor: 'rgba(25, 118, 210, 0.06)',
              ml: { xs: 0, md: 'auto' },
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: bedLabelMode === 'bed_code' ? 700 : 500,
                color: bedLabelMode === 'bed_code' ? 'primary.main' : 'text.secondary',
                fontSize: '0.75rem',
                lineHeight: 1.2,
                userSelect: 'none',
              }}
            >
              bed code
            </Typography>
            <Switch
              size="small"
              checked={bedLabelMode === 'bed_number'}
              onChange={(e) => handleBedLabelToggle(e.target.checked)}
              disabled={labelModeLoading || labelModeSaving}
              sx={{ mx: -0.25 }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: bedLabelMode === 'bed_number' ? 700 : 500,
                color: bedLabelMode === 'bed_number' ? 'primary.main' : 'text.secondary',
                fontSize: '0.75rem',
                lineHeight: 1.2,
                userSelect: 'none',
              }}
            >
              bed number
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        <BedStats floors={floorsList} />
      </Box>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Stack
        direction="row"
        spacing={1.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
      >
        <TextField
          size="small"
          placeholder="Search bed code, room, floor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Room Type</InputLabel>
          <Select
            value={roomTypeFilter}
            label="Room Type"
            onChange={(e) => setRoomTypeFilter(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            {Object.entries(ROOM_TYPE_META).map(([value, meta]) => (
              <MenuItem key={value} value={value}>
                {meta.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* ── Floor Accordion ─────────────────────────────────────────────── */}
      {filteredFloors.length === 0 ? (
        <Alert severity="info">
          {floorsList.length === 0
            ? 'No floors configured. Run seed_beds in the backend first.'
            : 'No beds match the current filters.'}
        </Alert>
      ) : (
        filteredFloors.map((floor) => {
          const floorId = floor.id;
          const isExpanded = expandedFloors.includes(floorId);
          return (
            <Accordion
              key={floorId}
              expanded={isExpanded}
              onChange={() => handleFloorExpand(floorId)}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, pr: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {floor.name}
                  </Typography>
                  <Chip
                    label={`${floor.available_beds || 0} free`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    / {floor.total_beds || 0} total
                  </Typography>
                  {canManage && (
                    <Stack direction="row" spacing={0.75} sx={{ ml: 'auto' }}>
                      <IconButton
                        size="small"
                        title="Add room"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateRoom(floor.id);
                        }}
                      >
                        <AddIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Edit floor"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditFloor(floor);
                        }}
                      >
                        <EditOutlinedIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        title="Delete floor"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete('floor', floor);
                        }}
                      >
                        <DeleteOutlinedIcon fontSize="inherit" />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                {(floor.rooms || []).length === 0 ? (
                  <Alert severity="info">No rooms match current filters on this floor.</Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {(floor.rooms || []).map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onBedClick={handleBedClick}
                      statusFilter={statusFilter}
                      canManage={canManage}
                      onEditRoom={openEditRoom}
                      onDeleteRoom={(r) => openDelete('room', r)}
                      onEditBed={openEditBed}
                      onDeleteBed={(b) => openDelete('bed', b)}
                    />
                    ))}
                  </Stack>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

      {/* ── Cleaning Tasks Section ──────────────────────────────────────── */}
      {cleaningTasks.length > 0 && (
        <Box mt={3}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" fontWeight={700} mb={1}>
            <CleaningServicesOutlinedIcon
              fontSize="small"
              sx={{ verticalAlign: 'middle', mr: 0.5 }}
            />
            Active Cleaning Tasks ({cleaningTasks.length})
          </Typography>
          {cleaningTasks.map((task) => (
            <CleaningTaskRow
              key={task.id}
              task={task}
              onStart={handleStartTask}
              onComplete={handleCompleteTask}
            />
          ))}
        </Box>
      )}

      {/* ── Status Change Dialog ────────────────────────────────────────── */}
      <AppDialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        title={selectedBed ? `Bed ${selectedBed.bed_code}` : 'Change Bed Status'}
        actions={
          <>
            <AppButton variant="outlined" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="contained"
              onClick={handleStatusSave}
              disabled={!newStatus || bedStatusMut.isPending}
            >
              {bedStatusMut.isPending ? 'Saving…' : 'Update Status'}
            </AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          {selectedRoom && (
            <Typography variant="body2" color="text.secondary">
              Room: {selectedRoom.name} · {ROOM_TYPE_META[selectedRoom.room_type]?.label || selectedRoom.room_type}
              {selectedRoom.is_ac ? ' · AC' : ''} · ₹{Number(selectedRoom.daily_charge || 0).toLocaleString()}/day
            </Typography>
          )}
          {selectedBed && (
            <Typography variant="body2">
              Current status:{' '}
              <Chip
                label={BED_STATUS_META[selectedBed.status]?.label || selectedBed.status}
                color={BED_STATUS_META[selectedBed.status]?.color || 'default'}
                size="small"
              />
            </Typography>
          )}
          <FormControl size="small" fullWidth>
            <InputLabel>New Status</InputLabel>
            <Select
              value={newStatus}
              label="New Status"
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Notes (optional)"
            multiline
            rows={2}
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
          />
          {statusError && <Alert severity="error">{statusError}</Alert>}
        </Stack>
      </AppDialog>

      {/* ── Fast Clean Dialog ───────────────────────────────────────────── */}
      <AppDialog
        open={fastCleanOpen}
        onClose={() => setFastCleanOpen(false)}
        title="Fast Clean Bed"
        maxWidth="sm"
        actions={
          <>
            <AppButton
              variant="outlined"
              onClick={() => handleFastClean(false)}
              disabled={fastCleanMut.isPending || !fastCleanBedId}
            >
              Assign Only
            </AppButton>
            <AppButton
              variant="contained"
              color="success"
              onClick={() => handleFastClean(true)}
              disabled={fastCleanMut.isPending || !fastCleanBedId}
            >
              Clean & Mark Available
            </AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Cleaning Bed</InputLabel>
            <Select
              value={fastCleanBedId}
              label="Cleaning Bed"
              onChange={(e) => setFastCleanBedId(e.target.value)}
            >
              <MenuItem value="">
                <em>Select cleaning bed…</em>
              </MenuItem>
              {cleaningBeds.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.bed_code} · {b.room_name} · {b.floor_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Assign Staff</InputLabel>
            <Select
              value={fastStaffId}
              label="Assign Staff"
              onChange={(e) => setFastStaffId(e.target.value)}
            >
              <MenuItem value="">
                <em>Auto-assign</em>
              </MenuItem>
              {(housekeepers || []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.employee_code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Notes"
            multiline
            rows={2}
            value={fastNotes}
            onChange={(e) => setFastNotes(e.target.value)}
            placeholder="Urgent bed turnover requested…"
          />
        </Stack>
      </AppDialog>

      {/* ── Floor Form Dialog ──────────────────────────────────────────── */}
      <AppDialog
        open={floorFormOpen}
        onClose={() => setFloorFormOpen(false)}
        title={floorMode === 'create' ? 'Add Floor' : 'Edit Floor'}
        actions={
          <>
            <AppButton onClick={() => setFloorFormOpen(false)}>Cancel</AppButton>
            <AppButton
              variant="contained"
              onClick={saveFloor}
              disabled={floorMut.create.isPending || floorMut.patch.isPending}
            >
              {floorMut.create.isPending || floorMut.patch.isPending ? 'Saving…' : 'Save'}
            </AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          {floorError ? <Alert severity="error">{floorError}</Alert> : null}
          <TextField
            size="small"
            type="number"
            label="Floor Number"
            value={floorForm.floor_number}
            onChange={(e) => setFloorForm((p) => ({ ...p, floor_number: e.target.value }))}
          />
          <TextField
            size="small"
            label="Floor Name"
            value={floorForm.name}
            onChange={(e) => setFloorForm((p) => ({ ...p, name: e.target.value }))}
          />
          <TextField
            size="small"
            label="Description"
            multiline
            rows={2}
            value={floorForm.description}
            onChange={(e) => setFloorForm((p) => ({ ...p, description: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Switch
                checked={floorForm.is_active}
                onChange={(_, checked) => setFloorForm((p) => ({ ...p, is_active: checked }))}
              />
            }
            label="Active"
          />
        </Stack>
      </AppDialog>

      {/* ── Room Form Dialog ───────────────────────────────────────────── */}
      <AppDialog
        open={roomFormOpen}
        onClose={() => setRoomFormOpen(false)}
        title={roomMode === 'create' ? 'Add Room' : 'Edit Room'}
        maxWidth="sm"
        actions={
          <>
            <AppButton onClick={() => setRoomFormOpen(false)}>Cancel</AppButton>
            <AppButton
              variant="contained"
              onClick={saveRoom}
              disabled={roomMut.create.isPending || roomMut.patch.isPending}
            >
              {roomMut.create.isPending || roomMut.patch.isPending ? 'Saving…' : 'Save'}
            </AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          {roomError ? <Alert severity="error">{roomError}</Alert> : null}
          <FormControl size="small" fullWidth>
            <InputLabel>Floor</InputLabel>
            <Select
              value={roomForm.floor}
              label="Floor"
              onChange={(e) => setRoomForm((p) => ({ ...p, floor: e.target.value }))}
            >
              {floorRows.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.name} (#{f.floor_number})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Room Name"
            value={roomForm.name}
            onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))}
          />
          <TextField
            size="small"
            label="Room Number"
            value={roomForm.room_number}
            onChange={(e) => setRoomForm((p) => ({ ...p, room_number: e.target.value }))}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Room Type</InputLabel>
            <Select
              value={roomForm.room_type}
              label="Room Type"
              onChange={(e) => setRoomForm((p) => ({ ...p, room_type: e.target.value }))}
            >
              {Object.entries(ROOM_TYPE_META).map(([value, meta]) => (
                <MenuItem key={value} value={value}>
                  {meta.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="number"
            label="Daily Charge (Price)"
            value={roomForm.daily_charge}
            onChange={(e) => setRoomForm((p) => ({ ...p, daily_charge: e.target.value }))}
          />
          <TextField
            size="small"
            type="number"
            label="Max Beds"
            value={roomForm.max_beds}
            onChange={(e) => setRoomForm((p) => ({ ...p, max_beds: e.target.value }))}
          />
          <TextField
            size="small"
            label="Notes"
            multiline
            rows={2}
            value={roomForm.notes}
            onChange={(e) => setRoomForm((p) => ({ ...p, notes: e.target.value }))}
          />
          <Stack direction="row" spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={roomForm.is_ac}
                  onChange={(_, checked) => setRoomForm((p) => ({ ...p, is_ac: checked }))}
                />
              }
              label="AC Room"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={roomForm.is_active}
                  onChange={(_, checked) => setRoomForm((p) => ({ ...p, is_active: checked }))}
                />
              }
              label="Active"
            />
          </Stack>
        </Stack>
      </AppDialog>

      {/* ── Bed Form Dialog ────────────────────────────────────────────── */}
      <AppDialog
        open={bedFormOpen}
        onClose={() => setBedFormOpen(false)}
        title={bedMode === 'create' ? 'Add Bed' : 'Edit Bed'}
        maxWidth="sm"
        actions={
          <>
            <AppButton onClick={() => setBedFormOpen(false)}>Cancel</AppButton>
            <AppButton
              variant="contained"
              onClick={saveBed}
              disabled={bedMut.create.isPending || bedMut.patch.isPending}
            >
              {bedMut.create.isPending || bedMut.patch.isPending ? 'Saving…' : 'Save'}
            </AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          {bedError ? <Alert severity="error">{bedError}</Alert> : null}
          <FormControl size="small" fullWidth>
            <InputLabel>Room</InputLabel>
            <Select
              value={bedForm.room}
              label="Room"
              onChange={(e) => setBedForm((p) => ({ ...p, room: e.target.value }))}
            >
              {roomRows.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} ({r.room_number})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Bed Code"
            value={bedForm.bed_code}
            onChange={(e) => setBedForm((p) => ({ ...p, bed_code: e.target.value }))}
          />
          <TextField
            size="small"
            type="number"
            label="Bed Number"
            value={bedForm.bed_number}
            onChange={(e) => setBedForm((p) => ({ ...p, bed_number: e.target.value }))}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={bedForm.status}
              label="Status"
              onChange={(e) => setBedForm((p) => ({ ...p, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Notes"
            multiline
            rows={2}
            value={bedForm.notes}
            onChange={(e) => setBedForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </Stack>
      </AppDialog>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────── */}
      <AppDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.type || ''}`}
        actions={
          <>
            <AppButton onClick={() => setDeleteTarget(null)}>Cancel</AppButton>
            <AppButton
              variant="contained"
              color="error"
              onClick={confirmDelete}
              disabled={floorMut.remove.isPending || roomMut.remove.isPending || bedMut.remove.isPending}
            >
              {floorMut.remove.isPending || roomMut.remove.isPending || bedMut.remove.isPending ? 'Deleting…' : 'Delete'}
            </AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
          <Typography variant="body2">
            Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </Typography>
        </Stack>
      </AppDialog>
    </Box>
  );
}
