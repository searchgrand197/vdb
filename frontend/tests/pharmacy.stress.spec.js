import { expect, test } from '@playwright/test'
import { mockPharmacyOutletSettings } from './pharmacySettingsMock.js'

function unwrap(data) {
  return data?.data ?? data?.results ?? data?.entity ?? data ?? []
}

test('pharmacy UI stress: 100 user interaction loops', async ({ page }) => {
  const medicines = [
    {
      id: 'm1',
      name: 'TUSQ',
      sku: 'M001',
      form: 'Syrup',
      hsn_code: '3004',
      pack_info: '1x1',
      default_mrp: '100.00',
      gst_percent: '5',
      unit_conversions: { strip: 1 },
      unit_name: 'unit',
    },
  ]

  const batches = [
    {
      id: 'b1',
      medicine: 'm1',
      batch_no: 'batch001',
      expiry_date: '2026-04-29',
      mfg_date: '2025-04-01',
      unit_cost: '80.00',
      mrp: '100.00',
      sale_rate: '100.00',
      quantity: 9,
    },
  ]

  const searchRows = [
    {
      medicine: {
        id: 'm1',
        name: 'TUSQ',
        sku: 'M001',
        pack_info: '1x1',
        hsn_code: '3004',
        gst_percent: '5',
        unit_conversions: { strip: 1 },
        unit_name: 'unit',
        pack_size: 1,
      },
      batch: {
        id: 'b1',
        batch_no: 'batch001',
        expiry_date: '2026-04-29',
        mrp: '100.00',
        sale_rate: '100.00',
        stock: 9,
      },
      expiry_status: 'expiring',
      days_to_expiry: 60,
    },
  ]

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()

    const ok = (body) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    const created = (body) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

    if (path.endsWith('/pharmacy/invoice/next-number/')) return ok({ data: { invoice_no: 'INV-2026-1' } })
    if (path.endsWith('/pharmacy/settings/')) return ok(mockPharmacyOutletSettings())
    if (path.endsWith('/medicines/search/')) return ok({ data: searchRows })
    if (path.endsWith('/medicines/') && method === 'GET') return ok({ data: medicines })
    if (path.endsWith('/batches/') && method === 'GET') return ok({ data: batches })
    if (path.endsWith('/pharmacy/invoices/') && method === 'GET') return ok({ data: [] })
    if (path.endsWith('/medicine-categories/') && method === 'GET') return ok({ data: [{ id: 'c1', name: 'Syrup' }] })
    if (path.endsWith('/units/') && method === 'GET') return ok({ data: [{ id: 'u1', code: 'TAB', name: 'Tablet' }] })
    if (path.endsWith('/patients/') && method === 'GET') return ok({ data: [] })
    if (path.endsWith('/pharmacy/invoices/') && method === 'POST') return created({ data: { id: 'inv1', invoice_no: 'INV-2026-1' } })
    if (path.endsWith('/pharmacy/items/') && method === 'POST') return created({ data: { id: 'it1' } })

    return ok({ data: unwrap({}) })
  })

  await page.goto('/pharmacy')
  await expect(page.getByRole('button', { name: 'Sales' })).toBeVisible()

  for (let i = 0; i < 100; i += 1) {
    await page.getByRole('button', { name: 'Sales' }).click()
    await page.getByRole('button', { name: 'Inventory' }).click()
    await page.getByRole('button', { name: 'Categories' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Sales' }).click()

    const searchInput = page.locator('input[placeholder="Search…"]').first()
    await searchInput.click()
    await searchInput.fill('TU')
    await expect(page.getByText('Batch batch001')).toBeVisible()
    await page.getByRole('button', { name: /TUSQ/ }).first().click()
  }

  await expect(page.getByText('TUSQ')).toBeVisible()
})

import { expect, test } from '@playwright/test'

function unwrap(data) {
  return data?.data ?? data?.results ?? data?.entity ?? data ?? []
}

