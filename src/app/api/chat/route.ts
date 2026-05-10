import { NextRequest, NextResponse } from 'next/server'
import { processMessage } from '@/services/ai'
import { supabase } from '@/lib/supabase'
import { AIResponse } from '@/types'
import { getFarmContext } from '@/services/database'

export async function POST(request: NextRequest) {
  try {
    const { message, attachments, history, confirmed, confirmedData } = await request.json()

    if (!message && (!attachments || attachments.length === 0)) {
      return NextResponse.json({
        intent: 'general',
        data: {},
        message: 'Please send a message or upload an image.',
      })
    }

    // Load farm context for validation
    const farmContext = await getFarmContext()

    // If user is confirming a pending action, execute the DB write
    if (confirmed && confirmedData) {
      const result = await handleConfirmedAction(confirmedData)
      return NextResponse.json(result)
    }

    // Process with AI (pass conversation history + farm context)
    const aiResponse: AIResponse = await processMessage(message, attachments, history, farmContext)

    // Handle general/greeting intent — no DB ops needed
    if (aiResponse.intent === 'general') {
      return NextResponse.json(aiResponse)
    }

    // If there are pending (missing) fields, do NOT save — ask user for more info
    if (aiResponse.pending_fields && aiResponse.pending_fields.length > 0) {
      return NextResponse.json({
        ...aiResponse,
        needs_confirmation: false,
      })
    }

    // If confirmation is needed, return the data WITHOUT saving
    if (aiResponse.needs_confirmation) {
      return NextResponse.json(aiResponse)
    }

    // Should not reach here for actionable intents — but just in case, return without saving
    return NextResponse.json(aiResponse)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({
      intent: 'error',
      data: {},
      message: "I'm having trouble processing that. Could you try rephrasing?",
    }, { status: 500 })
  }
}

async function handleConfirmedAction(confirmedData: { intent: string; data: Record<string, unknown> }): Promise<AIResponse> {
  const { intent, data } = confirmedData
  let successMessage = ''

  try {
    switch (intent) {
      case 'treatment':
        successMessage = await handleTreatment(data)
        break
      case 'animal_registration':
        successMessage = await handleAnimalRegistration(data)
        break
      case 'inventory':
        successMessage = await handleInventory(data)
        break
      case 'invoice':
        successMessage = await handleInvoice(data)
        break
      case 'reminder':
        successMessage = await handleReminder(data)
        break
    }

    // Create ledger entry only after confirmed save
    await createLedgerEntry(intent, buildLedgerDescription(intent, data), data)

    return {
      intent,
      data,
      confirmed: true,
      message: successMessage || `✅ ${intent.charAt(0).toUpperCase() + intent.slice(1)} saved successfully!`,
      follow_up_questions: ['Log another', 'Check records'],
    }
  } catch (error) {
    console.error(`Error handling confirmed ${intent}:`, error)
    return {
      intent: 'error',
      data,
      message: `Failed to save ${intent}. Please try again.`,
    }
  }
}

