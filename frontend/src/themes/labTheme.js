import { createTheme } from '@mui/material/styles';
import { baseTheme } from './baseTheme';

/** Lab portal — cyan */
export const labTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    primary: { main: '#06b6d4', light: '#cffafe', dark: '#0e7490' },
    secondary: { main: '#0ea5e9', light: '#e0f2fe', dark: '#0369a1' },
  },
});
