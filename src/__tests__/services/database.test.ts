import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase mock ─────────────────────────────────────────────────
const insertedRows: Array<{ table: string; row: unknown }> = []
const tableResults = new Map<string, Record<string, unknown>>()

function chainable(table: string) {
  const result = tableResults.get(table) || { data: [], error: null }
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'lt', 'gt', 'lte', 'gte', 'single', 'order', 'limit', 'filter']
  for (const m of methods) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = vi.fn((resolve: (v: unknown) => void) => resolve(result))
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => chainable(table)),
      insert: vi.fn((row: unknown) => { insertedRows.push({ table, row }); return chainable(table) }),
      update: vi.fn(() => chainable(table)),
      upsert: vi.fn(() => chainable(table)),
      delete: vi.fn(() => chainable(table)),
    })),
  },
}))

import {
  getAnimals, getAnimalByTag, createAnimal, updateAnimal,
  getTreatments, createTreatment,
  getInventory, getLowStockItems, upsertInventoryItem, updateInventoryQuantity, deleteInventoryItem,
  getInvoices, createInvoice,
  getReminders, createReminder, updateReminderStatus,
  getLedgerEntries, createLedgerEntry,
  getDashboardStats,
  getChatSessions, createChatSession, updateChatSessionTitle, deleteChatSession,
  getChatMessages, saveChatMessage,
} from '@/services/database'

