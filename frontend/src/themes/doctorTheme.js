import { createTheme } from '@mui/material/styles';
import { baseTheme } from './baseTheme';

/** Doctor portal — sky blue */
export const doctorTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    primary: { main: '#0ea5e9', light: '#e0f2fe', dark: '#0369a1' },
    secondary: { main: '#6366f1', light: '#eef2ff', dark: '#4338ca' },
  },
});
