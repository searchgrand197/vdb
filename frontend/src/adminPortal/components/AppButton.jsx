import { forwardRef } from 'react';
import Button from '@mui/material/Button';

/** Thin MUI Button wrapper — extend here for app-wide defaults. */
export const AppButton = forwardRef(function AppButton(props, ref) {
  return <Button ref={ref} disableElevation {...props} />;
});
