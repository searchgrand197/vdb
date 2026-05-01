import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';

/**
 * Controlled MUI Select wrapper for RHF (pass value + onChange from Controller).
 */
export function AppSelect({
  label,
  id,
  children,
  error,
  helperText,
  fullWidth = true,
  size = 'small',
  ...selectProps
}) {
  const labelId = id ? `${id}-label` : undefined;
  return (
    <FormControl fullWidth={fullWidth} size={size} error={Boolean(error)}>
      {label ? (
        <InputLabel id={labelId} sx={{ px: 0.5, backgroundColor: 'background.paper' }}>
          {label}
        </InputLabel>
      ) : null}
      <Select labelId={labelId} label={label} id={id} {...selectProps}>
        {children}
      </Select>
      {(error || helperText) && <FormHelperText>{error?.message || helperText}</FormHelperText>}
    </FormControl>
  );
}
