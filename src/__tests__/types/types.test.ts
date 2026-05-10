import { describe, it, expect } from 'vitest'
import type {
  ChatMessage, ChatSession, ChatMessageRow,
  AIResponse, Animal, Treatment, InventoryItem,
  Invoice, Reminder, LedgerEntry, DashboardStats, User,
} from '@/types'

describe('Type Contracts', () => {
  it('ChatMessage should have required fields', () => {
    const msg: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    }
    expect(msg.role).toBe('user')
    expect(msg.id).toBeDefined()
    expect(msg.content).toBeDefined()
    expect(msg.timestamp).toBeDefined()
  })

  it('ChatMessage should accept optional fields', () => {
    const msg: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Hi',
      timestamp: new Date().toISOString(),
      intent: 'general',
      attachments: ['https://img.png'],
      quickReplies: ['Yes', 'No'],
    }
    expect(msg.intent).toBe('general')
    expect(msg.attachments).toHaveLength(1)
    expect(msg.quickReplies).toHaveLength(2)
  })

  it('ChatSession should have required fields', () => {
    const session: ChatSession = {
      id: 'sess-1',
      title: 'Test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(session.id).toBeDefined()
    expect(session.title).toBe('Test')
  })

  it('ChatMessageRow should have required fields', () => {
    const row: ChatMessageRow = {
      id: 'm-1',
      session_id: 'sess-1',
      role: 'user',
      content: 'Hello',
      intent: null,
      attachments: null,
      quick_replies: null,
      created_at: new Date().toISOString(),
    }
    expect(row.session_id).toBe('sess-1')
    expect(row.intent).toBeNull()
  })

  it('AIResponse should have required fields', () => {
    const res: AIResponse = {
      intent: 'treatment',
      data: { tag_number: '1' },
    }
    expect(res.intent).toBe('treatment')
    expect(res.data.tag_number).toBe('1')
  })

  it('AIResponse should accept optional fields', () => {
    const res: AIResponse = {
      intent: 'general',
      data: {},
      message: 'Hello',
      follow_up_questions: ['A', 'B'],
    }
    expect(res.message).toBe('Hello')
    expect(res.follow_up_questions).toHaveLength(2)
  })

  it('Animal status should be one of active, sold, deceased', () => {
    const animal: Animal = {
      id: '1', tag_number: '10', type: 'cow', status: 'active', created_at: '',
    }
    expect(['active', 'sold', 'deceased']).toContain(animal.status)
  })

  it('Reminder status should be one of pending, completed, cancelled', () => {
    const reminder: Reminder = {
      id: '1', title: 'Test', due_date: '', status: 'pending', created_at: '',
    }
    expect(['pending', 'completed', 'cancelled']).toContain(reminder.status)
  })

  it('DashboardStats should have all numeric fields', () => {
    const stats: DashboardStats = {
      lowStockCount: 0,
      pendingReminders: 0,
      todayTreatments: 0,
      totalActivities: 0,
      totalAnimals: 0,
      totalExpenses: 0,
    }
    for (const val of Object.values(stats)) {
      expect(typeof val).toBe('number')
    }
  })

  it('InventoryItem should have quantity and unit', () => {
    const item: InventoryItem = {
      id: '1', item_name: 'feed', quantity: 10, unit: 'bags', created_at: '', updated_at: '',
    }
    expect(item.quantity).toBe(10)
    expect(item.unit).toBe('bags')
  })

  it('Treatment should have medicine field', () => {
    const t: Treatment = {
      id: '1', animal_id: 'a1', medicine: 'Pen', dosage: '5ml',
      withdrawal_hours: 72, batch_number: 'B1', created_at: '',
    }
    expect(t.medicine).toBe('Pen')
  })

  it('Invoice should have amount', () => {
    const inv: Invoice = {
      id: '1', image_url: '', supplier: 'Test', amount: 100,
      extracted_json: {}, created_at: '',
    }
    expect(inv.amount).toBe(100)
  })

  it('LedgerEntry should have type and description', () => {
    const entry: LedgerEntry = {
      id: '1', type: 'treatment', description: 'test', metadata_json: {}, created_at: '',
    }
    expect(entry.type).toBe('treatment')
  })

  it('User should have required fields', () => {
    const user: User = {
      id: '1', name: 'John', phone: '123', farm_name: 'Green Farm', created_at: '',
    }
    expect(user.name).toBe('John')
  })
})
