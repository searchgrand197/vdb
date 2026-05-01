import { createTheme } from '@mui/material/styles';
import { baseTheme } from './baseTheme';

/** Staff portal — indigo */
export const staffTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    primary: { main: '#6366f1', light: '#eef2ff', dark: '#4338ca' },
    secondary: { main: '#8b5cf6', light: '#f3e8ff', dark: '#6d28d9' },
  },
});
