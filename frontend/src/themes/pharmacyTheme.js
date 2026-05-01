import { createTheme } from '@mui/material/styles';
import { baseTheme } from './baseTheme';

/** Pharmacy portal — emerald green */
export const pharmacyTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    primary: { main: '#10b981', light: '#d1fae5', dark: '#047857' },
    secondary: { main: '#14b8a6', light: '#ccfbf1', dark: '#0f766e' },
  },
});
