export const DISCHARGE_VITAL_FIELDS = ['bp', 'pulse', 'spo2', 'temp', 'weight', 'rbs']

export const DISCHARGE_NARRATIVE_FIELDS = [
  ['summary_notes', 'Discharge summary / overview', true],
  ['chief_complaints', 'Chief complaints', true],
  ['reason_for_admission', 'Reason for admission', true],
  ['diagnosis', 'Diagnosis', true],
  ['co_morbidities', 'Co-morbidities', true],
  ['medical_history', 'Medical history', true],
  ['family_history', 'Family history', true],
  ['personal_history', 'Personal history', true],
  ['physical_examination', 'Physical examination', true],
  ['allergies', 'Allergies', true],
  ['treatment_given', 'Treatment given', true],
]

export const DISCHARGE_COURSE_FIELDS = [
  ['course_in_hospital', 'Course in hospital', true],
  ['complications_during_stay', 'Complications', true],
  ['blood_transfusion_details', 'Blood transfusion', true],
  ['implants_used', 'Implants', true],
  ['indwelling_devices_on_discharge', 'Indwelling devices', true],
  ['vaccination_given', 'Vaccination', true],
]

export const DISCHARGE_ADVICE_FIELDS = [
  ['diet_advice', 'Diet', true],
  ['activity_advice', 'Activity', true],
  ['wound_care_instructions', 'Wound care', true],
  ['follow_up_advice', 'Follow-up advice', true],
  ['warning_signs', 'Warning signs', true],
]

export function emptyDischargeSummary() {
  return {
    summary_notes: '',
    treatment_given: '',
    condition_at_discharge: 'Stable',
    medications_on_discharge: '',
    follow_up_advice: '',
    reason_for_admission: '',
    diagnosis: '',
    allergies: '',
    procedure_surgery: '',
    medical_history: '',
    physical_examination: '',
    investigations: '',
    course_in_hospital: '',
    diet_advice: '',
    activity_advice: '',
    warning_signs: '',
    chief_complaints: '',
    co_morbidities: '',
    family_history: '',
    personal_history: '',
    complications_during_stay: '',
    blood_transfusion_details: '',
    implants_used: '',
    indwelling_devices_on_discharge: '',
    vaccination_given: '',
    wound_care_instructions: '',
    stitch_removal_date: '',
    vitals_at_discharge: { bp: '', pulse: '', spo2: '', temp: '', weight: '', rbs: '' },
    surgery_date: '',
    surgeon_name: '',
    assistant_name: '',
    anaesthetist_name: '',
    anaesthesia_type: '',
    operative_findings: '',
    intra_op_complications: '',
    discharge_date: '',
    discharge_time: '',
    discharge_type: 'routine',
    discharge_status: 'improved',
    mode_of_admission: 'opd',
    referred_to_facility: '',
    referral_reason: '',
    treating_consultant: '',
    consultant_registration_no: '',
    rmo_signed_by: '',
    next_follow_up_date: '',
    follow_up_doctor: '',
    follow_up_department: '',
    cause_of_death: '',
    time_of_death: '',
    notified_to: '',
    autopsy_required: false,
    abha_id: '',
    insurance_provider: '',
    tpa_name: '',
    policy_number: '',
    claim_number: '',
    patient_education_given: false,
    attendant_counselled_by: '',
    investigation_rows: [],
    surgery_rows: [],
  }
}

export function emptyDischargeSurgeryDraft() {
  return {
    surgery_date: '',
    procedure_name: '',
    surgeon_name: '',
    assistant_name: '',
    anaesthetist_name: '',
    anaesthesia_type: '',
    operative_findings: '',
    intra_op_complications: '',
  }
}

function isEmptyValue(value) {
  if (value == null) return true
  if (typeof value === 'boolean') return false
  if (typeof value === 'string') return !value.trim()
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    return Object.values(value).every((v) => isEmptyValue(v))
  }
  return false
}