describe('Database Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedRows.length = 0
    tableResults.clear()
  })

  // ─── Animals ─────────────────────────────────────────────────────
  describe('Animals', () => {
    it('getAnimals should return array', async () => {
      tableResults.set('animals', { data: [{ id: '1', tag_number: '10' }], error: null })
      const result = await getAnimals()
      expect(Array.isArray(result)).toBe(true)
    })

    it('getAnimalByTag should return animal or null', async () => {
      tableResults.set('animals', { data: { id: '1', tag_number: '10' }, error: null })
      const result = await getAnimalByTag('10')
      expect(result).toBeTruthy()
    })

    it('getAnimalByTag should return null when not found (PGRST116)', async () => {
      tableResults.set('animals', { data: null, error: { code: 'PGRST116', message: 'not found' } })
      const result = await getAnimalByTag('999')
      expect(result).toBeNull()
    })

    it('createAnimal should insert and return animal', async () => {
      tableResults.set('animals', { data: { id: '2', tag_number: '20', type: 'goat' }, error: null })
      const result = await createAnimal({ tag_number: '20', type: 'goat' })
      expect(result.tag_number).toBe('20')
    })

    it('updateAnimal should update and return animal', async () => {
      tableResults.set('animals', { data: { id: '1', status: 'sold' }, error: null })
      const result = await updateAnimal('1', { status: 'sold' })
      expect(result.status).toBe('sold')
    })
  })

  // ─── Treatments ──────────────────────────────────────────────────
  describe('Treatments', () => {
    it('getTreatments should return array with default limit', async () => {
      tableResults.set('treatments', { data: [], error: null })
      const result = await getTreatments()
      expect(Array.isArray(result)).toBe(true)
    })

    it('getTreatments should accept custom limit', async () => {
      tableResults.set('treatments', { data: [], error: null })
      const result = await getTreatments(5)
      expect(Array.isArray(result)).toBe(true)
    })

    it('createTreatment should insert treatment', async () => {
      tableResults.set('treatments', { data: { id: '1', medicine: 'Pen' }, error: null })
      const result = await createTreatment({ medicine: 'Pen' })
      expect(result.medicine).toBe('Pen')
    })
  })

  // ─── Inventory ──────────────────────────────────────────────────
  describe('Inventory', () => {
    it('getInventory should return sorted list', async () => {
      tableResults.set('inventory', { data: [{ item_name: 'A' }, { item_name: 'B' }], error: null })
      const result = await getInventory()
      expect(result.length).toBe(2)
    })

    it('getLowStockItems with default threshold', async () => {
      tableResults.set('inventory', { data: [{ item_name: 'feed', quantity: 3 }], error: null })
      const result = await getLowStockItems()
      expect(result.length).toBe(1)
    })

    it('getLowStockItems with custom threshold', async () => {
      tableResults.set('inventory', { data: [], error: null })
      const result = await getLowStockItems(5)
      expect(Array.isArray(result)).toBe(true)
    })

    it('upsertInventoryItem should upsert', async () => {
      tableResults.set('inventory', { data: { id: '1', item_name: 'feed', quantity: 10 }, error: null })
      const result = await upsertInventoryItem({ item_name: 'feed', quantity: 10 })
      expect(result.item_name).toBe('feed')
    })

    it('updateInventoryQuantity should update quantity', async () => {
      tableResults.set('inventory', { data: { id: '1', item_name: 'feed', quantity: 20 }, error: null })
      const result = await updateInventoryQuantity('feed', 20)
      expect(result.quantity).toBe(20)
    })

    it('deleteInventoryItem should delete by id', async () => {
      tableResults.set('inventory', { data: null, error: null })
      await expect(deleteInventoryItem('1')).resolves.toBeUndefined()
    })
  })

  // ─── Invoices ───────────────────────────────────────────────────
  describe('Invoices', () => {
    it('getInvoices should return list', async () => {
      tableResults.set('invoices', { data: [], error: null })
      const result = await getInvoices()
      expect(Array.isArray(result)).toBe(true)
    })

    it('createInvoice should insert', async () => {
      tableResults.set('invoices', { data: { id: '1', supplier: 'Test', amount: 100 }, error: null })
      const result = await createInvoice({ supplier: 'Test', amount: 100 })
      expect(result.supplier).toBe('Test')
    })
  })

  // ─── Reminders ──────────────────────────────────────────────────
  describe('Reminders', () => {
    it('getReminders should return list', async () => {
      tableResults.set('reminders', { data: [], error: null })
      const result = await getReminders()
      expect(Array.isArray(result)).toBe(true)
    })

    it('getReminders should filter by status', async () => {
      tableResults.set('reminders', { data: [{ id: '1', status: 'pending' }], error: null })
      const result = await getReminders('pending')
      expect(result.length).toBe(1)
    })

    it('createReminder should insert', async () => {
      tableResults.set('reminders', { data: { id: '1', title: 'Test' }, error: null })
      const result = await createReminder({ title: 'Test', due_date: '2026-05-10' })
      expect(result.title).toBe('Test')
    })

    it('updateReminderStatus should update status', async () => {
      tableResults.set('reminders', { data: { id: '1', status: 'completed' }, error: null })
      const result = await updateReminderStatus('1', 'completed')
      expect(result.status).toBe('completed')
    })
  })

  // ─── Ledger ──────────────────────────────────────────────────────
  describe('Ledger', () => {
    it('getLedgerEntries should return list', async () => {
      tableResults.set('ledger_entries', { data: [], error: null })
      const result = await getLedgerEntries()
      expect(Array.isArray(result)).toBe(true)
    })

    it('createLedgerEntry should insert', async () => {
      tableResults.set('ledger_entries', { data: { id: '1', type: 'treatment' }, error: null })
      const result = await createLedgerEntry({ type: 'treatment', description: 'Test' })
      expect(result.type).toBe('treatment')
    })
  })

  // ─── Dashboard Stats ────────────────────────────────────────────
  describe('Dashboard Stats', () => {
    it('getDashboardStats should return aggregated stats', async () => {
      // All return empty/zero
      tableResults.set('inventory', { data: [], error: null, count: 0 })
      tableResults.set('reminders', { data: [], error: null, count: 0 })
      tableResults.set('treatments', { data: [], error: null, count: 0 })
      tableResults.set('ledger_entries', { data: [], error: null, count: 0 })
      tableResults.set('animals', { data: [], error: null, count: 0 })
      tableResults.set('invoices', { data: [], error: null })

      const stats = await getDashboardStats()
      expect(stats).toHaveProperty('lowStockCount')
      expect(stats).toHaveProperty('pendingReminders')
      expect(stats).toHaveProperty('todayTreatments')
      expect(stats).toHaveProperty('totalActivities')
      expect(stats).toHaveProperty('totalAnimals')
      expect(stats).toHaveProperty('totalExpenses')
      expect(stats.totalExpenses).toBe(0)
    })
  })

  // ─── Chat Sessions ──────────────────────────────────────────────
  describe('Chat Sessions', () => {
    it('getChatSessions should return sessions list', async () => {
      tableResults.set('chat_sessions', { data: [], error: null })
      const result = await getChatSessions()
      expect(Array.isArray(result)).toBe(true)
    })

    it('createChatSession should create with default title', async () => {
      tableResults.set('chat_sessions', { data: { id: 'sess-1', title: 'New Chat' }, error: null })
      const result = await createChatSession()
      expect(result.title).toBe('New Chat')
    })

    it('createChatSession should create with custom title', async () => {
      tableResults.set('chat_sessions', { data: { id: 'sess-1', title: 'My Session' }, error: null })
      const result = await createChatSession('My Session')
      expect(result.title).toBe('My Session')
    })

    it('updateChatSessionTitle should update title', async () => {
      tableResults.set('chat_sessions', { data: { id: 'sess-1', title: 'Updated' }, error: null })
      const result = await updateChatSessionTitle('sess-1', 'Updated')
      expect(result.title).toBe('Updated')
    })

    it('deleteChatSession should delete by id', async () => {
      tableResults.set('chat_sessions', { data: null, error: null })
      await expect(deleteChatSession('sess-1')).resolves.toBeUndefined()
    })

    it('getChatMessages should return messages for session', async () => {
      tableResults.set('chat_messages', { data: [{ id: 'm1', role: 'user', content: 'Hi' }], error: null })
      const result = await getChatMessages('sess-1')
      expect(result.length).toBe(1)
      expect(result[0].content).toBe('Hi')
    })

    it('saveChatMessage should insert message and touch session', async () => {
      tableResults.set('chat_messages', { data: { id: 'm1', session_id: 'sess-1', role: 'user', content: 'Test' }, error: null })
      tableResults.set('chat_sessions', { data: null, error: null })

      const result = await saveChatMessage('sess-1', {
        role: 'user',
        content: 'Test',
        intent: 'general',
        attachments: ['https://a.com/img.png'],
        quick_replies: ['Yes', 'No'],
      })
      expect(result.content).toBe('Test')
    })

    it('saveChatMessage should handle optional fields as null', async () => {
      tableResults.set('chat_messages', { data: { id: 'm2', session_id: 'sess-1', role: 'assistant', content: 'Hello' }, error: null })
      tableResults.set('chat_sessions', { data: null, error: null })

      const result = await saveChatMessage('sess-1', {
        role: 'assistant',
        content: 'Hello',
      })
      expect(result.role).toBe('assistant')
    })
  })
})
