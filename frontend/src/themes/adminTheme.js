import { createTheme } from '@mui/material/styles';
import { baseTheme } from './baseTheme';

/** Admin portal — professional blue */
export const adminTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    primary: { main: '#1565c0', light: '#e3f2fd', dark: '#0d47a1' },
    secondary: { main: '#00838f', light: '#e0f7fa', dark: '#006064' },
  },
});
