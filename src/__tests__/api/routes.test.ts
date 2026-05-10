import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase mock ─────────────────────────────────────────────────
const callLog: Array<{ table: string; method: string; args: unknown[] }> = []
const tableResults = new Map<string, Record<string, unknown>>()

function chainable(table: string) {
  const result = tableResults.get(table) || { data: [], error: null }
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'lt', 'gt', 'lte', 'gte', 'single', 'order', 'limit', 'filter']
  for (const m of methods) {
    builder[m] = vi.fn((...args: unknown[]) => {
      callLog.push({ table, method: m, args })
      return builder
    })
  }
  builder.then = vi.fn((resolve: (v: unknown) => void) => resolve(result))
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn((...a: unknown[]) => { callLog.push({ table, method: 'select', args: a }); return chainable(table) }),
      insert: vi.fn((...a: unknown[]) => { callLog.push({ table, method: 'insert', args: a }); return chainable(table) }),
      update: vi.fn((...a: unknown[]) => { callLog.push({ table, method: 'update', args: a }); return chainable(table) }),
      upsert: vi.fn((...a: unknown[]) => { callLog.push({ table, method: 'upsert', args: a }); return chainable(table) }),
      delete: vi.fn((...a: unknown[]) => { callLog.push({ table, method: 'delete', args: a }); return chainable(table) }),
    })),
  },
}))

// ─── Import all API routes ─────────────────────────────────────────
const animals = await import('@/app/api/animals/route')
const inventory = await import('@/app/api/inventory/route')
const reminders = await import('@/app/api/reminders/route')
const ledger = await import('@/app/api/ledger/route')
const dashboard = await import('@/app/api/dashboard/route')

function makeReq(method: string, url: string, body?: Record<string, unknown>): Request {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  return new Request(`http://localhost${url}`, init)
}

describe('REST API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.length = 0
    tableResults.clear()
  })

  // ─── Animals API ─────────────────────────────────────────────────
  describe('Animals API', () => {
    it('GET should return animals list', async () => {
      tableResults.set('animals', { data: [{ id: '1', tag_number: '100', type: 'cow' }], error: null })
      const res = await animals.GET()
      expect(res.status).toBe(200)
    })

    it('POST should require tag_number and type', async () => {
      const res = await animals.POST(makeReq('POST', '/api/animals', { tag_number: '' }) as never)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toContain('required')
    })

    it('POST should create animal with valid data', async () => {
      tableResults.set('animals', { data: { id: '2', tag_number: '200', type: 'goat' }, error: null })
      const res = await animals.POST(makeReq('POST', '/api/animals', { tag_number: '200', type: 'goat' }) as never)
      expect(res.status).toBe(201)
    })

    it('PATCH should require id', async () => {
      const res = await animals.PATCH(makeReq('PATCH', '/api/animals', { status: 'sold' }) as never)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toContain('id is required')
    })

    it('PATCH should update animal', async () => {
      tableResults.set('animals', { data: { id: '1', status: 'sold' }, error: null })
      const res = await animals.PATCH(makeReq('PATCH', '/api/animals', { id: '1', status: 'sold' }) as never)
      expect(res.status).toBe(200)
    })
  })

  // ─── Inventory API ──────────────────────────────────────────────
  describe('Inventory API', () => {
    it('GET should return inventory list', async () => {
      tableResults.set('inventory', { data: [{ id: '1', item_name: 'feed', quantity: 10 }], error: null })
      const res = await inventory.GET()
      expect(res.status).toBe(200)
    })

    it('POST should require item_name', async () => {
      const res = await inventory.POST(makeReq('POST', '/api/inventory', { quantity: 5 }) as never)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toContain('item_name')
    })

    it('POST should upsert item with valid data', async () => {
      tableResults.set('inventory', { data: { id: '1', item_name: 'hay', quantity: 20 }, error: null })
      const res = await inventory.POST(makeReq('POST', '/api/inventory', { item_name: 'hay', quantity: 20, unit: 'bales' }) as never)
      expect(res.status).toBe(201)
    })

    it('DELETE should require id param', async () => {
      const res = await inventory.DELETE(makeReq('DELETE', '/api/inventory') as never)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toContain('id')
    })

    it('DELETE should delete item by id', async () => {
      const res = await inventory.DELETE(makeReq('DELETE', '/api/inventory?id=abc') as never)
      expect(res.status).toBe(200)
    })
  })

  // ─── Reminders API ──────────────────────────────────────────────
  describe('Reminders API', () => {
    it('GET should return reminders', async () => {
      tableResults.set('reminders', { data: [], error: null })
      const res = await reminders.GET(makeReq('GET', '/api/reminders') as never)
      expect(res.status).toBe(200)
    })

    it('GET should filter by status param', async () => {
      tableResults.set('reminders', { data: [], error: null })
      const res = await reminders.GET(makeReq('GET', '/api/reminders?status=pending') as never)
      expect(res.status).toBe(200)
    })

    it('POST should require title and due_date', async () => {
      const res = await reminders.POST(makeReq('POST', '/api/reminders', { title: 'Test' }) as never)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toContain('required')
    })

    it('POST should create reminder with valid data', async () => {
      tableResults.set('reminders', { data: { id: '1', title: 'Feed', due_date: '2026-05-10' }, error: null })
      const res = await reminders.POST(makeReq('POST', '/api/reminders', { title: 'Feed', due_date: '2026-05-10' }) as never)
      expect(res.status).toBe(201)
    })

    it('PATCH should require id and status', async () => {
      const res = await reminders.PATCH(makeReq('PATCH', '/api/reminders', { id: '1' }) as never)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toContain('required')
    })

    it('PATCH should update reminder status', async () => {
      tableResults.set('reminders', { data: { id: '1', status: 'completed' }, error: null })
      const res = await reminders.PATCH(makeReq('PATCH', '/api/reminders', { id: '1', status: 'completed' }) as never)
      expect(res.status).toBe(200)
    })
  })

  // ─── Ledger API ──────────────────────────────────────────────────
  describe('Ledger API', () => {
    it('GET should return ledger entries', async () => {
      tableResults.set('ledger_entries', { data: [], error: null })
      const res = await ledger.GET()
      expect(res.status).toBe(200)
    })
  })

  // ─── Dashboard API ──────────────────────────────────────────────
  describe('Dashboard API', () => {
    it('GET should return aggregated stats', async () => {
      // All tables return empty/zero
      tableResults.set('inventory', { data: [], error: null, count: 0 })
      tableResults.set('reminders', { data: [], error: null, count: 0 })
      tableResults.set('treatments', { data: [], error: null, count: 0 })
      tableResults.set('ledger_entries', { data: [], error: null, count: 0 })
      tableResults.set('animals', { data: [], error: null, count: 0 })
      tableResults.set('invoices', { data: [], error: null })

      const res = await dashboard.GET()
      expect(res.status).toBe(200)
    })
  })
})
