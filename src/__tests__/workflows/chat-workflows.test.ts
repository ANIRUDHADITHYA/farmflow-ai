/**
 * Full workflow integration tests.
 *
 * These tests post a chat message and then assert on EVERY database
 * mutation that should have happened: the exact table, method, and
 * the payload that was written.  This catches regressions where the
 * API responds "success" but nothing actually persisted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────────────────────────
// DB spy — captures every write with its payload
// ──────────────────────────────────────────────────────────────────────
interface DBWrite {
  table: string
  method: 'insert' | 'update' | 'upsert' | 'delete'
  payload: unknown            // the row / update object
  options?: unknown           // e.g. { onConflict: 'item_name' }
  filters: Array<{ op: string; args: unknown[] }>  // chained .eq() etc.
}

const writes: DBWrite[] = []

// Per-table per-method result overrides so we can simulate
// "animal exists" vs "animal not found", "inventory has stock", etc.
type ResultKey = `${string}:${string}`   // "animals:select"
const resultOverrides = new Map<ResultKey, { data: unknown; error: unknown; count?: number }>()

function setDBResult(table: string, method: string, data: unknown, error: unknown = null, count?: number) {
  resultOverrides.set(`${table}:${method}`, { data, error, ...(count !== undefined ? { count } : {}) })
}

function getDBResult(table: string, method: string) {
  return resultOverrides.get(`${table}:${method}`) ?? { data: null, error: null }
}

// Build a chainable query builder that records filters and resolves to the overridden result.
function makeChain(table: string, method: string, payload: unknown, options?: unknown) {
  const entry: DBWrite = { table, method: method as DBWrite['method'], payload, options, filters: [] }
  // Only track actual mutations
  if (['insert', 'update', 'upsert', 'delete'].includes(method)) {
    writes.push(entry)
  }
  const result = getDBResult(table, method)

  const builder: Record<string, unknown> = {}
  const chainMethods = ['select', 'eq', 'neq', 'lt', 'gt', 'lte', 'gte', 'single', 'order', 'limit', 'filter']
  for (const m of chainMethods) {
    builder[m] = vi.fn((...args: unknown[]) => {
      if (['eq', 'neq', 'lt', 'gt', 'lte', 'gte'].includes(m)) {
        entry.filters.push({ op: m, args })
      }
      return builder
    })
  }
  builder.then = vi.fn((resolve: (v: unknown) => void) => resolve(result))
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select:  vi.fn((...a: unknown[]) => makeChain(table, 'select',  null, a)),
      insert:  vi.fn((row: unknown)   => makeChain(table, 'insert',  row)),
      update:  vi.fn((row: unknown)   => makeChain(table, 'update',  row)),
      upsert:  vi.fn((row: unknown, opts?: unknown) => makeChain(table, 'upsert', row, opts)),
      delete:  vi.fn(()              => makeChain(table, 'delete',  null)),
    })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn() })) },
  },
}))

vi.mock('@/services/ai', () => ({
  processMessage: vi.fn(),
}))

import { processMessage } from '@/services/ai'
const mockAI = vi.mocked(processMessage)

const { POST } = await import('@/app/api/chat/route')

function postChat(body: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never)
}

// Helpers to query captured writes
const writesTo = (table: string) => writes.filter(w => w.table === table)
const insertsTo = (table: string) => writesTo(table).filter(w => w.method === 'insert')
const upsertsTo = (table: string) => writesTo(table).filter(w => w.method === 'upsert')
const updatesTo = (table: string) => writesTo(table).filter(w => w.method === 'update')

// ──────────────────────────────────────────────────────────────────────

describe('Full Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writes.length = 0
    resultOverrides.clear()
  })

  // ════════════════════════════════════════════════════════════════════
  //  TREATMENT  — complete flow
  // ════════════════════════════════════════════════════════════════════
  describe('Treatment: full lifecycle', () => {

    it('W1: Post treatment → creates animal + treatment + withdrawal reminder + ledger', async () => {
      // AI extracts full treatment data
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: {
          tag_number: '284', animal_type: 'cow',
          medicine: 'Noroclox', condition: 'mastitis',
          dosage: '10ml', withdrawal_hours: 72, batch_number: 'B123',
        },
        message: 'Treatment logged!',
        follow_up_questions: ['Log another treatment'],
      })
      // Animal exists
      setDBResult('animals', 'select', { id: 'uuid-cow-284' })

      const res = await postChat({ message: 'Treated cow 284 with Noroclox 10ml for mastitis, 72hr withdrawal batch B123' })
      const json = await res.json()

      // ── Response ──
      expect(res.status).toBe(200)
      expect(json.intent).toBe('treatment')
      expect(json.message).toContain('Treatment logged')

      // ── Treatment row inserted ──
      const tIns = insertsTo('treatments')
      expect(tIns).toHaveLength(1)
      const tRow = tIns[0].payload as Record<string, unknown>
      expect(tRow.animal_id).toBe('uuid-cow-284')
      expect(tRow.medicine).toBe('Noroclox')
      expect(tRow.dosage).toBe('10ml')
      expect(tRow.withdrawal_hours).toBe(72)
      expect(tRow.batch_number).toBe('B123')

      // ── Withdrawal reminder created ──
      const rIns = insertsTo('reminders')
      expect(rIns).toHaveLength(1)
      const rRow = rIns[0].payload as Record<string, unknown>
      expect(rRow.title).toContain('Withdrawal period ends')
      expect(rRow.title).toContain('Noroclox')
      expect(rRow.title).toContain('#284')
      expect(new Date(rRow.due_date as string).getTime()).toBeGreaterThan(Date.now())

      // ── Ledger entry created ──
      const lIns = insertsTo('ledger_entries')
      expect(lIns).toHaveLength(1)
      const lRow = lIns[0].payload as Record<string, unknown>
      expect(lRow.type).toBe('treatment')
      expect(lRow.description).toContain('#284')
      expect(lRow.description).toContain('Noroclox')
      expect(lRow.metadata_json).toBeDefined()
    })

    it('W2: Treatment for new animal → creates animal row first', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '999', animal_type: 'goat', medicine: 'Ivermectin' },
        message: 'Logged',
      })
      // Animal NOT found
      setDBResult('animals', 'select', null, { code: 'PGRST116', message: 'not found' })
      // Insert returns new UUID
      setDBResult('animals', 'insert', { id: 'uuid-goat-999' })

      await postChat({ message: 'Treated goat 999 with Ivermectin' })

      // Should insert into animals
      const aIns = insertsTo('animals')
      expect(aIns).toHaveLength(1)
      const aRow = aIns[0].payload as Record<string, unknown>
      expect(aRow.tag_number).toBe('999')
      expect(aRow.type).toBe('goat')

      // Treatment should reference the new animal
      const tIns = insertsTo('treatments')
      expect(tIns).toHaveLength(1)
    })

    it('W3: Treatment reduces medicine stock if medicine is in inventory', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '10', medicine: 'Vaccine-X' },
        message: 'Done',
      })
      setDBResult('animals', 'select', { id: 'uuid-10' })
      // Inventory has 15 units of Vaccine-X
      setDBResult('inventory', 'select', { quantity: 15 })

      await postChat({ message: 'Treated cow 10 with Vaccine-X' })

      // Should update inventory to 14
      const iUpd = updatesTo('inventory')
      expect(iUpd).toHaveLength(1)
      const iRow = iUpd[0].payload as Record<string, unknown>
      expect(iRow.quantity).toBe(14)
      expect(iRow.updated_at).toBeDefined()
    })

    it('W4: Treatment does NOT reduce stock if medicine not in inventory', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '10', medicine: 'RareStuff' },
        message: 'Done',
      })
      setDBResult('animals', 'select', { id: 'uuid-10' })
      // Medicine not found in inventory
      setDBResult('inventory', 'select', null)

      await postChat({ message: 'Treated cow 10 with RareStuff' })

      const iUpd = updatesTo('inventory')
      expect(iUpd).toHaveLength(0)
    })

    it('W5: Treatment skips DB writes when only partial data (no tag)', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { medicine: 'Noroclox' },
        message: 'Which animal?',
        follow_up_questions: ['Cow 284', 'Cow 100'],
      })

      await postChat({ message: 'Used Noroclox' })

      // No treatment, no animal, no reminder (only ledger)
      expect(insertsTo('treatments')).toHaveLength(0)
      expect(insertsTo('animals')).toHaveLength(0)
      expect(insertsTo('reminders')).toHaveLength(0)
    })

    it('W6: Treatment without withdrawal_hours does NOT create reminder', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '5', medicine: 'Pen' },
        message: 'Done',
      })
      setDBResult('animals', 'select', { id: 'uuid-5' })

      await postChat({ message: 'Treated cow 5 with Pen' })

      expect(insertsTo('treatments')).toHaveLength(1)
      expect(insertsTo('reminders')).toHaveLength(0) // no withdrawal reminder
    })

    it('W7: Treatment stock floor is 0 (never goes negative)', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '10', medicine: 'LastDose' },
        message: 'Done',
      })
      setDBResult('animals', 'select', { id: 'uuid-10' })
      setDBResult('inventory', 'select', { quantity: 0 })

      await postChat({ message: 'Treated cow 10 with LastDose' })

      const iUpd = updatesTo('inventory')
      expect(iUpd).toHaveLength(1)
      expect((iUpd[0].payload as Record<string, unknown>).quantity).toBe(0)
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  INVENTORY  — complete flow
  // ════════════════════════════════════════════════════════════════════
  describe('Inventory: full lifecycle', () => {

    it('W8: Post stock update → upserts inventory + creates ledger', async () => {
      mockAI.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'feed bags', quantity: 25, unit: 'bags' },
        message: 'Stock updated to 25 bags',
      })

      const res = await postChat({ message: 'I have 25 bags of feed' })
      const json = await res.json()

      expect(json.intent).toBe('inventory')

      // ── Inventory upserted ──
      const iUps = upsertsTo('inventory')
      expect(iUps).toHaveLength(1)
      const iRow = iUps[0].payload as Record<string, unknown>
      expect(iRow.item_name).toBe('feed bags')
      expect(iRow.quantity).toBe(25)
      expect(iRow.unit).toBe('bags')
      expect(iRow.updated_at).toBeDefined()
      expect(iUps[0].options).toEqual({ onConflict: 'item_name' })

      // ── Ledger ──
      const lIns = insertsTo('ledger_entries')
      expect(lIns).toHaveLength(1)
      const lRow = lIns[0].payload as Record<string, unknown>
      expect(lRow.type).toBe('inventory')
      expect(lRow.description).toContain('feed bags')
      expect(lRow.description).toContain('25')
    })

    it('W9: Inventory with no item_name → no upsert, no ledger error', async () => {
      mockAI.mockResolvedValue({
        intent: 'inventory',
        data: { quantity: 5 },
        message: 'What item?',
      })

      await postChat({ message: 'I have 5' })

      expect(upsertsTo('inventory')).toHaveLength(0)
    })

    it('W10: Inventory defaults quantity to 0 when missing', async () => {
      mockAI.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'syringes' },
        message: 'Noted',
      })

      await postChat({ message: 'syringes stock' })

      const iUps = upsertsTo('inventory')
      expect(iUps).toHaveLength(1)
      expect((iUps[0].payload as Record<string, unknown>).quantity).toBe(0)
    })

    it('W11: Inventory defaults unit to "units" when missing', async () => {
      mockAI.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'gloves', quantity: 100 },
        message: 'Updated',
      })

      await postChat({ message: '100 gloves' })

      const iUps = upsertsTo('inventory')
      expect(iUps).toHaveLength(1)
      expect((iUps[0].payload as Record<string, unknown>).unit).toBe('units')
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  INVOICE  — complete flow
  // ════════════════════════════════════════════════════════════════════
  describe('Invoice: full lifecycle', () => {

    it('W12: Post invoice with items → creates invoice + updates inventory for each item + ledger', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: {
          supplier: 'ABC Feeds', amount: 450,
          items: [
            { name: 'cattle feed', quantity: 20, unit: 'bags' },
            { name: 'salt lick', quantity: 5, unit: 'blocks' },
          ],
        },
        message: 'Invoice recorded!',
      })
      // Existing inventory
      setDBResult('inventory', 'select', { quantity: 10 })

      const res = await postChat({ message: 'Invoice $450 from ABC Feeds for 20 bags cattle feed and 5 salt lick blocks' })
      const json = await res.json()

      expect(json.intent).toBe('invoice')
      expect(json.message).toContain('Inventory has been updated')

      // ── Invoice inserted ──
      const invIns = insertsTo('invoices')
      expect(invIns).toHaveLength(1)
      const invRow = invIns[0].payload as Record<string, unknown>
      expect(invRow.supplier).toBe('ABC Feeds')
      expect(invRow.amount).toBe(450)
      expect(invRow.extracted_json).toBeDefined()

      // ── Inventory upserted for each item (quantity ADDED to existing) ──
      const iUps = upsertsTo('inventory')
      expect(iUps).toHaveLength(2)

      const feedUps = iUps.find(u => (u.payload as Record<string, unknown>).item_name === 'cattle feed')
      expect(feedUps).toBeDefined()
      expect((feedUps!.payload as Record<string, unknown>).quantity).toBe(30) // 10 existing + 20

      const saltUps = iUps.find(u => (u.payload as Record<string, unknown>).item_name === 'salt lick')
      expect(saltUps).toBeDefined()
      expect((saltUps!.payload as Record<string, unknown>).quantity).toBe(15) // 10 existing + 5

      // ── Ledger ──
      const lIns = insertsTo('ledger_entries')
      expect(lIns).toHaveLength(1)
      const lRow = lIns[0].payload as Record<string, unknown>
      expect(lRow.type).toBe('invoice')
      expect(lRow.description).toContain('ABC Feeds')
      expect(lRow.description).toContain('$450')
    })

    it('W13: Invoice without items → creates invoice only, no inventory changes', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: { supplier: 'Vet Supply', amount: 200 },
        message: 'Logged',
      })

      await postChat({ message: 'Invoice $200 from Vet Supply' })

      expect(insertsTo('invoices')).toHaveLength(1)
      expect(upsertsTo('inventory')).toHaveLength(0) // no items
    })

    it('W14: Invoice with new inventory item (not existing) adds from 0', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: {
          supplier: 'New Place', amount: 100,
          items: [{ name: 'new thing', quantity: 7, unit: 'boxes' }],
        },
        message: 'Done',
      })
      // Item not in inventory
      setDBResult('inventory', 'select', null)

      await postChat({ message: 'Invoice $100 from New Place for 7 boxes of new thing' })

      const iUps = upsertsTo('inventory')
      expect(iUps).toHaveLength(1)
      expect((iUps[0].payload as Record<string, unknown>).quantity).toBe(7)
      expect((iUps[0].payload as Record<string, unknown>).unit).toBe('boxes')
    })

    it('W15: Invoice defaults supplier to "Unknown"', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: { amount: 50 },
        message: 'Recorded',
      })

      await postChat({ message: 'Invoice $50' })

      const invIns = insertsTo('invoices')
      expect((invIns[0].payload as Record<string, unknown>).supplier).toBe('Unknown')
    })

    it('W16: Invoice defaults amount to 0 when missing', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: { supplier: 'TestCo' },
        message: 'Recorded',
      })

      await postChat({ message: 'Invoice from TestCo' })

      const invIns = insertsTo('invoices')
      expect((invIns[0].payload as Record<string, unknown>).amount).toBe(0)
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  REMINDER  — complete flow
  // ════════════════════════════════════════════════════════════════════
  describe('Reminder: full lifecycle', () => {

    it('W17: Post reminder → creates reminder + ledger', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Reorder feed', due_date: 'tomorrow morning' },
        message: 'Reminder set!',
      })

      const res = await postChat({ message: 'Remind me to reorder feed tomorrow morning' })
      const json = await res.json()

      expect(json.intent).toBe('reminder')

      // ── Reminder inserted ──
      const rIns = insertsTo('reminders')
      expect(rIns).toHaveLength(1)
      const rRow = rIns[0].payload as Record<string, unknown>
      expect(rRow.title).toBe('Reorder feed')
      const dueDate = new Date(rRow.due_date as string)
      expect(dueDate.getHours()).toBe(8) // morning = 8am

      // ── Ledger ──
      const lIns = insertsTo('ledger_entries')
      expect(lIns).toHaveLength(1)
      expect((lIns[0].payload as Record<string, unknown>).description).toContain('Reorder feed')
    })

    it('W18: Reminder "tomorrow afternoon" → due at 14:00', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Vaccination', due_date: 'tomorrow afternoon' },
        message: 'Set!',
      })

      await postChat({ message: 'Remind me tomorrow afternoon vaccination' })

      const rIns = insertsTo('reminders')
      const dueDate = new Date((rIns[0].payload as Record<string, unknown>).due_date as string)
      expect(dueDate.getHours()).toBe(14)
    })

    it('W19: Reminder "tomorrow evening" → due at 18:00', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Close barn', due_date: 'tomorrow evening' },
        message: 'Set!',
      })

      await postChat({ message: 'Remind me tomorrow evening to close barn' })

      const rIns = insertsTo('reminders')
      const dueDate = new Date((rIns[0].payload as Record<string, unknown>).due_date as string)
      expect(dueDate.getHours()).toBe(18)
    })

    it('W20: Reminder "next week" → due in 7 days', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Vet visit', due_date: 'next week' },
        message: 'Set!',
      })

      const now = Date.now()
      await postChat({ message: 'Remind me next week vet visit' })

      const rIns = insertsTo('reminders')
      const dueMs = new Date((rIns[0].payload as Record<string, unknown>).due_date as string).getTime()
      const diffDays = Math.round((dueMs - now) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBeGreaterThanOrEqual(6)
      expect(diffDays).toBeLessThanOrEqual(8)
    })

    it('W21: Reminder with ISO date string → parsed correctly', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Checkup', due_date: '2026-06-15T10:00:00Z' },
        message: 'Set!',
      })

      await postChat({ message: 'Remind me checkup on June 15' })

      const rIns = insertsTo('reminders')
      const dueDate = new Date((rIns[0].payload as Record<string, unknown>).due_date as string)
      expect(dueDate.getFullYear()).toBe(2026)
      expect(dueDate.getUTCMonth()).toBe(5) // June = 5
      expect(dueDate.getUTCDate()).toBe(15)
    })

    it('W22: Reminder with no due_date → defaults to tomorrow', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Feed animals' },
        message: 'Set!',
      })

      const now = new Date()
      await postChat({ message: 'Remind me to feed animals' })

      const rIns = insertsTo('reminders')
      const dueDate = new Date((rIns[0].payload as Record<string, unknown>).due_date as string)
      expect(dueDate.getDate()).toBe(now.getDate() + 1)
    })

    it('W23: Reminder with unparseable date → falls back to tomorrow', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Something', due_date: 'blahblahblah' },
        message: 'Set!',
      })

      const now = new Date()
      await postChat({ message: 'test' })

      const rIns = insertsTo('reminders')
      const dueDate = new Date((rIns[0].payload as Record<string, unknown>).due_date as string)
      expect(dueDate.getDate()).toBe(now.getDate() + 1)
    })

    it('W24: Reminder without title → no insert', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { due_date: 'tomorrow' },
        message: 'What should I remind?',
      })

      await postChat({ message: 'Remind me tomorrow' })

      expect(insertsTo('reminders')).toHaveLength(0)
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  GENERAL  — no side effects
  // ════════════════════════════════════════════════════════════════════
  describe('General intent: no DB mutations', () => {

    it('W25: Greeting → no DB writes at all', async () => {
      mockAI.mockResolvedValue({
        intent: 'general',
        data: {},
        message: 'Hello! How can I help?',
        follow_up_questions: [],
      })

      const res = await postChat({ message: 'Hi' })
      const json = await res.json()

      expect(json.intent).toBe('general')
      expect(writes).toHaveLength(0) // ZERO writes
    })

    it('W26: Empty message → returns prompt, no DB writes', async () => {
      const res = await postChat({})
      const json = await res.json()

      expect(json.message).toContain('send a message')
      expect(writes).toHaveLength(0)
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  CONVERSATION HISTORY  — forwarding to AI
  // ════════════════════════════════════════════════════════════════════
  describe('Conversation history', () => {

    it('W27: History is forwarded to processMessage', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { withdrawal_hours: 72, batch_number: 'B1' },
        message: 'Updated!',
      })

      const history = [
        { role: 'user', content: 'Treated cow 284 with Noroclox' },
        { role: 'assistant', content: 'What is the withdrawal period?' },
      ]

      await postChat({ message: '72 hours, batch B1', history })

      expect(mockAI).toHaveBeenCalledWith(
        '72 hours, batch B1',
        undefined,
        history,
      )
    })

    it('W28: Missing history → processMessage called with undefined history', async () => {
      mockAI.mockResolvedValue({ intent: 'general', data: {}, message: 'Hello' })

      await postChat({ message: 'Hi' })

      expect(mockAI).toHaveBeenCalledWith('Hi', undefined, undefined)
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  LEDGER  — verify descriptions for every intent
  // ════════════════════════════════════════════════════════════════════
  describe('Ledger description accuracy', () => {

    it('W29: Treatment ledger → "Treated animal #TAG with MEDICINE"', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '42', medicine: 'Penicillin', withdrawal_hours: 48 },
        message: 'Done',
      })
      setDBResult('animals', 'select', { id: 'uuid-42' })

      await postChat({ message: 'test' })

      const desc = (insertsTo('ledger_entries')[0].payload as Record<string, unknown>).description as string
      expect(desc).toBe('Treated animal #42 with Penicillin')
    })

    it('W30: Inventory ledger → "Inventory updated: ITEM → QTY"', async () => {
      mockAI.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'hay', quantity: 50 },
        message: 'Done',
      })

      await postChat({ message: 'test' })

      const desc = (insertsTo('ledger_entries')[0].payload as Record<string, unknown>).description as string
      expect(desc).toBe('Inventory updated: hay → 50')
    })

    it('W31: Invoice ledger → "Invoice from SUPPLIER: $AMOUNT"', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: { supplier: 'FeedCo', amount: 200 },
        message: 'Done',
      })

      await postChat({ message: 'test' })

      const desc = (insertsTo('ledger_entries')[0].payload as Record<string, unknown>).description as string
      expect(desc).toBe('Invoice from FeedCo: $200')
    })

    it('W32: Reminder ledger → "Reminder created: TITLE"', async () => {
      mockAI.mockResolvedValue({
        intent: 'reminder',
        data: { title: 'Order feed', due_date: 'tomorrow' },
        message: 'Done',
      })

      await postChat({ message: 'test' })

      const desc = (insertsTo('ledger_entries')[0].payload as Record<string, unknown>).description as string
      expect(desc).toBe('Reminder created: Order feed')
    })

    it('W33: Missing data uses fallback in descriptions', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { withdrawal_hours: 24 },
        message: 'Need more info',
      })

      await postChat({ message: 'test' })

      const desc = (insertsTo('ledger_entries')[0].payload as Record<string, unknown>).description as string
      expect(desc).toContain('unknown')
      expect(desc).toContain('unknown medicine')
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  ERROR HANDLING
  // ════════════════════════════════════════════════════════════════════
  describe('Error handling', () => {

    it('W34: AI service crash → 500 with error intent', async () => {
      mockAI.mockRejectedValue(new Error('OpenAI rate limit'))

      const res = await postChat({ message: 'test' })

      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.intent).toBe('error')
      expect(json.message).toContain('trouble processing')
      expect(writes).toHaveLength(0)
    })

    it('W35: DB error in handleIntent → still returns response (graceful degradation)', async () => {
      mockAI.mockResolvedValue({
        intent: 'inventory',
        data: { item_name: 'feed', quantity: 10 },
        message: 'Updated',
      })
      // Force upsert to fail
      setDBResult('inventory', 'upsert', null, { message: 'DB down', code: 'CONN_ERR' })

      const res = await postChat({ message: 'test' })
      // The route catches handleIntent errors and still returns
      expect(res.status).toBe(200)
    })
  })

  // ════════════════════════════════════════════════════════════════════
  //  EDGE CASES
  // ════════════════════════════════════════════════════════════════════
  describe('Edge cases', () => {

    it('W36: XSS in message → processed without executing', async () => {
      mockAI.mockResolvedValue({ intent: 'general', data: {}, message: 'OK' })

      const res = await postChat({ message: '<script>alert("xss")</script>' })
      const json = await res.json()

      expect(json.message).not.toContain('<script>')
      expect(writes).toHaveLength(0)
    })

    it('W37: Very long message → processed normally', async () => {
      mockAI.mockResolvedValue({ intent: 'general', data: {}, message: 'Got it' })

      const res = await postChat({ message: 'a'.repeat(10000) })
      expect(res.status).toBe(200)
    })

    it('W38: Invoice with 0 amount and items → still processes items', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: {
          supplier: 'Free Sample Co', amount: 0,
          items: [{ name: 'sample feed', quantity: 2, unit: 'bags' }],
        },
        message: 'Recorded',
      })
      setDBResult('inventory', 'select', null)

      await postChat({ message: 'test' })

      expect(insertsTo('invoices')).toHaveLength(1)
      expect((insertsTo('invoices')[0].payload as Record<string, unknown>).amount).toBe(0)
      expect(upsertsTo('inventory')).toHaveLength(1)
      expect((upsertsTo('inventory')[0].payload as Record<string, unknown>).quantity).toBe(2)
    })

    it('W39: Treatment with withdrawal_hours=0 → no reminder created', async () => {
      mockAI.mockResolvedValue({
        intent: 'treatment',
        data: { tag_number: '1', medicine: 'Saline', withdrawal_hours: 0 },
        message: 'Done',
      })
      setDBResult('animals', 'select', { id: 'uuid-1' })

      await postChat({ message: 'test' })

      expect(insertsTo('reminders')).toHaveLength(0)
    })

    it('W40: Attachments forwarded to AI service', async () => {
      mockAI.mockResolvedValue({
        intent: 'invoice',
        data: { supplier: 'Scan', amount: 99 },
        message: 'Scanned!',
      })

      await postChat({
        message: 'Process this invoice',
        attachments: ['https://storage.example/receipt.jpg'],
      })

      expect(mockAI).toHaveBeenCalledWith(
        'Process this invoice',
        ['https://storage.example/receipt.jpg'],
        undefined,
      )
    })
  })
})