test('pharmacy UI stress: 100 user interaction loops', async ({ page }) => {
  const medicines = [
    {
      id: 'm1',
      name: 'TUSQ',
      sku: 'M001',
      form: 'Syrup',
      hsn_code: '3004',
      pack_info: '1x1',
      default_mrp: '100.00',
      gst_percent: '5',
      unit_conversions: { strip: 1 },
      unit_name: 'unit',
    },
  ]

  const batches = [
    {
      id: 'b1',
      medicine: 'm1',
      batch_no: 'batch001',
      expiry_date: '2026-04-29',
      mfg_date: '2025-04-01',
      unit_cost: '80.00',
      mrp: '100.00',
      sale_rate: '100.00',
      quantity: 9,
    },
  ]

  const searchRows = [
    {
      medicine: {
        id: 'm1',
        name: 'TUSQ',
        sku: 'M001',
        pack_info: '1x1',
        hsn_code: '3004',
        gst_percent: '5',
        unit_conversions: { strip: 1 },
        unit_name: 'unit',
        pack_size: 1,
      },
      batch: {
        id: 'b1',
        batch_no: 'batch001',
        expiry_date: '2026-04-29',
        mrp: '100.00',
        sale_rate: '100.00',
        stock: 9,
      },
      expiry_status: 'expiring',
      days_to_expiry: 60,
    },
  ]

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()

    const ok = (body) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    const created = (body) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

    if (path.endsWith('/pharmacy/invoice/next-number/')) return ok({ data: { invoice_no: 'INV-2026-1' } })
    if (path.endsWith('/pharmacy/settings/')) return ok(mockPharmacyOutletSettings())
    if (path.endsWith('/medicines/search/')) return ok({ data: searchRows })
    if (path.endsWith('/medicines/') && method === 'GET') return ok({ data: medicines })
    if (path.endsWith('/batches/') && method === 'GET') return ok({ data: batches })
    if (path.endsWith('/pharmacy/invoices/') && method === 'GET') return ok({ data: [] })
    if (path.endsWith('/medicine-categories/') && method === 'GET') return ok({ data: [{ id: 'c1', name: 'Syrup' }] })
    if (path.endsWith('/units/') && method === 'GET') return ok({ data: [{ id: 'u1', code: 'TAB', name: 'Tablet' }] })
    if (path.endsWith('/patients/') && method === 'GET') return ok({ data: [] })
    if (path.endsWith('/pharmacy/invoices/') && method === 'POST') return created({ data: { id: 'inv1', invoice_no: 'INV-2026-1' } })
    if (path.endsWith('/pharmacy/items/') && method === 'POST') return created({ data: { id: 'it1' } })

    return ok({ data: unwrap({}) })
  })

  await page.goto('/pharmacy')
  await expect(page.getByRole('button', { name: 'Sales' })).toBeVisible()

  for (let i = 0; i < 100; i += 1) {
    await page.getByRole('button', { name: 'Sales' }).click()
    await page.getByRole('button', { name: 'Inventory' }).click()
    await page.getByRole('button', { name: 'Categories' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Sales' }).click()

    const searchInput = page.locator('input[placeholder="Search…"]').first()
    await searchInput.click()
    await searchInput.fill('TU')
    await expect(page.getByText('Batch batch001')).toBeVisible()
    await page.getByRole('button', { name: /TUSQ/ }).first().click()
  }

  await expect(page.getByText('TUSQ')).toBeVisible()
})

import { expect, test } from '@playwright/test'

function unwrap(data) {
  return data?.data ?? data?.results ?? data?.entity ?? data ?? []
}

