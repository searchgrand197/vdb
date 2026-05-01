import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, MenuItem } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ADMIN_ROUTES } from '@/constants/routes';
import { createPatient } from '@/services/patientService';
import { patientFormSchema } from '@admin/modules/patients/patientSchema';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { AppSelect } from '@/components/AppSelect';

const defaultValues = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'Female',
  phone: '',
  status: 'active',
};

export function AddPatient() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(patientFormSchema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate(ADMIN_ROUTES.PATIENTS);
    },
  });

  const onSubmit = (values) => {
    mutation.mutate(values);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <AppButton
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(ADMIN_ROUTES.PATIENTS)}
        >
          Back
        </AppButton>
        <Typography variant="h5">Add patient</Typography>
      </Box>

      <Box sx={{ maxWidth: { lg: '66.67%' } }}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <AppTextField label="First name" {...register('firstName')} error={Boolean(errors.firstName)} helperText={errors.firstName?.message} />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <AppTextField label="Last name" {...register('lastName')} error={Boolean(errors.lastName)} helperText={errors.lastName?.message} />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <AppTextField
                label="Date of birth"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register('dateOfBirth')}
                error={Boolean(errors.dateOfBirth)}
                helperText={errors.dateOfBirth?.message}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <Controller
                name="gender"
                control={control}
                render={({ field, fieldState }) => (
                  <AppSelect label="Gender" id="gender" {...field} error={fieldState.error}>
                    <MenuItem value="Female">Female</MenuItem>
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </AppSelect>
                )}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <AppTextField label="Phone" {...register('phone')} error={Boolean(errors.phone)} helperText={errors.phone?.message} />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <Controller
                name="status"
                control={control}
                render={({ field, fieldState }) => (
                  <AppSelect label="Status" id="status" {...field} error={fieldState.error}>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </AppSelect>
                )}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <AppButton type="submit" variant="contained" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save patient'}
              </AppButton>
              <AppButton type="button" variant="outlined" onClick={() => navigate(ADMIN_ROUTES.PATIENTS)}>
                Cancel
              </AppButton>
            </Box>
            {mutation.isError ? (
              <Box>
                <Typography color="error" variant="body2">
                  {mutation.error?.message || 'Could not save patient'}
                </Typography>
              </Box>
            ) : null}
          </Box>
        </form>
      </Box>
    </Box>
  );
}
