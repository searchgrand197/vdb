import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';

const MENU_MAX_HEIGHT = 280;

const DEFAULT_MENU_PROPS = {
  disableScrollLock: true,
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  slotProps: {
    paper: {
      style: { maxHeight: MENU_MAX_HEIGHT },
      sx: { maxHeight: MENU_MAX_HEIGHT },
    },
    list: {
      sx: {
        maxHeight: MENU_MAX_HEIGHT,
        overflowY: 'auto',
      },
    },
  },
};

function mergeMenuProps(menuProps) {
  if (!menuProps) {
    return DEFAULT_MENU_PROPS;
  }

  return {
    ...DEFAULT_MENU_PROPS,
    ...menuProps,
    slotProps: {
      ...DEFAULT_MENU_PROPS.slotProps,
      ...menuProps.slotProps,
      paper: {
        ...DEFAULT_MENU_PROPS.slotProps.paper,
        ...menuProps.slotProps?.paper,
        style: {
          ...DEFAULT_MENU_PROPS.slotProps.paper.style,
          ...menuProps.slotProps?.paper?.style,
        },
        sx: {
          ...DEFAULT_MENU_PROPS.slotProps.paper.sx,
          ...menuProps.slotProps?.paper?.sx,
        },
      },
      list: {
        ...DEFAULT_MENU_PROPS.slotProps.list,
        ...menuProps.slotProps?.list,
        sx: {
          ...DEFAULT_MENU_PROPS.slotProps.list.sx,
          ...menuProps.slotProps?.list?.sx,
        },
      },
    },
  };
}

/**
 * Controlled MUI Select wrapper for react-hook-form Controller.
 * Rounded corners, consistent sizing.
 */
export function AppSelect({
  label,
  id,
  children,
  error,
  helperText,
  fullWidth = true,
  size = 'small',
  MenuProps,
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
      <Select
        labelId={labelId}
        label={label}
        id={id}
        MenuProps={mergeMenuProps(MenuProps)}
        {...selectProps}
      >
        {children}
      </Select>
      {(error || helperText) && <FormHelperText>{error?.message || helperText}</FormHelperText>}
    </FormControl>
  );
}