import { NextRequest, NextResponse } from 'next/server'
import { processMessage } from '@/services/ai'
import { supabase } from '@/lib/supabase'
import { AIResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { message, attachments, history } = await request.json()

    if (!message && (!attachments || attachments.length === 0)) {
      return NextResponse.json({
        intent: 'general',
        data: {},
        message: 'Please send a message or upload an image.',
      })
    }

    // Process with AI (pass conversation history for context)
    const aiResponse: AIResponse = await processMessage(message, attachments, history)

    // Handle general/greeting intent — no DB ops needed
    if (aiResponse.intent === 'general') {
      return NextResponse.json(aiResponse)
    }

    // Perform deterministic operations based on intent
    const result = await handleIntent(aiResponse)

    return NextResponse.json({
      ...aiResponse,
      ...result,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({
      intent: 'error',
      data: {},
      message: "I'm having trouble processing that. Could you try rephrasing?",
    }, { status: 500 })
  }
}

async function handleIntent(response: AIResponse): Promise<Partial<AIResponse>> {
  const { intent, data } = response
  let extraMessage = ''

  try {
    switch (intent) {
      case 'treatment':
        extraMessage = await handleTreatment(data)
        break
      case 'inventory':
        extraMessage = await handleInventory(data)
        break
      case 'invoice':
        extraMessage = await handleInvoice(data)
        break
      case 'reminder':
        extraMessage = await handleReminder(data)
        break
    }

    // Create ledger entry
    await createLedgerEntry(intent, buildLedgerDescription(intent, data), data)
  } catch (error) {
    console.error(`Error handling ${intent}:`, error)
  }

  return extraMessage ? { message: response.message + ' ' + extraMessage } : {}
}

function buildLedgerDescription(intent: string, data: Record<string, unknown>): string {
  switch (intent) {
    case 'treatment': {
      const tag = data.tag_number || data.animal_id || 'unknown'
      const med = data.medicine || 'unknown medicine'
      return `Treated animal #${tag} with ${med}`
    }
    case 'inventory': {
      const item = data.item_name || 'item'
      const qty = data.quantity ?? '?'
      return `Inventory updated: ${item} → ${qty}`
    }
    case 'invoice': {
      const supplier = data.supplier || 'unknown supplier'
      const amount = data.amount || 0
      return `Invoice from ${supplier}: $${amount}`
    }
    case 'reminder': {
      const title = data.title || 'Reminder'
      return `Reminder created: ${title}`
    }
    default:
      return `Action: ${intent}`
  }
}

async function handleTreatment(data: Record<string, unknown>): Promise<string> {
  const tagNumber = (data.tag_number || data.animal_id) as string | undefined
  const medicine = data.medicine as string | undefined
  const dosage = data.dosage as string | undefined
  const withdrawalHours = data.withdrawal_hours as number | undefined
  const batchNumber = data.batch_number as string | undefined

  if (!tagNumber && !withdrawalHours && !batchNumber) {
    return '' // Partial data with follow-ups — don't write yet
  }

  let animalUuid: string | undefined

  if (tagNumber) {
    // Look up or create animal
    const { data: animal } = await supabase
      .from('animals')
      .select('id')
      .eq('tag_number', tagNumber)
      .single()

    if (animal) {
      animalUuid = animal.id
    } else {
      const animalType = (data.animal_type as string) || 'cow'
      const { data: newAnimal, error } = await supabase
        .from('animals')
        .insert({ tag_number: tagNumber, type: animalType })
        .select('id')
        .single()
      if (error) throw error
      animalUuid = newAnimal.id
    }
  }

  // Only insert if we have enough data
  if (animalUuid && medicine) {
    const { error } = await supabase
      .from('treatments')
      .insert({
        animal_id: animalUuid,
        medicine,
        dosage: dosage || null,
        withdrawal_hours: withdrawalHours || null,
        batch_number: batchNumber || null,
      })
    if (error) throw error

    // Reduce medicine inventory if it exists
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('item_name', medicine)
      .single()

    if (inv) {
      await supabase
        .from('inventory')
        .update({ quantity: Math.max(0, inv.quantity - 1), updated_at: new Date().toISOString() })
        .eq('item_name', medicine)
    }

    // Create withdrawal reminder
    if (withdrawalHours && withdrawalHours > 0) {
      const dueDate = new Date()
      dueDate.setHours(dueDate.getHours() + withdrawalHours)
      await supabase.from('reminders').insert({
        title: `Withdrawal period ends: ${medicine} on animal #${tagNumber}`,
        due_date: dueDate.toISOString(),
      })
    }
  }

  return ''
}

async function handleInventory(data: Record<string, unknown>): Promise<string> {
  const itemName = data.item_name as string | undefined
  const quantity = data.quantity as number | undefined

  if (!itemName) return ''

  const { error } = await supabase.from('inventory').upsert(
    {
      item_name: itemName,
      quantity: quantity ?? 0,
      unit: (data.unit as string) || 'units',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'item_name' }
  )

  if (error) throw error

  return ''
}

async function handleInvoice(data: Record<string, unknown>): Promise<string> {
  const supplier = data.supplier as string | undefined
  const amount = data.amount as number | undefined

  await supabase.from('invoices').insert({
    supplier: supplier || 'Unknown',
    amount: amount ? Number(amount) : 0,
    image_url: (data.image_url as string) || null,
    extracted_json: data,
  })

  // Update inventory from invoice items
  const items = data.items as Array<{ name: string; quantity: number; unit?: string }> | undefined
  if (items && Array.isArray(items)) {
    for (const item of items) {
      // Get existing quantity and add to it
      const { data: existing } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('item_name', item.name)
        .single()

      const newQty = (existing?.quantity || 0) + (item.quantity || 0)
      await supabase.from('inventory').upsert(
        { item_name: item.name, quantity: newQty, unit: item.unit || 'units' },
        { onConflict: 'item_name' }
      )
    }
    return 'Inventory has been updated with the new items.'
  }

  return ''
}

async function handleReminder(data: Record<string, unknown>): Promise<string> {
  const title = data.title as string | undefined
  let dueDateStr = data.due_date as string | undefined

  if (!title) return ''

  // Parse relative dates
  let dueDate: Date
  if (!dueDateStr) {
    dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 1) // default: tomorrow
  } else {
    const lower = dueDateStr.toLowerCase()
    dueDate = new Date()
    if (lower.includes('tomorrow')) {
      dueDate.setDate(dueDate.getDate() + 1)
      if (lower.includes('morning')) dueDate.setHours(8, 0, 0, 0)
      else if (lower.includes('afternoon')) dueDate.setHours(14, 0, 0, 0)
      else if (lower.includes('evening')) dueDate.setHours(18, 0, 0, 0)
    } else if (lower.includes('next week')) {
      dueDate.setDate(dueDate.getDate() + 7)
    } else {
      // Try direct parsing
      const parsed = new Date(dueDateStr)
      if (!isNaN(parsed.getTime())) dueDate = parsed
      else dueDate.setDate(dueDate.getDate() + 1)
    }
  }

  await supabase.from('reminders').insert({
    title,
    due_date: dueDate.toISOString(),
  })

  return ''
}

async function createLedgerEntry(type: string, description: string, metadata: Record<string, unknown>) {
  await supabase.from('ledger_entries').insert({
    type,
    description,
    metadata_json: metadata,
  })
}