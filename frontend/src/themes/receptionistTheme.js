import { createTheme } from '@mui/material/styles';
import { baseTheme } from './baseTheme';

/** Receptionist portal — purple */
export const receptionistTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    primary: { main: '#8b5cf6', light: '#f3e8ff', dark: '#6d28d9' },
    secondary: { main: '#ec4899', light: '#fce7f3', dark: '#be185d' },
  },
});
