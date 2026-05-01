import { z } from 'zod'

function optionsFromChoices(choices = []) {
  if (!Array.isArray(choices)) return []
  return choices
    .map((choice) => {
      if (Array.isArray(choice)) return { value: choice[0], label: choice[1] ?? String(choice[0]) }
      if (choice && typeof choice === 'object') return { value: choice.value, label: choice.display_name ?? choice.label ?? String(choice.value) }
      return { value: choice, label: String(choice) }
    })
    .filter((item) => item.value !== undefined && item.value !== null)
}

export function drfFieldToInputProps(field = {}) {
  const props = {
    required: Boolean(field.required),
    disabled: Boolean(field.read_only),
    helperText: field.help_text || '',
  }

  if (field.max_length != null) props.maxLength = Number(field.max_length)
  if (field.min_length != null) props.minLength = Number(field.min_length)
  if (field.min_value != null) props.min = Number(field.min_value)
  if (field.max_value != null) props.max = Number(field.max_value)
  if (field.default != null) props.defaultValue = field.default
  if (field.type === 'boolean') props.type = 'checkbox'
  else if (field.type === 'integer' || field.type === 'float' || field.type === 'number' || field.type === 'decimal') props.type = 'number'
  else if (field.type === 'date') props.type = 'date'
  else if (field.type === 'datetime') props.type = 'datetime-local'
  else if (field.type === 'email') props.type = 'email'
  else props.type = 'text'

  const options = optionsFromChoices(field.choices)
  if (options.length) props.options = options
  return props
}

function baseTypeSchema(field = {}) {
  if (field.type === 'boolean') return z.boolean()
  if (field.type === 'integer') return z.coerce.number().int()
  if (field.type === 'float' || field.type === 'number' || field.type === 'decimal') return z.coerce.number()
  if (field.type === 'email') return z.string().email('Enter a valid email address')
  if (field.type === 'date' || field.type === 'datetime') return z.string()
  return z.string()
}

function applyFieldRules(schema, field = {}) {
  let next = schema
  if (field.type !== 'boolean' && field.required && !field.read_only) {
    next = next.refine((value) => value !== '' && value !== null && value !== undefined, field.label ? `${field.label} is required` : 'This field is required')
  } else if (!field.required) {
    next = next.optional()
  }

  if (field.max_length != null && typeof next.max === 'function') next = next.max(Number(field.max_length))
  if (field.min_length != null && typeof next.min === 'function') next = next.min(Number(field.min_length))
  if (field.max_value != null && typeof next.max === 'function') next = next.max(Number(field.max_value))
  if (field.min_value != null && typeof next.min === 'function') next = next.min(Number(field.min_value))

  const options = optionsFromChoices(field.choices).map((opt) => String(opt.value))
  if (options.length) {
    next = z
      .any()
      .refine((value) => value == null || options.includes(String(value)), 'Select a valid option')
  }

  return next
}

export function drfSchemaToZodSchema(schema = {}) {
  const fields = schema.actions?.POST || schema.fields || schema
  const shape = {}
  Object.entries(fields || {}).forEach(([name, field]) => {
    if (field?.read_only) return
    shape[name] = applyFieldRules(baseTypeSchema(field), field)
  })
  return z.object(shape)
}

export function drfSchemaToFieldConfig(schema = {}) {
  const fields = schema.actions?.POST || schema.fields || schema
  return Object.entries(fields || {})
    .filter(([, field]) => !field?.read_only)
    .map(([name, field]) => ({
      name,
      label: field?.label || name,
      inputProps: drfFieldToInputProps(field),
      raw: field,
    }))
}

