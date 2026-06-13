import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { OPD_CORE_FIELDS, normalizeOpdFieldConfig } from './opdCoreFields.js'
import { saveOpdFieldConfig } from './opdTemplateData.js'

export default function OpdCoreFieldsPanel({ initialConfig, onSaved, onClose }) {
  const [draft, setDraft] = useState(() => normalizeOpdFieldConfig(initialConfig))
  const [saving, setSaving] = useState(false)
  const rows = useMemo(() => normalizeOpdFieldConfig(draft), [draft])

  function patchField(key, patch) {
    setDraft((prev) => {
      const cfg = normalizeOpdFieldConfig(prev)
      const row = cfg[key] || {}
      return {
        ...cfg,
        [key]: { ...row, ...patch },
      }
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await saveOpdFieldConfig(draft)
      setDraft(saved)
      onSaved?.(saved)
      toast.success('Core fields saved')
    } catch (err) {
      const errors = err?.response?.data?.errors
      const detail = errors?.detail || errors?.opd_field_config?.[0]
      toast.error(detail ? String(detail) : 'Failed to save core fields')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="editor-values" style={{ marginTop: 8 }}>
      <p className="field-hint" style={{ marginBottom: 8 }}>
        Core fields sync to the slip layout automatically and control Create OPD form visibility.
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>
                <th style={{ paddingBottom: 6, paddingRight: 8 }}>Field</th>
                <th style={{ paddingBottom: 6, paddingRight: 8 }}>Create OPD</th>
                <th style={{ paddingBottom: 6, paddingRight: 8 }}>On slip</th>
                <th style={{ paddingBottom: 6, paddingRight: 8 }}>Show label</th>
                <th style={{ paddingBottom: 6 }}>Label text</th>
              </tr>
            </thead>
            <tbody>
              {OPD_CORE_FIELDS.map((row) => {
                const cfg = rows[row.key] || {}
                return (
                  <tr key={row.key} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '8px 8px 8px 0' }}>
                      <input
                        type="checkbox"
                        checked={cfg.createForm !== false}
                        onChange={(e) => patchField(row.key, { createForm: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: '8px 8px 8px 0' }}>
                      <input
                        type="checkbox"
                        checked={cfg.slip !== false}
                        onChange={(e) => patchField(row.key, { slip: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: '8px 8px 8px 0' }}>
                      <input
                        type="checkbox"
                        checked={cfg.showLabel !== false}
                        onChange={(e) => patchField(row.key, { showLabel: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: '8px 0' }}>
                      <input
                        type="text"
                        value={cfg.label || row.label}
                        onChange={(e) => patchField(row.key, { label: e.target.value })}
                        className="field"
                        style={{ width: '100%', margin: 0 }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="primary-btn" style={{ flex: 1 }} disabled={saving}>
            {saving ? 'Saving…' : 'Save core fields'}
          </button>
          {onClose ? (
            <button type="button" className="secondary-btn" style={{ flex: 1 }} onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
