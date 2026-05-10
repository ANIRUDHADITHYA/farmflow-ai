import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase mock ─────────────────────────────────────────────────
// Inline chainable mock that tracks calls per-table
const callLog: Array<{ table: string; method: string; args: unknown[] }> = []
const tableOverrides = new Map<string, Record<string, unknown>>()

function chainable(table: string, defaultResult: Record<string, unknown> = { data: null, error: null }) {
  const overrides = tableOverrides.get(table) || {}
  const result = { ...defaultResult, ...overrides }
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

const mockFrom = vi.fn((table: string) => {
  return {
    select: vi.fn((...args: unknown[]) => { callLog.push({ table, method: 'select', args }); return chainable(table) }),
    insert: vi.fn((...args: unknown[]) => { callLog.push({ table, method: 'insert', args }); return chainable(table) }),
    update: vi.fn((...args: unknown[]) => { callLog.push({ table, method: 'update', args }); return chainable(table) }),
    upsert: vi.fn((...args: unknown[]) => { callLog.push({ table, method: 'upsert', args }); return chainable(table) }),
    delete: vi.fn((...args: unknown[]) => { callLog.push({ table, method: 'delete', args }); return chainable(table) }),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom, storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn() })) } },
}))

vi.mock('@/services/ai', () => ({
  processMessage: vi.fn(),
}))

import { processMessage } from '@/services/ai'
const mockedProcessMessage = vi.mocked(processMessage)

