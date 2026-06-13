/**
 * Focus an RHF-registered field and scroll it into view (e.g. after server validation errors).
 * @param {string} fieldName
 * @param {(name: string, options?: { shouldSelect?: boolean }) => void} setFocus
 */
export function focusAndScrollToFormField(fieldName, setFocus) {
  setFocus(fieldName, { shouldSelect: false });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      let el = null;
      try {
        el = document.querySelector(`[name="${CSS.escape(fieldName)}"]`);
      } catch {
        el = document.querySelector(`[name="${fieldName}"]`);
      }
      if (!(el instanceof HTMLElement)) {
        const byId = document.getElementById(fieldName);
        if (byId instanceof HTMLElement) el = byId;
      }
      const focusable =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
          ? el
          : el?.querySelector?.('input:not([type=hidden]),textarea,select');
      const scrollTarget = focusable instanceof HTMLElement ? focusable : el;
      if (focusable instanceof HTMLElement) {
        focusable.focus();
      }
      scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });
  });
}