function buildLedgerDescription(intent: string, data: Record<string, unknown>): string {
  switch (intent) {
    case 'animal_registration': {
      const animals = data.animals as Array<{tag_number: string; name?: string}> | undefined
      const count = animals?.length || data.count || 1
      const type = data.type || 'animal'
      const cost = data.purchase_cost ? ` for $${data.purchase_cost}` : ''
      return `Registered ${count} ${type}(s)${cost}`
    }
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

  // Strict validation — both required fields must be present
  if (!tagNumber || !medicine || medicine === 'unknown') {
    return 'Missing required treatment data.'
  }

  let animalUuid: string | undefined

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

  return `✅ Treatment recorded: ${medicine} for animal #${tagNumber}`
}

async function handleAnimalRegistration(data: Record<string, unknown>): Promise<string> {
  const type = data.type as string
  const animals = data.animals as Array<{tag_number: string; name?: string}>
  const purchaseCost = data.purchase_cost as number | undefined
  const supplier = data.supplier as string | undefined

  if (!type || !animals || animals.length === 0) {
    return 'Missing required animal registration data.'
  }

  const registered: string[] = []
  for (const animal of animals) {
    const insertData: Record<string, unknown> = {
      tag_number: animal.tag_number,
      type,
      status: 'active',
    }
    if (animal.name) insertData.name = animal.name

    const { error } = await supabase.from('animals').insert(insertData)
    if (error) {
      if (error.code === '23505') {
        registered.push(`#${animal.tag_number} (already exists)`)
      } else {
        throw error
      }
    } else {
      registered.push(animal.name ? `${animal.name} (#${animal.tag_number})` : `#${animal.tag_number}`)
    }
  }

  // Record purchase expense if provided
  if (purchaseCost && purchaseCost > 0) {
    await supabase.from('invoices').insert({
      supplier: supplier || 'Not specified',
      amount: Number(purchaseCost),
      extracted_json: { type: 'animal_purchase', animal_type: type, animals, count: animals.length },
    })

    // Ledger entry for the expense
    await supabase.from('ledger_entries').insert({
      type: 'invoice',
      description: `Purchased ${animals.length} ${type}(s) from ${supplier || 'unknown'}: $${purchaseCost}`,
      metadata_json: { animal_type: type, purchase_cost: purchaseCost, supplier },
    })
  }

  const summary = registered.join(', ')
  const costNote = purchaseCost ? ` | Expense: $${purchaseCost}${supplier ? ` from ${supplier}` : ''}` : ''
  return `✅ Registered ${animals.length} ${type}(s): ${summary}${costNote}`
}

async function handleInventory(data: Record<string, unknown>): Promise<string> {
  const itemName = data.item_name as string | undefined
  const quantity = data.quantity as number | undefined
  const purchaseCost = data.purchase_cost as number | undefined
  const supplier = data.supplier as string | undefined

  if (!itemName || quantity === undefined || quantity === null) {
    return 'Missing required inventory data.'
  }

  const { error } = await supabase.from('inventory').upsert(
    {
      item_name: itemName,
      quantity,
      unit: (data.unit as string) || 'units',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'item_name' }
  )

  if (error) throw error

  // Record purchase expense if cost was provided
  if (purchaseCost && purchaseCost > 0) {
    await supabase.from('invoices').insert({
      supplier: supplier || 'Not specified',
      amount: Number(purchaseCost),
      extracted_json: { type: 'inventory_purchase', item_name: itemName, quantity },
    })

    await supabase.from('ledger_entries').insert({
      type: 'invoice',
      description: `Purchased ${quantity} ${(data.unit as string) || 'units'} of ${itemName} from ${supplier || 'unknown'}: $${purchaseCost}`,
      metadata_json: { item_name: itemName, quantity, purchase_cost: purchaseCost, supplier },
    })

    const costNote = supplier ? ` | $${purchaseCost} from ${supplier}` : ` | $${purchaseCost}`
    return `✅ Inventory updated: ${itemName} → ${quantity}${costNote}`
  }

  return `✅ Inventory updated: ${itemName} → ${quantity}`
}

async function handleInvoice(data: Record<string, unknown>): Promise<string> {
  const supplier = data.supplier as string | undefined
  const amount = data.amount as number | undefined

  if (!supplier || supplier === 'Unknown' || supplier === 'unknown' || !amount) {
    return 'Missing required invoice data.'
  }

  await supabase.from('invoices').insert({
    supplier,
    amount: Number(amount),
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
    return `✅ Invoice recorded: $${amount} from ${supplier}. Inventory updated with new items.`
  }

  return `✅ Invoice recorded: $${amount} from ${supplier}`
}

async function handleReminder(data: Record<string, unknown>): Promise<string> {
  const title = data.title as string | undefined
  let dueDateStr = data.due_date as string | undefined

  if (!title || !dueDateStr) return 'Missing required reminder data.'

  // Parse relative dates
  let dueDate: Date
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

  await supabase.from('reminders').insert({
    title,
    due_date: dueDate.toISOString(),
  })

  return `✅ Reminder set: "${title}"`
}

async function createLedgerEntry(type: string, description: string, metadata: Record<string, unknown>) {
  await supabase.from('ledger_entries').insert({
    type,
    description,
    metadata_json: metadata,
  })
}