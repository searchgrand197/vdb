import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

/**
 * Generic dialog shell powered by MUI `Dialog`.
 * Pure UI: caller controls state and actions.
 */
export function CommonDialog({ open, onClose, title, children, actions, maxWidth = 'sm' }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}>
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent dividers>{children}</DialogContent>
      {actions ? <DialogActions className="px-3 pb-2">{actions}</DialogActions> : null}
    </Dialog>
  );
}

