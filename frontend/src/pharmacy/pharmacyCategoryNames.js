/** Built-in folder names (shown after user-created + medicine-derived names). */
export const DEFAULT_CATEGORIES = [
  'Tablet', 'Syrup', 'Capsule', 'Injection', 'Cream', 'Powder', 'Drops', 'Surgicals', 'Liquid', 'Gel',
  'Suspension', 'Lotion', 'Diaper', 'Soap', 'Oil', 'Ointment', 'Kit', 'Bandage', 'Device', 'Spray',
  'Shampoo', 'Sachet', 'Facewash', 'Packet', 'Bottle', 'Solution', 'Condom', 'Sanitary Pad', 'Unit', 'Infusion',
  'Box', 'Elixir', 'Paste', 'Bolus', 'Balm', 'Respule', 'Toothpaste', 'Inhaler', 'Toothbrush', 'Serum',
  'Syringe', 'Paint', 'Churna', 'Granules', 'Face Mask', 'Jelly', 'Deodorant', 'Strip', 'Plaster', 'Wipe',
  'Roll On', 'Gummies', 'Chyawanprash', 'Mouthwash', 'Tube', 'Pouch', 'Wash', 'Rotacap', 'Vaccine', 'Suppository',
  'Patch', 'Jar', 'Water', 'Card', 'Expectorant', 'Razor', 'Lozenges', 'Honey', 'Thermometer', 'Tincture',
  'Conditioner', 'Bar', 'Nebulisers', 'Handwash', 'Liniment', 'Foam', 'Gargle', 'Vial', 'Moisturiser', 'Gum',
  'Scrub', 'Ampules', 'Cleanser', 'Particles', 'Adhesive', 'Lozenge', 'Diskette', 'Pen', 'Pastilles', 'Soflets',
  'Transcap', 'Tonic', 'Grains', 'Linctus', 'Pellet', 'Respicap', 'Pessaries', 'Cartrige', 'Husk', 'Emulsion',
  'Pessary', 'Enema', 'Gummy', 'Lacquer', 'Rotahaler', 'Instacap', 'Captabs', 'Aerosol', 'Film', 'Redicap',
  'Novocart', 'Opticops', 'Solvent', 'Tabcaps', 'Particle', 'Rapitab', 'Caplets', 'Intrauterine System', 'Transpule',
  'Transhaler', 'Vegicaps', 'Aquanase', 'Autopen', 'Multihaler', 'Oxipule', 'Autohaler', 'Alicaps', 'Rheocap',
  'Nexcaps', 'Oxycaps',
]

export function uniqCategories(values) {
  const out = []
  const seen = new Set()
  values.forEach((v) => {
    const raw = (v || '').trim()
    if (!raw) return
    const key = raw.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(raw)
  })
  return out
}

/** Same ordering as the Categories tab: API top-level first, then medicine forms, then presets. */
export function mergeCategoryNames(medicines, customCategories) {
  const subcategoryNames = new Set(
    customCategories
      .filter((c) => c.parent)
      .map((c) => (c.name || '').trim().toLowerCase())
      .filter(Boolean)
  )
  const fromMedicines = medicines
    .map((m) => m.form)
    .filter((f) => f && !subcategoryNames.has(f.trim().toLowerCase()))
  const fromApi = customCategories
    .filter((c) => !c.parent)
    .map((c) => c.name)
    .filter(Boolean)
  return uniqCategories([...fromApi, ...fromMedicines, ...DEFAULT_CATEGORIES])
}
