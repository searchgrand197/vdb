import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Typography, MenuItem } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ADMIN_ROUTES } from '@/constants/routes';
import { createPatient } from '@/services/patientService';
import { patientFormSchema } from '@admin/modules/patients/patientSchema';
import { AppButton } from '@admin/components/AppButton';
import { AppTextField } from '@admin/components/AppTextField';
import { AppSelect } from '@admin/components/AppSelect';

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
    <div className="row g-3">
      <div className="col-12 d-flex align-items-center gap-2">
        <AppButton
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(ADMIN_ROUTES.PATIENTS)}
        >
          Back
        </AppButton>
        <Typography variant="h5">Add patient</Typography>
      </div>

      <div className="col-12 col-lg-8">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <AppTextField label="First name" {...register('firstName')} error={Boolean(errors.firstName)} helperText={errors.firstName?.message} />
            </div>
            <div className="col-12 col-md-6">
              <AppTextField label="Last name" {...register('lastName')} error={Boolean(errors.lastName)} helperText={errors.lastName?.message} />
            </div>
            <div className="col-12 col-md-6">
              <AppTextField
                label="Date of birth"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register('dateOfBirth')}
                error={Boolean(errors.dateOfBirth)}
                helperText={errors.dateOfBirth?.message}
              />
            </div>
            <div className="col-12 col-md-6">
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
            </div>
            <div className="col-12 col-md-6">
              <AppTextField label="Phone" {...register('phone')} error={Boolean(errors.phone)} helperText={errors.phone?.message} />
            </div>
            <div className="col-12 col-md-6">
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
            </div>
            <div className="col-12 d-flex gap-2 mt-2">
              <AppButton type="submit" variant="contained" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save patient'}
              </AppButton>
              <AppButton type="button" variant="outlined" onClick={() => navigate(ADMIN_ROUTES.PATIENTS)}>
                Cancel
              </AppButton>
            </div>
            {mutation.isError ? (
              <div className="col-12">
                <Typography color="error" variant="body2">
                  {mutation.error?.message || 'Could not save patient'}
                </Typography>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
