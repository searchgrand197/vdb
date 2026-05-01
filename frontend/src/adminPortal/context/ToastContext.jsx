// Re-export from shared component library for consistency across all portals.
// Admin modules import { useToast, ToastProvider } from here — no changes needed in those files.
export { AppToastProvider as ToastProvider, useToast } from '@/components/AppSnackbar';
