import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import LocalPharmacyOutlined from '@mui/icons-material/LocalPharmacyOutlined';
import { useAuth } from '@admin/context/AuthContext';
import { useDesignationsQuery, useDesignationMutations } from '@/hooks/useDesignationsQuery';
import { fetchPharmacyBranches } from '@/services/pharmacyService';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@admin/context/ToastContext';
import { LOGIN_PORTALS } from '@/constants/loginPortals';
import { getApiErrorMessage } from '@/utils/apiError';

function designationOptionLabel(raw) {
  const name = raw?.name ?? '—';
  const code = raw?.code ?? '';
  return code ? `${name} (${code})` : name;
}

function normalizePortalSelection(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const portal of value) {
    const code = String(portal || '').trim().toLowerCase();
    if (!code || seen.has(code)) continue;
    if (!LOGIN_PORTALS.some((item) => item.value === code)) continue;
    seen.add(code);
    cleaned.push(code);
  }
  return cleaned;
}

function normalizePharmacyIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const id of value) {
    const key = String(id || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(key);
  }
  return cleaned;
}

export function DesignationPermissionsPage() {
  const { user } = useAuth();
  const canManage = Boolean(user?.is_superuser || user?.is_staff);
  const { showToast } = useToast();

  const [designationId, setDesignationId] = useState('');
  const [selectedPortals, setSelectedPortals] = useState([]);
  const [selectedPharmacyIds, setSelectedPharmacyIds] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [saveError, setSaveError] = useState('');

  const { data: designationsData, isLoading } = useDesignationsQuery();
  const { patch } = useDesignationMutations();

  const designations = designationsData?.data ?? [];
  const selectedDesignation = useMemo(
    () => designations.find((item) => String(item.id) === String(designationId)) || null,
    [designations, designationId]
  );

  const pharmacyPortalEnabled = selectedPortals.includes('pharmacy');

  useEffect(() => {
    let cancelled = false;
    setBranchesLoading(true);
    fetchPharmacyBranches()
      .then(({ data }) => {
        if (!cancelled) setBranches(data || []);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDesignation) {
      setSelectedPortals([]);
      setSelectedPharmacyIds([]);
      return;
    }
    setSelectedPortals(normalizePortalSelection(selectedDesignation.allowed_portals));
    setSelectedPharmacyIds(normalizePharmacyIds(selectedDesignation.allowed_pharmacy_ids));
  }, [selectedDesignation]);

  const togglePortal = (portalCode) => {
    if (!canManage) return;
    setSelectedPortals((current) => {
      const next = current.includes(portalCode)
        ? current.filter((code) => code !== portalCode)
        : [...current, portalCode];
      if (portalCode === 'pharmacy' && !next.includes('pharmacy')) {
        setSelectedPharmacyIds([]);
      }
      return next;
    });
  };

  const togglePharmacy = (pharmacyId) => {
    if (!canManage) return;
    const key = String(pharmacyId);
    setSelectedPharmacyIds((current) =>
      current.includes(key) ? current.filter((id) => id !== key) : [...current, key]
    );
  };

  const handleSave = async () => {
    if (!designationId) return;
    setSaveError('');
    try {
      const payload = {
        allowed_portals: selectedPortals,
        allowed_pharmacies: pharmacyPortalEnabled ? selectedPharmacyIds : [],
      };
      await patch.mutateAsync({
        id: designationId,
        payload,
      });
      showToast({ type: 'success', message: 'Portal access updated' });
    } catch (error) {
      setSaveError(getApiErrorMessage(error));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Portal access
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
          Choose which login portals staff with this designation may open. When Pharmacy is
          enabled, select which pharmacy branches they may use (leave all unchecked for every
          branch).
        </Typography>
      </Box>

      {!canManage ? (
        <Alert severity="info">Only administrators can change portal access.</Alert>
      ) : null}

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 3 }}>
        <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
          <InputLabel id="designation-portal-access-label">Designation</InputLabel>
          <Select
            labelId="designation-portal-access-label"
            label="Designation"
            value={designationId}
            onChange={(event) => setDesignationId(event.target.value)}
          >
            {designations.map((item) => (
              <MenuItem key={item.id} value={String(item.id)}>
                {designationOptionLabel(item)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {saveError ? <Alert severity="error">{saveError}</Alert> : null}

      {!designationId ? (
        <Alert severity="info">Select a designation to configure portal access.</Alert>
      ) : isLoading ? (
        <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Allowed login portals
          </Typography>
          <FormGroup>
            {LOGIN_PORTALS.map((portal) => (
              <FormControlLabel
                key={portal.value}
                control={
                  <Checkbox
                    checked={selectedPortals.includes(portal.value)}
                    disabled={!canManage || patch.isPending}
                    onChange={() => togglePortal(portal.value)}
                  />
                }
                label={portal.label}
              />
            ))}
          </FormGroup>

          {pharmacyPortalEnabled ? (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <LocalPharmacyOutlined fontSize="small" color="primary" />
                Pharmacy branches
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Staff with this designation may sign in only to the branches you select below.
                Leave all unchecked to allow every active branch.
              </Typography>

              {branchesLoading ? (
                <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : branches.length === 0 ? (
                <Alert severity="warning">No active pharmacy branches found.</Alert>
              ) : (
                <FormGroup>
                  {branches.map((branch) => (
                    <FormControlLabel
                      key={branch.id}
                      control={
                        <Checkbox
                          checked={selectedPharmacyIds.includes(String(branch.id))}
                          disabled={!canManage || patch.isPending}
                          onChange={() => togglePharmacy(branch.id)}
                        />
                      }
                      label={branch.label || branch.name}
                    />
                  ))}
                </FormGroup>
              )}
            </Box>
          ) : null}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <AppButton
              variant="contained"
              onClick={handleSave}
              disabled={!canManage || patch.isPending || !designationId}
            >
              {patch.isPending ? 'Saving…' : 'Save portal access'}
            </AppButton>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
