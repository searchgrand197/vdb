import { forwardRef } from 'react';
import TextField from '@mui/material/TextField';

/** MUI TextField with fullWidth by default; supports RHF `register()` ref on the input. */
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
