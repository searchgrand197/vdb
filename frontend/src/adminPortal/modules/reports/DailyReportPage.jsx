import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import api from '@/api';
import { useAuth } from '@admin/context/AuthContext';
import { useToast } from '@admin/context/ToastContext';
import ReportsSection from '@/components/receptionist/ReportsSection';
import { getApiErrorMessage } from '@/utils/apiError';

export function DailyReportPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const hasHospital = Boolean(user?.hospital_id);

  const [receptionDailyReportEnabled, setReceptionDailyReportEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/settings/reception-portal/');
        const row = data?.data || data || {};
        if (!cancelled) {
          setReceptionDailyReportEnabled(row.reception_daily_report_enabled !== false);
        }
      } catch {
        // keep default enabled
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleReceptionDailyReportToggle(checked) {
    setSettingsSaving(true);
    try {
      await api.patch('/settings/reception-portal/', { reception_daily_report_enabled: checked });
      setReceptionDailyReportEnabled(checked);
      showToast({
        type: 'success',
        message: checked
          ? 'Reception daily report enabled'
          : 'Reception daily report disabled — visible on admin only',
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: getApiErrorMessage(err, 'Could not save daily report setting'),
      });
    } finally {
      setSettingsSaving(false);
    }
  }

  if (!hasHospital) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Daily Report
        </Typography>
        <Alert severity="warning">
          Your account is not linked to a hospital. Daily report is only available for hospital admins
          with a hospital assigned.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 2, shrink: 0 }}>
        <BarChartOutlinedIcon color="primary" sx={{ fontSize: 36, mt: 0.5 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>
            Daily Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            Hospital-wide collection report with filters, charts, CSV export, and print. Toggle below
            controls whether reception staff also see this report.
          </Typography>
        </Box>
      </Stack>

      <Card variant="outlined" sx={{ mb: 2, shrink: 0 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={receptionDailyReportEnabled}
                onChange={(e) => handleReceptionDailyReportToggle(e.target.checked)}
                disabled={settingsLoading || settingsSaving}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Reception daily report
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  When on, reception staff see Daily Report in their sidebar. When off, this report
                  is available here in the admin panel only.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', m: 0 }}
          />
        </CardContent>
      </Card>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ReportsSection />
      </Box>
    </Box>
  );
}
