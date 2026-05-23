// Minimal template editor logic: user-defined text fields only.
// Single layout, draggable black text boxes, JSON saved locally and optionally to backend.

// Internal coordinate system; aspect ratio close to A4 portrait.
const CANVAS_W = 1024;
const CANVAS_H = 1451;
const LOCAL_STORAGE_KEY = 'custom-editor-single-layout';

export function mountTemplateEditor(root) {
  if (!root) return () => {};

  const $ = (id) => root.querySelector(`#${id}`);
  const disposers = [];

  const on = (target, type, fn, opts) => {
    if (!target) return;
    target.addEventListener(type, fn, opts);
    disposers.push(() => {
      try {
        target.removeEventListener(type, fn, opts);
      } catch {
        // ignore
      }
    });
  };

  const canvasEl = $('editor-canvas');
  const bgImgEl = $('editor-bg');
  const bgInput = $('template-upload');
  const newFieldInput = $('new-field-name');
  const addFieldBtn = $('add-field-btn');
  const addNoteBtn = $('add-note-btn');
  const fieldErrorEl = $('field-error');
  const fieldListEl = $('field-list');
  const noteListEl = $('note-list');
  const saveLayoutBtn = $('save-layout-btn');
  const saveStatusEl = $('save-layout-status');
  const layoutJsonEl = $('layout-json');
  const copyBtn = $('copy-layout-btn');
  const copyStatusEl = $('copy-status');

  let isDragging = false;
  let dragBox = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Layout model:
  // fields: { [name]: { x, y, size } }
  // notes:  { [id]:   { x, y, size, text } }
  // backgroundDataUrl?: string
  // printOffsetX?: number, printOffsetY?: number (generator/print-only calibration in canvas units)
  let layout = {
    fields: {},
    notes: {},
    backgroundDataUrl: undefined,
  };

  function loadFromLocalStorage() {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Merge local fields / notes over whatever we already have (e.g. from backend)
        if (parsed.fields && typeof parsed.fields === 'object') {
          layout = {
            ...layout,
            fields: {
              ...(layout.fields || {}),
              ...parsed.fields,
            },
          };
        }
        if (parsed.notes && typeof parsed.notes === 'object') {
          layout = {
            ...layout,
            notes: {
              ...(layout.notes || {}),
              ...parsed.notes,
            },
          };
        }
        if (parsed.backgroundDataUrl) {
          layout.backgroundDataUrl = parsed.backgroundDataUrl;
        }
        if (typeof parsed.printOffsetX === 'number') {
          layout.printOffsetX = parsed.printOffsetX;
        }
        if (typeof parsed.printOffsetY === 'number') {
          layout.printOffsetY = parsed.printOffsetY;
        }
      }
    } catch {
      // ignore corrupted data
    }
  }

  function saveToLocalStorage() {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // ignore
    }
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function positionBoxesFromLayout() {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = rect.width / CANVAS_W;
    const scaleY = rect.height / CANVAS_H;

    const positionGroup = (selector, getCfg) => {
      const boxes = Array.from(canvasEl.querySelectorAll(selector));
      boxes.forEach((box) => {
        const cfg = getCfg(box);
        if (!cfg) return;
        const xCanvas = typeof cfg.x === 'number' ? cfg.x : CANVAS_W / 2;
        const yCanvas = typeof cfg.y === 'number' ? cfg.y : CANVAS_H / 2;
        let left = xCanvas * scaleX;
        let top = yCanvas * scaleY;
        const boxRect = box.getBoundingClientRect();
        const maxLeft = rect.width - boxRect.width;
        const maxTop = rect.height - boxRect.height;
        left = clamp(left, 0, maxLeft);
        top = clamp(top, 0, maxTop);
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
      });
    };

    positionGroup('.field-box.dynamic-field', (box) => {
      const name = box.dataset.field;
      return layout.fields[name];
    });

    positionGroup('.field-box.dynamic-note', (box) => {
      const id = box.dataset.note;
      return layout.notes[id];
    });
  }

  function updateLayoutFromBox(box) {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const left = boxRect.left - rect.left;
    const top = boxRect.top - rect.top;
    const xCanvas = clamp((left / rect.width) * CANVAS_W, 0, CANVAS_W);
    const yCanvas = clamp((top / rect.height) * CANVAS_H, 0, CANVAS_H);

    if (box.dataset.field) {
      const name = box.dataset.field;
      if (!layout.fields[name]) layout.fields[name] = {};
      layout.fields[name].x = Math.round(xCanvas);
      layout.fields[name].y = Math.round(yCanvas);
    } else if (box.dataset.note) {
      const id = box.dataset.note;
      if (!layout.notes[id]) layout.notes[id] = {};
      layout.notes[id].x = Math.round(xCanvas);
      layout.notes[id].y = Math.round(yCanvas);
    }
  }

  function updateJson() {
    if (!layoutJsonEl) return;
    const obj = { single: layout };
    layoutJsonEl.value = JSON.stringify(obj, null, 2);
    saveToLocalStorage();
  }

  function clearFieldError() {
    if (fieldErrorEl) fieldErrorEl.textContent = '';
  }

  function setFieldError(msg) {
    if (fieldErrorEl) fieldErrorEl.textContent = msg;
  }

  function renderFieldList() {
    if (!fieldListEl) return;
    const names = Object.keys(layout.fields || {});
    if (!names.length) {
      fieldListEl.innerHTML = '<p class=\"field-hint\">No fields yet. Add one above.</p>';
      return;
    }
    const html = names
      .map((name) => {
        const size = layout.fields[name]?.size ?? 13;
        return `
          <div class="value-row">
            <span>${name}</span>
            <div class="value-row-controls">
              <button type="button" class="size-toggle" data-field-edit="${name}">✎</button>
              <button type="button" class="size-toggle" data-field-up="${name}">↑</button>
              <button type="button" class="size-toggle" data-field-down="${name}">↓</button>
              <input type="number" class="field-size-input" data-field-size="${name}" min="8" max="72" step="1" value="${size}">
              <button type="button" class="size-toggle" data-remove-field="${name}">×</button>
            </div>
          </div>`;
      })
      .join('');
    fieldListEl.innerHTML = html;

    fieldListEl.querySelectorAll('[data-remove-field]').forEach((btn) => {
      const fieldName = btn.getAttribute('data-remove-field');
      on(btn, 'click', () => {
        delete layout.fields[fieldName];
        const box = canvasEl && canvasEl.querySelector(`.field-box.dynamic-field[data-field=\"${CSS.escape(fieldName)}\"]`);
        if (box && box.parentElement) box.parentElement.removeChild(box);
        renderFieldList();
        updateJson();
      });
    });

    // Edit field name
    fieldListEl.querySelectorAll('[data-field-edit]').forEach((btn) => {
      const fieldName = btn.getAttribute('data-field-edit');
      on(btn, 'click', () => {
        const current = fieldName;
        const next = window.prompt('Edit field name', current);
        if (!next || next === current) return;
        if (!layout.fields[current]) return;
        if (layout.fields[next]) {
          setFieldError('A field with that name already exists.');
          return;
        }
        const cfg = layout.fields[current];
        delete layout.fields[current];
        layout.fields[next] = cfg;
        const box =
          canvasEl &&
          canvasEl.querySelector(`.field-box.dynamic-field[data-field="${CSS.escape(current)}"]`);
        if (box) {
          box.dataset.field = next;
          box.textContent = next;
        }
        renderFieldList();
        updateJson();
      });
    });

    // Reorder fields (up/down)
    const reorder = (order) => {
      const next = {};
      order.forEach((key) => {
        if (layout.fields[key]) next[key] = layout.fields[key];
      });
      layout.fields = next;
    };

    fieldListEl.querySelectorAll('[data-field-up]').forEach((btn) => {
      const name = btn.getAttribute('data-field-up');
      on(btn, 'click', () => {
        const order = Object.keys(layout.fields || {});
        const idx = order.indexOf(name);
        if (idx <= 0) return;
        [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
        reorder(order);
        renderFieldList();
        updateJson();
      });
    });

    fieldListEl.querySelectorAll('[data-field-down]').forEach((btn) => {
      const name = btn.getAttribute('data-field-down');
      on(btn, 'click', () => {
        const order = Object.keys(layout.fields || {});
        const idx = order.indexOf(name);
        if (idx === -1 || idx >= order.length - 1) return;
        [order[idx + 1], order[idx]] = [order[idx], order[idx + 1]];
        reorder(order);
        renderFieldList();
        updateJson();
      });
    });

    // Hook size inputs
    fieldListEl.querySelectorAll('[data-field-size]').forEach((input) => {
      const fieldName = input.getAttribute('data-field-size');
      on(input, 'input', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v) || v <= 0) return;
        if (!layout.fields[fieldName]) layout.fields[fieldName] = {};
        layout.fields[fieldName].size = v;
        const box =
          canvasEl &&
          canvasEl.querySelector(`.field-box.dynamic-field[data-field="${CSS.escape(fieldName)}"]`);
        if (box) {
          box.style.fontSize = toCqw(v);
        }
        updateJson();
      });
    });
  }

  // Convert stored px size to cqw so the font scales with the canvas,
  // matching the proportional sizing used in the generator/print view.
  // 600 = the CSS canvas display width in px (reference width).
  const toCqw = (px) => `${(px / 600 * 100).toFixed(4)}cqw`;

  function createBoxElement(name) {
    if (!canvasEl) return null;
    const box = document.createElement('div');
    box.className = 'field-box dynamic-field';
    box.dataset.field = name;
    box.textContent = name;
    const size = layout.fields[name]?.size ?? 13;
    box.style.fontSize = toCqw(size);
    canvasEl.appendChild(box);
    return box;
  }

  function createNoteElement(id) {
    if (!canvasEl) return null;
    const box = document.createElement('div');
    box.className = 'field-box dynamic-note';
    box.dataset.note = id;
    const cfg = layout.notes[id] || {};
    const size = cfg.size ?? 11;
    const text = cfg.text || '';
    box.textContent = text;
    box.style.fontSize = toCqw(size);
    canvasEl.appendChild(box);
    return box;
  }

  function renderBoxesFromLayout() {
    if (!canvasEl) return;
    canvasEl
      .querySelectorAll('.field-box.dynamic-field, .field-box.dynamic-note')
      .forEach((el) => el.remove());
    Object.keys(layout.fields || {}).forEach((name) => {
      createBoxElement(name);
    });
    Object.keys(layout.notes || {}).forEach((id) => {
      createNoteElement(id);
    });
    // After creating, position them
    positionBoxesFromLayout();
  }

  function addField() {
    if (!newFieldInput) return;
    const raw = newFieldInput.value.trim();
    if (!raw) {
      setFieldError('Enter a field name.');
      return;
    }
    const name = raw;
    if (!layout.fields) layout.fields = {};
    if (layout.fields[name]) {
      setFieldError('Field already exists.');
      return;
    }
    clearFieldError();
    layout.fields[name] = { x: CANVAS_W / 2, y: CANVAS_H / 2, size: 13 };
    const box = createBoxElement(name);
    // Position center before drag
    positionBoxesFromLayout();
    if (box) {
      // small nudge so user sees it
      box.focus?.();
    }
    renderFieldList();
    updateJson();
    newFieldInput.value = '';
  }

  function renderNoteList() {
    if (!noteListEl) return;
    const ids = Object.keys(layout.notes || {});
    if (!ids.length) {
      noteListEl.innerHTML = '<p class="field-hint">No notes yet. Add one above.</p>';
      return;
    }
    const html = ids
      .map((id) => {
        const cfg = layout.notes[id] || {};
        const size = cfg.size ?? 11;
        const text = (cfg.text || '').replace(/"/g, '&quot;');
        return `
          <div class="value-row">
            <span>${text || '(empty note)'}</span>
            <div class="value-row-controls">
              <button type="button" class="size-toggle" data-note-edit="${id}">✎</button>
              <button type="button" class="size-toggle" data-note-up="${id}">↑</button>
              <button type="button" class="size-toggle" data-note-down="${id}">↓</button>
              <input type="number" class="field-size-input" data-note-size="${id}" min="8" max="72" step="1" value="${size}">
              <button type="button" class="size-toggle" data-remove-note="${id}">×</button>
            </div>
          </div>`;
      })
      .join('');
    noteListEl.innerHTML = html;

    // Remove
    noteListEl.querySelectorAll('[data-remove-note]').forEach((btn) => {
      const id = btn.getAttribute('data-remove-note');
      on(btn, 'click', () => {
        delete layout.notes[id];
        const box =
          canvasEl &&
          canvasEl.querySelector(`.field-box.dynamic-note[data-note="${CSS.escape(id)}"]`);
        if (box && box.parentElement) box.parentElement.removeChild(box);
        renderNoteList();
        updateJson();
      });
    });

    // Edit text
    noteListEl.querySelectorAll('[data-note-edit]').forEach((btn) => {
      const id = btn.getAttribute('data-note-edit');
      on(btn, 'click', () => {
        const cfg = layout.notes[id] || {};
        const next = window.prompt('Edit note text', cfg.text || '') ?? cfg.text;
        if (next == null) return;
        layout.notes[id] = { ...cfg, text: next };
        const box =
          canvasEl &&
          canvasEl.querySelector(`.field-box.dynamic-note[data-note="${CSS.escape(id)}"]`);
        if (box) box.textContent = next;
        renderNoteList();
        updateJson();
      });
    });

    // Size
    noteListEl.querySelectorAll('[data-note-size]').forEach((input) => {
      const id = input.getAttribute('data-note-size');
      on(input, 'input', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v) || v <= 0) return;
        const cfg = layout.notes[id] || {};
        layout.notes[id] = { ...cfg, size: v };
        const box =
          canvasEl &&
          canvasEl.querySelector(`.field-box.dynamic-note[data-note="${CSS.escape(id)}"]`);
        if (box) {
          box.style.fontSize = toCqw(v);
        }
        updateJson();
      });
    });

    // Reorder notes (up/down)
    const reorder = (order) => {
      const next = {};
      order.forEach((id) => {
        if (layout.notes[id]) next[id] = layout.notes[id];
      });
      layout.notes = next;
    };

    noteListEl.querySelectorAll('[data-note-up]').forEach((btn) => {
      const id = btn.getAttribute('data-note-up');
      on(btn, 'click', () => {
        const order = Object.keys(layout.notes || {});
        const idx = order.indexOf(id);
        if (idx <= 0) return;
        [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
        reorder(order);
        renderNoteList();
        updateJson();
      });
    });

    noteListEl.querySelectorAll('[data-note-down]').forEach((btn) => {
      const id = btn.getAttribute('data-note-down');
      on(btn, 'click', () => {
        const order = Object.keys(layout.notes || {});
        const idx = order.indexOf(id);
        if (idx === -1 || idx >= order.length - 1) return;
        [order[idx + 1], order[idx]] = [order[idx], order[idx + 1]];
        reorder(order);
        renderNoteList();
        updateJson();
      });
    });
  }

  function addNote() {
    if (!newFieldInput) return;
    const raw = newFieldInput.value.trim();
    if (!raw) {
      setFieldError('Enter some text for the note.');
      return;
    }
    clearFieldError();
    if (!layout.notes) layout.notes = {};
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    layout.notes[id] = { text: raw, x: CANVAS_W / 2, y: CANVAS_H / 2, size: 11 };
    const box = createNoteElement(id);
    positionBoxesFromLayout();
    if (box) {
      box.focus?.();
    }
    renderNoteList();
    updateJson();
    newFieldInput.value = '';
  }

  function onMouseDown(e) {
    if (!(e.target instanceof HTMLElement)) return;
    const box = e.target.closest('.field-box.dynamic-field, .field-box.dynamic-note');
    if (!box) return;
    isDragging = true;
    dragBox = box;
    const rect = box.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging || !dragBox || !canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    let left = e.clientX - dragOffsetX - rect.left;
    let top = e.clientY - dragOffsetY - rect.top;
    const boxRect = dragBox.getBoundingClientRect();
    const maxLeft = rect.width - boxRect.width;
    const maxTop = rect.height - boxRect.height;
    left = clamp(left, 0, maxLeft);
    top = clamp(top, 0, maxTop);
    dragBox.style.left = `${left}px`;
    dragBox.style.top = `${top}px`;
    updateLayoutFromBox(dragBox);
  }

  function onMouseUp() {
    isDragging = false;
    dragBox = null;
    // Persist layout and JSON once at the end of the drag to keep dragging smooth.
    updateJson();
  }

  function setSaveStatus(msg, color) {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = msg;
    saveStatusEl.style.color = color || '';
  }

  async function saveLayoutToBackend() {
    try {
      const res = await fetch('/api/templates/update-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          key: 'single',
          layout,
        }),
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (res.ok && data.success) {
        setSaveStatus('Layout saved on server and locally.', '');
        window.dispatchEvent(new CustomEvent('opd-template-updated'));
      } else {
        const hint =
          data.error ||
          (res.status === 413
            ? 'Layout too large for the server. Use a smaller or compressed background image.'
            : `Save failed (HTTP ${res.status}). Layout is still saved locally.`);
        setSaveStatus(hint, '#b91c1c');
      }
    } catch (err) {
      setSaveStatus('Backend not reachable. Layout saved locally only.', '#b91c1c');
    }
  }

  // Wire up events
  on(canvasEl, 'mousedown', onMouseDown);
  on(window, 'mousemove', onMouseMove);
  on(window, 'mouseup', onMouseUp);
  on(window, 'resize', () => {
    positionBoxesFromLayout();
  });

  // Background image upload (stored as data URL for reuse on generator page)
  if (bgInput && bgImgEl) {
    on(bgInput, 'change', () => {
      const file = bgInput.files && bgInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) return;
        bgImgEl.src = dataUrl;
        layout.backgroundDataUrl = dataUrl;
        syncBackgroundImage();
        updateJson();
      };
      reader.readAsDataURL(file);
    });
  }

  if (addFieldBtn) {
    on(addFieldBtn, 'click', (e) => {
      e.preventDefault();
      addField();
    });
  }
  if (addNoteBtn) {
    on(addNoteBtn, 'click', (e) => {
      e.preventDefault();
      addNote();
    });
  }
  if (newFieldInput) {
    on(newFieldInput, 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addField();
      }
    });
  }

  if (saveLayoutBtn) {
    on(saveLayoutBtn, 'click', async (e) => {
      e.preventDefault();
      setSaveStatus('', '');
      saveToLocalStorage();
      setSaveStatus('Layout saved locally.', '');
      await saveLayoutToBackend();
    });
  }

  if (copyBtn && layoutJsonEl) {
    on(copyBtn, 'click', async () => {
      try {
        if (!layoutJsonEl.value) return;
        await navigator.clipboard.writeText(layoutJsonEl.value);
        if (copyStatusEl) copyStatusEl.textContent = 'Copied!';
      } catch {
        if (copyStatusEl)
          copyStatusEl.textContent = 'Could not copy. Select the JSON and copy manually.';
      }
    });
  }

  // Initial state: optional solid background so user sees canvas
  if (bgImgEl) {
    bgImgEl.style.background = '#ffffff';
  }

  function syncBackgroundImage() {
    if (bgImgEl) {
      if (layout.backgroundDataUrl) {
        bgImgEl.src = layout.backgroundDataUrl;
      } else {
        bgImgEl.removeAttribute('src');
      }
    }
    if (canvasEl) {
      canvasEl.classList.toggle(
        'opd-sheet--with-bg',
        !!(layout.backgroundDataUrl && String(layout.backgroundDataUrl).length > 0),
      );
    }
  }

  async function loadFromBackend() {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.templates) ? data.templates : [];
      const single = list.find((t) => t.key === 'single' && t.layout && t.layout.fields);
      if (single) {
        layout = {
          fields: { ...(single.layout.fields || {}) },
          notes: { ...(single.layout.notes || {}) },
          backgroundDataUrl: single.layout.backgroundDataUrl || layout.backgroundDataUrl,
        };
        // also keep a copy in localStorage so it survives backend restarts
        saveToLocalStorage();
      }
    } catch {
      // backend may be offline; we will rely on localStorage only
    }
  }

  // Load from backend (if available) then overlay local storage and render.
  (async () => {
    await loadFromBackend();
    loadFromLocalStorage();
    syncBackgroundImage();
    renderBoxesFromLayout();
    renderFieldList();
    renderNoteList();
    updateJson();
  })();

  return () => {
    disposers.forEach((d) => d());
  };
}

