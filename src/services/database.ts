import { supabase } from '@/lib/supabase'
import type { Animal, Treatment, InventoryItem, Invoice, Reminder, LedgerEntry, ChatSession, ChatMessageRow, FarmContext } from '@/types'

// ── Farm Context (for chat validation) ───────────────────────────────
export async function getFarmContext(): Promise<FarmContext> {
  const [animalsRes, inventoryRes, invoicesRes] = await Promise.all([
    supabase.from('animals').select('tag_number, type, status').order('created_at', { ascending: false }),
    supabase.from('inventory').select('item_name, quantity, unit').order('item_name', { ascending: true }),
    supabase.from('invoices').select('supplier').order('created_at', { ascending: false }).limit(50),
  ])

  const animals = Array.isArray(animalsRes.data) ? animalsRes.data : []
  const inventory = Array.isArray(inventoryRes.data) ? inventoryRes.data : []
  const invoiceRows = Array.isArray(invoicesRes.data) ? invoicesRes.data : []

  // Extract unique supplier names
  const suppliers = [...new Set(
    invoiceRows
      .map(i => i.supplier as string)
      .filter(s => s && s !== 'Unknown' && s !== 'unknown')
  )]

  return { animals, inventory, suppliers }
}

// ── Animals ──────────────────────────────────────────────────────────
export async function getAnimals() {
  const { data, error } = await supabase
    .from('animals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Animal[]
}

export async function getAnimalByTag(tagNumber: string) {
  const { data, error } = await supabase
    .from('animals')
    .select('*')
    .eq('tag_number', tagNumber)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as Animal | null
}

export async function createAnimal(animal: Partial<Animal>) {
  const { data, error } = await supabase
    .from('animals')
    .insert(animal)
    .select()
    .single()
  if (error) throw error
  return data as Animal
}

export async function updateAnimal(id: string, updates: Partial<Animal>) {
  const { data, error } = await supabase
    .from('animals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Animal
}

// ── Treatments ───────────────────────────────────────────────────────
export async function getTreatments(limit = 20) {
  const { data, error } = await supabase
    .from('treatments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as Treatment[]
}

export async function createTreatment(treatment: Partial<Treatment>) {
  const { data, error } = await supabase
    .from('treatments')
    .insert(treatment)
    .select()
    .single()
  if (error) throw error
  return data as Treatment
}

// ── Inventory ────────────────────────────────────────────────────────
export async function getInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('item_name', { ascending: true })
  if (error) throw error
  return data as InventoryItem[]
}

export async function getLowStockItems(threshold = 10) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .lt('quantity', threshold)
  if (error) throw error
  return data as InventoryItem[]
}

export async function upsertInventoryItem(item: Partial<InventoryItem>) {
  const { data, error } = await supabase
    .from('inventory')
    .upsert(item, { onConflict: 'item_name' })
    .select()
    .single()
  if (error) throw error
  return data as InventoryItem
}

export async function updateInventoryQuantity(itemName: string, quantity: number) {
  const { data, error } = await supabase
    .from('inventory')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('item_name', itemName)
    .select()
    .single()
  if (error) throw error
  return data as InventoryItem
}

export async function deleteInventoryItem(id: string) {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Invoices ─────────────────────────────────────────────────────────
export async function getInvoices(limit = 20) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as Invoice[]
}

export async function createInvoice(invoice: Partial<Invoice>) {
  const { data, error } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single()
  if (error) throw error
  return data as Invoice
}

// ── Reminders ────────────────────────────────────────────────────────
export async function getReminders(status?: string) {
  let query = supabase
    .from('reminders')
    .select('*')
    .order('due_date', { ascending: true })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data as Reminder[]
}

export async function createReminder(reminder: Partial<Reminder>) {
  const { data, error } = await supabase
    .from('reminders')
    .insert(reminder)
    .select()
    .single()
  if (error) throw error
  return data as Reminder
}

export async function updateReminderStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('reminders')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Reminder
}

// ── Ledger ───────────────────────────────────────────────────────────
export async function getLedgerEntries(limit = 50) {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as LedgerEntry[]
}

export async function createLedgerEntry(entry: Partial<LedgerEntry>) {
  const { data, error } = await supabase
    .from('ledger_entries')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data as LedgerEntry
}

// ── Dashboard Stats ──────────────────────────────────────────────────
export async function getDashboardStats() {
  const [lowStock, reminders, treatments, ledger, animals, invoices] = await Promise.all([
    supabase.from('inventory').select('id', { count: 'exact' }).lt('quantity', 5),
    supabase.from('reminders').select('id', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('treatments').select('id', { count: 'exact' }).gte('created_at', new Date().toISOString().split('T')[0]),
    supabase.from('ledger_entries').select('id', { count: 'exact' }),
    supabase.from('animals').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('invoices').select('amount'),
  ])

  const totalExpenses = (invoices.data || []).reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)

  return {
    lowStockCount: lowStock.count || 0,
    pendingReminders: reminders.count || 0,
    todayTreatments: treatments.count || 0,
    totalActivities: ledger.count || 0,
    totalAnimals: animals.count || 0,
    totalExpenses,
  }
}

// ── Chat Sessions ────────────────────────────────────────────────────
export async function getChatSessions() {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as ChatSession[]
}

export async function createChatSession(title = 'New Chat') {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ title })
    .select()
    .single()
  if (error) throw error
  return data as ChatSession
}

export async function updateChatSessionTitle(id: string, title: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ChatSession
}

export async function deleteChatSession(id: string) {
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getChatMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ChatMessageRow[]
}

export async function saveChatMessage(
  sessionId: string,
  message: { role: 'user' | 'assistant'; content: string; intent?: string; attachments?: string[]; quick_replies?: string[] }
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role: message.role,
      content: message.content,
      intent: message.intent || null,
      attachments: message.attachments || null,
      quick_replies: message.quick_replies || null,
    })
    .select()
    .single()
  if (error) throw error

  // Touch session updated_at
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  return data as ChatMessageRow
}
