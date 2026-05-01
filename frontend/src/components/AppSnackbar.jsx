import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

/**
 * Toast notification provider using MUI Snackbar.
 * Replaces react-hot-toast for consistent MUI styling.
 */
export function AppToastProvider({ children }) {
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' });

  const showToast = useCallback(({ type = 'info', message }) => {
    if (!message) return;
    setToast({ open: true, message, type });
  }, []);

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setToast((prev) => ({ ...prev, open: false }));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleClose} severity={toast.type} variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within AppToastProvider');
  return ctx;
}