export function buildTemplatePayload(summary) {
  const payload = {}
  const src = summary || {}

  const textFields = [
    ...DISCHARGE_NARRATIVE_FIELDS.map(([k]) => k),
    ...DISCHARGE_COURSE_FIELDS.map(([k]) => k),
    ...DISCHARGE_ADVICE_FIELDS.map(([k]) => k),
    'condition_at_discharge',
    'medications_on_discharge',
    'investigations',
    'referral_reason',
    'cause_of_death',
    'referred_to_facility',
    'treating_consultant',
    'consultant_registration_no',
    'rmo_signed_by',
    'follow_up_doctor',
    'follow_up_department',
    'notified_to',
    'abha_id',
    'insurance_provider',
    'tpa_name',
    'policy_number',
    'claim_number',
    'attendant_counselled_by',
    'procedure_surgery',
    'surgeon_name',
    'assistant_name',
    'anaesthetist_name',
    'anaesthesia_type',
    'operative_findings',
    'intra_op_complications',
  ]

  for (const key of textFields) {
    if (src[key] != null && String(src[key]).trim()) {
      payload[key] = src[key]
    }
  }

  for (const key of ['discharge_type', 'discharge_status', 'mode_of_admission']) {
    if (src[key]) payload[key] = src[key]
  }

  if (src.vitals_at_discharge && typeof src.vitals_at_discharge === 'object') {
    payload.vitals_at_discharge = { ...src.vitals_at_discharge }
  }

  payload.autopsy_required = !!src.autopsy_required
  payload.patient_education_given = !!src.patient_education_given

  if (Array.isArray(src.investigation_rows) && src.investigation_rows.length) {
    payload.investigation_rows = src.investigation_rows.map((row) => ({
      category: row.category || 'lab',
      test_name: row.test_name || '',
      value: row.value || '',
      reference_range: row.reference_range || '',
      test_date: row.test_date || '',
    }))
  }

  if (Array.isArray(src.surgery_rows) && src.surgery_rows.length) {
    payload.surgery_rows = src.surgery_rows.map((row) => ({
      surgery_date: row.surgery_date || '',
      procedure_name: row.procedure_name || '',
      surgeon_name: row.surgeon_name || '',
      assistant_name: row.assistant_name || '',
      anaesthetist_name: row.anaesthetist_name || '',
      anaesthesia_type: row.anaesthesia_type || '',
      operative_findings: row.operative_findings || '',
      intra_op_complications: row.intra_op_complications || '',
    }))
  }

  return payload
}

export function applyTemplateToSummary(summary, templatePayload, { replace = false } = {}) {
  const next = { ...summary }
  const payload = templatePayload || {}

  const mergeScalar = (key, value) => {
    if (value == null) return
    if (!replace && !isEmptyValue(next[key])) return
    next[key] = value
  }

  for (const [key] of [
    ...DISCHARGE_NARRATIVE_FIELDS,
    ...DISCHARGE_COURSE_FIELDS,
    ...DISCHARGE_ADVICE_FIELDS,
  ]) {
    mergeScalar(key, payload[key])
  }

  for (const key of [
    'condition_at_discharge',
    'medications_on_discharge',
    'investigations',
    'referral_reason',
    'cause_of_death',
    'referred_to_facility',
    'treating_consultant',
    'consultant_registration_no',
    'rmo_signed_by',
    'follow_up_doctor',
    'follow_up_department',
    'notified_to',
    'abha_id',
    'insurance_provider',
    'tpa_name',
    'policy_number',
    'claim_number',
    'attendant_counselled_by',
    'procedure_surgery',
    'surgeon_name',
    'assistant_name',
    'anaesthetist_name',
    'anaesthesia_type',
    'operative_findings',
    'intra_op_complications',
    'discharge_type',
    'discharge_status',
    'mode_of_admission',
  ]) {
    mergeScalar(key, payload[key])
  }

  if (payload.vitals_at_discharge && typeof payload.vitals_at_discharge === 'object') {
    const current = next.vitals_at_discharge || {}
    const merged = { ...current }
    for (const vital of DISCHARGE_VITAL_FIELDS) {
      const value = payload.vitals_at_discharge[vital]
      if (value == null || (!replace && String(merged[vital] || '').trim())) continue
      merged[vital] = value
    }
    next.vitals_at_discharge = merged
  }

  if ('autopsy_required' in payload && (replace || next.autopsy_required == null)) {
    next.autopsy_required = !!payload.autopsy_required
  }
  if ('patient_education_given' in payload && (replace || !next.patient_education_given)) {
    next.patient_education_given = !!payload.patient_education_given
  }

  if (Array.isArray(payload.investigation_rows) && payload.investigation_rows.length) {
    if (replace || !(next.investigation_rows || []).length) {
      next.investigation_rows = payload.investigation_rows.map((row) => ({ ...row }))
    }
  }

  if (Array.isArray(payload.surgery_rows) && payload.surgery_rows.length) {
    if (replace || !(next.surgery_rows || []).length) {
      next.surgery_rows = payload.surgery_rows.map((row) => ({ ...row }))
    }
  }

  return next
}

export function stripSurgeryDatesFromRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    surgery_date: '',
    test_date: row.test_date != null ? '' : row.test_date,
  }))
}