test('pharmacy UI stress: 100 user interaction loops', async ({ page }) => {
  const medicines = [
    {
      id: 'm1',
      name: 'TUSQ',
      sku: 'M001',
      form: 'Syrup',
      hsn_code: '3004',
      pack_info: '1x1',
      default_mrp: '100.00',
      gst_percent: '5',
      unit_conversions: { strip: 1 },
      unit_name: 'unit',
    },
    {
      id: 'm2',
      name: 'TUSQ DRY',
      sku: 'M002',
      form: 'Syrup',
      hsn_code: '3004',
      pack_info: '1x10',
      default_mrp: '18.00',
      gst_percent: '5',
      unit_conversions: { strip: 10 },
      unit_name: 'tab',
    },
  ]

  const batches = [
    {
      id: 'b1',
      medicine: 'm1',
      batch_no: 'batch001',
      expiry_date: '2026-04-29',
      mfg_date: '2025-04-01',
      unit_cost: '80.00',
      mrp: '100.00',
      sale_rate: '100.00',
      quantity: 9,
    },
    {
      id: 'b2',
      medicine: 'm2',
      batch_no: 'batch002',
      expiry_date: '2026-06-01',
      mfg_date: '2025-05-01',
      unit_cost: '10.00',
      mrp: '18.00',
      sale_rate: '18.00',
      quantity: 50,
    },
  ]

  const searchRows = [
    {
      medicine: {
        id: 'm1',
        name: 'TUSQ',
        sku: 'M001',
        pack_info: '1x1',
        hsn_code: '3004',
        gst_percent: '5',
        unit_conversions: { strip: 1 },
        unit_name: 'unit',
        pack_size: 1,
      },
      batch: {
        id: 'b1',
        batch_no: 'batch001',
        expiry_date: '2026-04-29',
        mrp: '100.00',
        sale_rate: '100.00',
        stock: 9,
      },
      expiry_status: 'expiring',
      days_to_expiry: 60,
    },
  ]

  await page.addInitScript(() => {
    const origGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = function getItemPatched(key) {
      if (key === 'access') return 'test-access'
      if (key === 'refresh') return 'test-refresh'
      if (key === 'role') return 'pharmacy'
      if (key === 'user') return JSON.stringify({ hospital_id: 'hosp-test' })
      return origGetItem.call(this, key)
    }
  })

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()

    const ok = (body) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    const created = (body) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

    if (path.endsWith('/pharmacy/invoice/next-number/')) return ok({ data: { invoice_no: 'INV-2026-1' } })
    if (path.includes('/auth/login')) {
      return ok({ data: { access: 'test-access', refresh: 'test-refresh', hospital_id: 'hosp-test' } })
    }
    if (path.endsWith('/pharmacy/settings/')) return ok(mockPharmacyOutletSettings())
    if (path.endsWith('/medicines/search/')) return ok({ data: searchRows })
    if (path.endsWith('/medicines/') && method === 'GET') return ok({ data: medicines })
    if (path.endsWith('/batches/') && method === 'GET') return ok({ data: batches })
    if (path.endsWith('/pharmacy/invoices/') && method === 'GET') return ok({ data: [] })
    if (path.endsWith('/medicine-categories/') && method === 'GET') return ok({ data: [{ id: 'c1', name: 'Syrup' }] })
    if (path.endsWith('/units/') && method === 'GET') return ok({ data: [{ id: 'u1', code: 'TAB', name: 'Tablet' }] })
    if (path.endsWith('/patients/') && method === 'GET') return ok({ data: [] })
    if (path.endsWith('/pharmacy/invoices/') && method === 'POST') return created({ data: { id: 'inv1', invoice_no: 'INV-2026-1' } })
    if (path.endsWith('/pharmacy/items/') && method === 'POST') return created({ data: { id: 'it1' } })
    if (path.endsWith('/medicines/') && method === 'POST') return created({ data: { id: 'm-new' } })
    if (path.endsWith('/batches/') && method === 'POST') return created({ data: { id: 'b-new' } })
    if (path.endsWith('/medicine-categories/') && method === 'POST') return created({ data: { id: 'c-new', name: 'NewCat' } })

    return ok({ data: unwrap({}) })
  })

  await page.goto('/pharmacy')
  await expect(page.getByRole('button', { name: 'Sales' })).toBeVisible()

  for (let i = 0; i < 100; i += 1) {
    await page.getByRole('button', { name: 'Sales' }).click()
    await page.getByRole('button', { name: 'Inventory' }).click()
    await page.getByRole('button', { name: 'Categories' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Sales' }).click()

    const searchInput = page.locator('input[placeholder="Search…"]').first()
    await searchInput.click()
    await searchInput.fill('TU')
    await expect(page.getByText('Batch batch001')).toBeVisible()
    await page.getByRole('button', { name: /TUSQ/ }).first().click()
  }

  await expect(page.getByText('TUSQ')).toBeVisible()
})

