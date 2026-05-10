import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase mock ─────────────────────────────────────────────────
const callLog: Array<{ table: string; method: string; args: unknown[] }> = []

function chainable(table: string) {
  const result = { data: null, error: null, ...chainableOverrides.get(table) }
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

const chainableOverrides = new Map<string, Record<string, unknown>>()

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

vi.mock('@/services/ai', () => ({
  processMessage: vi.fn(),
}))

import { processMessage } from '@/services/ai'
const mockedProcessMessage = vi.mocked(processMessage)

const { POST } = await import('@/app/api/chat/route')

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Ledger Description Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.length = 0
    chainableOverrides.clear()
  })

  it('treatment: should build description with tag and medicine', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'treatment',
      data: { tag_number: '284', medicine: 'Noroclox' },
      message: 'Done',
    })
    // Mock animal lookup returns existing animal
    chainableOverrides.set('animals', { data: { id: 'uuid-284' }, error: null })

    await POST(makeRequest({ message: 'test' }) as never)

    const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
    expect(ledgerInserts.length).toBeGreaterThan(0)
    const insertedData = ledgerInserts[0].args[0] as Record<string, unknown>
    expect(insertedData.description).toContain('#284')
    expect(insertedData.description).toContain('Noroclox')
  })

  it('treatment: should use "unknown" for missing tag', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'treatment',
      data: { withdrawal_hours: 48 },
      message: 'Done',
    })

    await POST(makeRequest({ message: 'test' }) as never)

    const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
    expect(ledgerInserts.length).toBeGreaterThan(0)
    const insertedData = ledgerInserts[0].args[0] as Record<string, unknown>
    expect(insertedData.description).toContain('unknown')
  })

  it('inventory: should include item name and quantity', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'inventory',
      data: { item_name: 'feed bags', quantity: 5 },
      message: 'Updated',
    })

    await POST(makeRequest({ message: 'test' }) as never)

    const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
    const insertedData = ledgerInserts[0].args[0] as Record<string, unknown>
    expect(insertedData.description).toContain('feed bags')
    expect(insertedData.description).toContain('5')
  })

  it('invoice: should include supplier and amount', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'invoice',
      data: { supplier: 'ABC', amount: 300 },
      message: 'Recorded',
    })

    await POST(makeRequest({ message: 'test' }) as never)

    const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
    const insertedData = ledgerInserts[0].args[0] as Record<string, unknown>
    expect(insertedData.description).toContain('ABC')
    expect(insertedData.description).toContain('$300')
  })

  it('reminder: should include title', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'reminder',
      data: { title: 'Feed animals', due_date: 'tomorrow' },
      message: 'Set',
    })

    await POST(makeRequest({ message: 'test' }) as never)

    const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
    const insertedData = ledgerInserts[0].args[0] as Record<string, unknown>
    expect(insertedData.description).toContain('Feed animals')
  })

  it('unknown intent: should use fallback description', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'custom_action',
      data: {},
      message: 'OK',
    })

    await POST(makeRequest({ message: 'test' }) as never)

    const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
    const insertedData = ledgerInserts[0].args[0] as Record<string, unknown>
    expect(insertedData.description).toContain('custom_action')
  })
})

describe('Invoice with multiple items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.length = 0
    chainableOverrides.clear()
  })

  it('should process multiple invoice items', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'invoice',
      data: {
        supplier: 'Farm Store',
        amount: 800,
        items: [
          { name: 'feed', quantity: 10, unit: 'bags' },
          { name: 'salt lick', quantity: 5, unit: 'blocks' },
        ],
      },
      message: 'Invoice processed',
    })

    await POST(makeRequest({ message: 'test' }) as never)

    // Should have inventory operations for each item
    const invOps = callLog.filter(c => c.table === 'inventory')
    expect(invOps.length).toBeGreaterThanOrEqual(2) // at least select + upsert per item
  })
})

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.length = 0
    chainableOverrides.clear()
  })

  it('should handle treatment with only withdrawal_hours (no tag)', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'treatment',
      data: { withdrawal_hours: 72 },
      message: 'Need more info',
    })

    const res = await POST(makeRequest({ message: '72 hours withdrawal' }) as never)
    const json = await res.json()
    expect(json.intent).toBe('treatment')
    // Should still create ledger but skip treatment insert
    const treatmentInserts = callLog.filter(c => c.table === 'treatments' && c.method === 'insert')
    expect(treatmentInserts.length).toBe(0)
  })

  it('should handle treatment with only batch_number (no tag)', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'treatment',
      data: { batch_number: 'B001' },
      message: 'Need tag',
    })

    await POST(makeRequest({ message: 'batch B001' }) as never)

    const treatmentInserts = callLog.filter(c => c.table === 'treatments' && c.method === 'insert')
    expect(treatmentInserts.length).toBe(0)
  })

  it('should handle zero quantity inventory', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'inventory',
      data: { item_name: 'empty item', quantity: 0 },
      message: 'Updated',
    })

    await POST(makeRequest({ message: 'empty item 0' }) as never)

    const upserts = callLog.filter(c => c.table === 'inventory' && c.method === 'upsert')
    expect(upserts.length).toBeGreaterThan(0)
  })

  it('should handle invoice with zero amount', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'invoice',
      data: { supplier: 'Free Sample', amount: 0 },
      message: 'Recorded',
    })

    await POST(makeRequest({ message: 'Free invoice' }) as never)

    const invoiceInserts = callLog.filter(c => c.table === 'invoices' && c.method === 'insert')
    expect(invoiceInserts.length).toBeGreaterThan(0)
  })

  it('should handle very long message', async () => {
    const longMsg = 'a'.repeat(5000)
    mockedProcessMessage.mockResolvedValue({
      intent: 'general',
      data: {},
      message: 'OK',
    })

    const res = await POST(makeRequest({ message: longMsg }) as never)
    expect(res.status).toBe(200)
  })

  it('should handle special characters in message', async () => {
    mockedProcessMessage.mockResolvedValue({
      intent: 'general',
      data: {},
      message: 'OK',
    })

    const res = await POST(makeRequest({ message: 'Cow\'s injection "Noroclox" <script>alert(1)</script>' }) as never)
    expect(res.status).toBe(200)
  })
})