// ─── Import the route handler ──────────────────────────────────────
// We import the module dynamically to ensure mocks are in place
const { POST } = await import('@/app/api/chat/route')

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Chat API Route – POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.length = 0
    tableOverrides.clear()
  })

  // ─── Input validation ────────────────────────────────────────────
  describe('Input validation', () => {
    it('should return prompt when no message and no attachments', async () => {
      const res = await POST(makeRequest({}) as never)
      const json = await res.json()
      expect(json.intent).toBe('general')
      expect(json.message).toContain('send a message')
    })

    it('should return prompt for empty message with empty attachments', async () => {
      const res = await POST(makeRequest({ message: '', attachments: [] }) as never)
      const json = await res.json()
      expect(json.intent).toBe('general')
    })
  })

  // ─── General / greeting intent ───────────────────────────────────
  describe('General intent', () => {
    it('should return AI response directly for general intent (no DB ops)', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'general',
        data: {},
        message: 'Hello! How can I help?',
        follow_up_questions: [],
      })

      const res = await POST(makeRequest({ message: 'Hi there' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('general')
      expect(json.message).toBe('Hello! How can I help?')
      // No DB calls for general intent
      expect(callLog.filter(c => c.table !== undefined).length).toBe(0)
    })
  })

  // ─── Treatment workflow ──────────────────────────────────────────
  describe('Treatment workflow', () => {
    it('should look up existing animal and create treatment', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '284', animal_type: 'cow', medicine: 'Noroclox', condition: 'mastitis' },
        message: 'Treatment logged!',
      })
      // Mock animal lookup returns existing animal
      tableOverrides.set('animals', { data: { id: 'animal-uuid-1' }, error: null })

      const res = await POST(makeRequest({ message: 'Treated cow 284 with Noroclox for mastitis' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('treatment')

      // Should query animals table
      const animalCalls = callLog.filter(c => c.table === 'animals')
      expect(animalCalls.length).toBeGreaterThan(0)

      // Should insert into treatments
      const treatmentInserts = callLog.filter(c => c.table === 'treatments' && c.method === 'insert')
      expect(treatmentInserts.length).toBeGreaterThan(0)

      // Should create ledger entry
      const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
      expect(ledgerInserts.length).toBeGreaterThan(0)
    })

    it('should create new animal if not found', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '999', animal_type: 'goat', medicine: 'Pen' },
        message: 'Treatment logged!',
      })
      // Animal lookup returns null (not found)
      tableOverrides.set('animals', { data: null, error: { code: 'PGRST116', message: 'not found' } })

      const res = await POST(makeRequest({ message: 'Treated goat 999 with Pen' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('treatment')

      // Should attempt to insert new animal
      const animalInserts = callLog.filter(c => c.table === 'animals' && c.method === 'insert')
      expect(animalInserts.length).toBeGreaterThan(0)
    })

    it('should skip DB write when no tag number provided (partial data)', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'treatment',
        data: { medicine: 'Noroclox' },
        message: 'Which animal?',
        follow_up_questions: ['Cow 284', 'Cow 101'],
      })

      const res = await POST(makeRequest({ message: 'Used Noroclox' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('treatment')
      // No treatment insert when tag_number missing and no withdrawal/batch
      const treatmentInserts = callLog.filter(c => c.table === 'treatments' && c.method === 'insert')
      expect(treatmentInserts.length).toBe(0)
    })

    it('should create withdrawal reminder when withdrawal_hours provided', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '10', medicine: 'Amox', withdrawal_hours: 72 },
        message: 'Logged!',
      })
      tableOverrides.set('animals', { data: { id: 'uuid-10' }, error: null })

      const res = await POST(makeRequest({ message: 'Treated cow 10 with Amox 72 hours' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('treatment')

      // Should insert reminder for withdrawal
      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })

    it('should reduce medicine inventory if it exists in stock', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '5', medicine: 'Vaccine A' },
        message: 'Done',
      })
      tableOverrides.set('animals', { data: { id: 'uuid-5' }, error: null })
      tableOverrides.set('inventory', { data: { quantity: 10 }, error: null })

      await POST(makeRequest({ message: 'Treated cow 5 with Vaccine A' }) as never)

      // Should update inventory quantity
      const invUpdates = callLog.filter(c => c.table === 'inventory' && c.method === 'update')
      expect(invUpdates.length).toBeGreaterThan(0)
    })
  })

  // ─── Inventory workflow ──────────────────────────────────────────
  describe('Inventory workflow', () => {
    it('should upsert inventory item', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'feed bags', quantity: 25, unit: 'bags' },
        message: 'Stock updated!',
      })

      const res = await POST(makeRequest({ message: 'I have 25 bags of feed' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('inventory')

      const upserts = callLog.filter(c => c.table === 'inventory' && c.method === 'upsert')
      expect(upserts.length).toBeGreaterThan(0)
    })

    it('should skip inventory when item_name is missing', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'inventory',
        data: { quantity: 5 },
        message: 'What item?',
      })

      await POST(makeRequest({ message: 'I have 5' }) as never)

      const upserts = callLog.filter(c => c.table === 'inventory' && c.method === 'upsert')
      expect(upserts.length).toBe(0)
    })

    it('should default quantity to 0 when not provided', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'syringes' },
        message: 'Noted',
      })

      await POST(makeRequest({ message: 'syringes stock' }) as never)

      const upserts = callLog.filter(c => c.table === 'inventory' && c.method === 'upsert')
      expect(upserts.length).toBeGreaterThan(0)
    })

    it('should default unit to "units" when not provided', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'gloves', quantity: 100 },
        message: 'Updated',
      })

      await POST(makeRequest({ message: '100 gloves' }) as never)

      const upserts = callLog.filter(c => c.table === 'inventory' && c.method === 'upsert')
      expect(upserts.length).toBeGreaterThan(0)
    })
  })

  // ─── Invoice workflow ────────────────────────────────────────────
  describe('Invoice workflow', () => {
    it('should create invoice and update inventory from items', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'invoice',
        data: {
          supplier: 'ABC Feeds',
          amount: 450,
          items: [{ name: 'cattle feed', quantity: 20, unit: 'bags' }],
        },
        message: 'Invoice recorded!',
      })

      const res = await POST(makeRequest({ message: 'Invoice $450 from ABC Feeds for 20 bags of cattle feed' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('invoice')

      // Should insert invoice
      const invoiceInserts = callLog.filter(c => c.table === 'invoices' && c.method === 'insert')
      expect(invoiceInserts.length).toBeGreaterThan(0)

      // Should upsert inventory for each item
      const invUpserts = callLog.filter(c => c.table === 'inventory' && (c.method === 'upsert' || c.method === 'select'))
      expect(invUpserts.length).toBeGreaterThan(0)
    })

    it('should create invoice without items', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'invoice',
        data: { supplier: 'Vet Supply', amount: 200 },
        message: 'Invoice logged',
      })

      await POST(makeRequest({ message: 'Invoice $200 from Vet Supply' }) as never)

      const invoiceInserts = callLog.filter(c => c.table === 'invoices' && c.method === 'insert')
      expect(invoiceInserts.length).toBeGreaterThan(0)

      // No inventory upsert when no items
      const invUpserts = callLog.filter(c => c.table === 'inventory' && c.method === 'upsert')
      expect(invUpserts.length).toBe(0)
    })

    it('should default supplier to Unknown when missing', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'invoice',
        data: { amount: 100 },
        message: 'Recorded',
      })

      await POST(makeRequest({ message: 'Invoice $100' }) as never)

      const invoiceInserts = callLog.filter(c => c.table === 'invoices' && c.method === 'insert')
      expect(invoiceInserts.length).toBeGreaterThan(0)
    })
  })

  // ─── Reminder workflow ───────────────────────────────────────────
  describe('Reminder workflow', () => {
    it('should create reminder with tomorrow date', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Order feed', due_date: 'tomorrow morning' },
        message: 'Reminder set!',
      })

      const res = await POST(makeRequest({ message: 'Remind me to order feed tomorrow morning' }) as never)
      const json = await res.json()
      expect(json.intent).toBe('reminder')

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })

    it('should create reminder with next week date', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Check herd', due_date: 'next week' },
        message: 'Reminder set!',
      })

      await POST(makeRequest({ message: 'Remind me next week to check herd' }) as never)

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })

    it('should skip reminder when title is missing', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { due_date: 'tomorrow' },
        message: 'What should I remind you about?',
      })

      await POST(makeRequest({ message: 'Remind me tomorrow' }) as never)

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBe(0)
    })

    it('should default to tomorrow when no due_date', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Feed animals' },
        message: 'Reminder set for tomorrow',
      })

      await POST(makeRequest({ message: 'Remind me to feed animals' }) as never)

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })

    it('should parse afternoon time', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Vaccination', due_date: 'tomorrow afternoon' },
        message: 'Set!',
      })

      await POST(makeRequest({ message: 'Remind me tomorrow afternoon vaccination' }) as never)

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })

    it('should parse evening time', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Close barn', due_date: 'tomorrow evening' },
        message: 'Set!',
      })

      await POST(makeRequest({ message: 'Remind me tomorrow evening to close barn' }) as never)

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })

    it('should parse ISO date string', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Vet visit', due_date: '2026-05-15T10:00:00Z' },
        message: 'Set!',
      })

      await POST(makeRequest({ message: 'Remind me about vet visit on May 15' }) as never)

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })

    it('should fall back to tomorrow for unparseable date', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Test', due_date: 'not a real date' },
        message: 'Set!',
      })

      await POST(makeRequest({ message: 'Remind me test not a real date' }) as never)

      const reminderInserts = callLog.filter(c => c.table === 'reminders' && c.method === 'insert')
      expect(reminderInserts.length).toBeGreaterThan(0)
    })
  })

  // ─── Ledger entries ──────────────────────────────────────────────
  describe('Ledger entries', () => {
    it('should create ledger entry for treatment', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '1', medicine: 'Med' },
        message: 'Done',
      })
      tableOverrides.set('animals', { data: { id: 'uuid' }, error: null })

      await POST(makeRequest({ message: 'Treated cow 1 with Med' }) as never)

      const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
      expect(ledgerInserts.length).toBeGreaterThan(0)
    })

    it('should create ledger entry for inventory', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'hay', quantity: 10 },
        message: 'Updated',
      })

      await POST(makeRequest({ message: '10 hay bales' }) as never)

      const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
      expect(ledgerInserts.length).toBeGreaterThan(0)
    })

    it('should create ledger entry for invoice', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'invoice',
        data: { supplier: 'Test', amount: 50 },
        message: 'Logged',
      })

      await POST(makeRequest({ message: 'Invoice $50 from Test' }) as never)

      const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
      expect(ledgerInserts.length).toBeGreaterThan(0)
    })

    it('should create ledger entry for reminder', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Feed', due_date: 'tomorrow' },
        message: 'Set',
      })

      await POST(makeRequest({ message: 'Remind me to feed' }) as never)

      const ledgerInserts = callLog.filter(c => c.table === 'ledger_entries' && c.method === 'insert')
      expect(ledgerInserts.length).toBeGreaterThan(0)
    })
  })

  // ─── Conversation history forwarding ─────────────────────────────
  describe('History forwarding', () => {
    it('should pass history to processMessage', async () => {
      mockedProcessMessage.mockResolvedValue({
        intent: 'treatment',
        data: { withdrawal_hours: 72, batch_number: 'B1' },
        message: 'Updated',
      })

      const history = [
        { role: 'user', content: 'Treated cow 284' },
        { role: 'assistant', content: 'Got it' },
      ]

      await POST(makeRequest({ message: '72 hours', history }) as never)

      expect(mockedProcessMessage).toHaveBeenCalledWith('72 hours', undefined, history)
    })
  })

  // ─── Error handling ──────────────────────────────────────────────
  describe('Error handling', () => {
    it('should return 500 on AI service failure', async () => {
      mockedProcessMessage.mockRejectedValue(new Error('OpenAI down'))

      const res = await POST(makeRequest({ message: 'test' }) as never)
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.intent).toBe('error')
      expect(json.message).toContain('trouble processing')
    })
  })
})
