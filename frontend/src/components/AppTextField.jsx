import { forwardRef } from 'react';
import TextField from '@mui/material/TextField';

/**
 * Themed text field — fullWidth by default, small size, rounded corners.
 * Supports react-hook-form register() ref.
 */
export const AppTextField = forwardRef(function AppTextField({ fullWidth = true, ...props }, ref) {
  const { ref: registerRef, ...rest } = props;
  return (
    <TextField
      inputRef={registerRef || ref}
      fullWidth={fullWidth}
      size="small"
      variant="outlined"
      {...rest}
    />
  );
});
