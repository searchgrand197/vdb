import { forwardRef } from 'react';
import Button from '@mui/material/Button';

/**
 * Themed button — rounded corners, no text transform, no elevation.
 * All portals use this for consistent button styling.
 * Change this file once → all buttons across the app update.
 */
export const AppButton = forwardRef(function AppButton(props, ref) {
  return <Button ref={ref} disableElevation {...props} />;
});
