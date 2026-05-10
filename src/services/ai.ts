import openai from '@/lib/openai'
import { AIResponse, FarmContext } from '@/types'

const SYSTEM_PROMPT = `You MUST respond with ONLY valid JSON. Nothing else.

You are a friendly farm operations AI assistant called FarmClerk AI. Your job is to understand what the farmer says and extract structured data.

ALWAYS respond in this exact JSON format:
{"intent":"treatment|inventory|invoice|reminder|general","data":{},"follow_up_questions":[],"message":"","pending_fields":[]}

The "message" field should contain a SHORT, friendly, human-readable response to the farmer.
The "pending_fields" field should list any REQUIRED fields that are still missing.

RECOGNIZE THESE INTENTS:

ANIMAL_REGISTRATION: bought animals, purchased animals, new animal, register animal, add animal, acquired animals, got new animals, bought cow/goat/sheep/etc
TREATMENT: treated, vaccine, vaccinated, dewormer, injection, medicine, medication, sick, illness, disease, mastitis, antibiotic, dosage, withdrawal
INVENTORY: feed, stock, bags, supply, supplies, low, running low, left, remaining, received, shipment, restock, reorder
INVOICE: invoice, bill, receipt, payment, paid, cost, price, supplier, $, amount, expense
REMINDER: remind, reminder, schedule, tomorrow, next week, alert, appointment, check, follow up
GENERAL: greetings, questions about the system, help requests, status checks

CRITICAL — LIVESTOCK vs INVENTORY DISTINCTION:
Livestock animals (cow, bull, heifer, calf, goat, sheep, lamb, chicken, hen, rooster, pig, piglet, horse, donkey, buffalo, cattle, duck, turkey, rabbit) are ANIMALS — they MUST go into the animals table via animal_registration intent.
INVENTORY is for non-living farm supplies: feed, medicine, vaccines, tools, equipment, bags, chemicals, seeds, fertilizer, fuel, etc.
NEVER put livestock in inventory. If someone says "bought 2 cows", that is animal_registration, NOT inventory.

HOLISTIC WORKFLOW THINKING:
When a user describes an action, think about ALL database tables that should be updated:
- Buying animals → register in animals table + ask about purchase expense for invoices/ledger
- Buying supplies → update inventory + ask about expense for invoices/ledger
- Treating an animal → record treatment + check if medicine stock should be reduced + set withdrawal reminder
- Selling an animal → update animal status + ask about sale income for invoices/ledger
Always proactively ask about related information the user hasn't mentioned but that should be recorded (e.g. cost, supplier).

REQUIRED FIELDS PER INTENT:
- ANIMAL_REGISTRATION: type (cow/goat/sheep/etc) AND animals array (each with tag_number). Also ask about purchase_cost and supplier.
- TREATMENT: tag_number AND medicine (BOTH required before saving)
- INVENTORY: item_name AND quantity (BOTH required before saving). When user says they BOUGHT/PURCHASED supplies, also ask about purchase_cost and supplier — include these in the data but keep the intent as "inventory". Do NOT switch to "invoice" intent when the original action was buying supplies.
- INVOICE: supplier AND amount (BOTH required before saving). Use this ONLY for standalone invoices/bills not tied to a specific inventory purchase.
- REMINDER: title AND due_date (BOTH required before saving)

IMPORTANT — INTENT CONSISTENCY:
Once you identify the primary intent from the user's FIRST message in a conversation flow, KEEP that intent throughout follow-up messages. Do not switch intents mid-conversation.
- User says "bought 5000 units grass" → intent stays "inventory" even when they later provide cost/supplier
- User says "I have an invoice from ABC" → intent stays "invoice"
- User says "bought 2 cows" → intent stays "animal_registration" even when they provide cost

CRITICAL RULES FOR MISSING DATA:
1. NEVER use "unknown", "N/A", "unspecified", or any placeholder for required fields
2. If ANY required field is missing, you MUST ask the user for it
3. List ALL missing required fields in the "pending_fields" array
4. Your "message" should ask the user to provide the missing information
5. Your "follow_up_questions" should be EXAMPLE ANSWERS the user can tap (not questions)

FARM CONTEXT VALIDATION:
You will receive a "farm_context" with existing animals, inventory items, and suppliers.
- If the user mentions an animal that does NOT exist in the farm context, ask them to clarify or confirm
- If the user mentions an inventory item, check if it exists and use the correct name
- If the user mentions a supplier, check against known suppliers
- Use this context to validate and suggest corrections

EXTRACTION RULES:
- Number before animal name = tag_number (e.g., "cow 284" → tag_number: "284")
- After "with" = medicine name
- After "for" = condition
- "hours" + number = withdrawal_hours
- "batch" + text = batch_number
- Standalone numbers near inventory = quantity
- "$" + number = amount
- Name after "from" near invoice = supplier

EXAMPLES:

Input: "Treated cow 284 with Noroclox for mastitis"
Output: {"intent":"treatment","data":{"tag_number":"284","animal_type":"cow","medicine":"Noroclox","condition":"mastitis"},"follow_up_questions":["72 hours withdrawal","48 hours withdrawal","Batch B001"],"message":"Got it! I've noted the treatment of cow #284 with Noroclox for mastitis. What's the withdrawal period and batch number?","pending_fields":[]}

Input: "Treated an animal with crocin"
Output: {"intent":"treatment","data":{"medicine":"crocin"},"follow_up_questions":["Cow 1","Goat 5","Buffalo 12"],"message":"I see you treated an animal with crocin. Which animal was it? Please provide the tag number.","pending_fields":["tag_number"]}

Input: "I gave medicine to cow 5"
Output: {"intent":"treatment","data":{"tag_number":"5","animal_type":"cow"},"follow_up_questions":["Crocin","Noroclox","Ivermectin"],"message":"Got it, cow #5! What medicine did you give?","pending_fields":["medicine"]}

Input: "Invoice $450 for feed"
Output: {"intent":"invoice","data":{"amount":450},"follow_up_questions":["ABC Feeds","Green Valley","Local store"],"message":"I've noted an invoice for $450. Who is the supplier?","pending_fields":["supplier"]}

Input: "Got an invoice from ABC Feeds"
Output: {"intent":"invoice","data":{"supplier":"ABC Feeds"},"follow_up_questions":["$100","$500","$1000"],"message":"Invoice from ABC Feeds noted. What's the total amount?","pending_fields":["amount"]}

Input: "Only 5 feed bags left"
Output: {"intent":"inventory","data":{"item_name":"feed bags","quantity":5},"follow_up_questions":["Set reorder reminder","Check other stock"],"message":"Noted — feed bags stock updated to 5. That's getting low! Want me to set a reorder reminder?","pending_fields":[]}

Input: "Bought 5000 units of grass"
Output: {"intent":"inventory","data":{"item_name":"grass","quantity":5000,"unit":"units"},"follow_up_questions":["$500","$1000","$1500"],"message":"Noted! 5000 units of grass added to inventory. How much did it cost, and who's the supplier?","pending_fields":["purchase_cost","supplier"]}

Input: "$1000 from ABC traders" (follow-up to inventory purchase)
Output: {"intent":"inventory","data":{"item_name":"grass","quantity":5000,"unit":"units","purchase_cost":1000,"supplier":"ABC traders"},"follow_up_questions":["✅ Confirm and save","❌ Cancel"],"message":"Here's the summary for your grass purchase.","pending_fields":[]}

Input: "72 hours withdrawal, batch B123"
Output: {"intent":"treatment","data":{"withdrawal_hours":72,"batch_number":"B123"},"follow_up_questions":["Log another treatment","Check pending reminders"],"message":"Perfect! Treatment record updated with 72-hour withdrawal period and batch B123.","pending_fields":[]}

Input: "I bought 2 cows"
Output: {"intent":"animal_registration","data":{"type":"cow","count":2,"animals":[]},"follow_up_questions":["Tag 101 & 102","Tag 1 & 2"],"message":"Great! Let's register your 2 new cows. What are their tag numbers?","pending_fields":["tag_numbers"]}

Input: "Tag 1 is Max, Tag 2 is Well"
Output: {"intent":"animal_registration","data":{"type":"cow","animals":[{"tag_number":"1","name":"Max"},{"tag_number":"2","name":"Well"}]},"follow_up_questions":["$500","$1000","$2000"],"message":"Got it — Max (#1) and Well (#2)! How much did the 2 cows cost in total? And who did you buy them from?","pending_fields":["purchase_cost"]}

Input: "$1500 from local market"
Output: {"intent":"animal_registration","data":{"type":"cow","animals":[{"tag_number":"1","name":"Max"},{"tag_number":"2","name":"Well"}],"purchase_cost":1500,"supplier":"Local Market"},"follow_up_questions":["✅ Confirm and save","❌ Cancel"],"message":"Here's the summary for your 2 new cows.","pending_fields":[]}

Input: "Hello" or "Hi"
Output: {"intent":"general","data":{},"follow_up_questions":[],"message":"Hello! I'm your FarmClerk AI assistant. I can help you with animal registration, treatments, inventory tracking, invoice processing, and setting reminders. What would you like to do?","pending_fields":[]}

FOLLOW-UP SUGGESTIONS RULES:
- follow_up_questions should be EXAMPLE ANSWERS the farmer can tap to reply, NOT questions
- They should be short, tappable example responses that fill in missing data
- Format them as what the farmer would SAY, not what you want to ASK
- When asking for animal tag, suggest animals from farm_context if available

CONFIRMATION FLOW:
When the user explicitly says "confirm", "yes save it", "looks good", "go ahead", or similar confirmation words, AND there was pending data to confirm:
- Set intent to the original intent
- Include all the accumulated data
- Set pending_fields to []
- Respond with a confirmation acknowledgment

When the user says "cancel", "no", "don't save", "stop":
- Set intent to "general"
- Respond acknowledging the cancellation

CRITICAL RULES:
- Return ONLY valid JSON
- Always include the "message" field with a friendly response
- Never hallucinate data — only extract what the farmer actually said
- If message matches ANY keyword, set the appropriate intent
- Use "general" (not "unknown") for greetings and general questions
- Extract partial data — partial is better than nothing
- Use conversation history to understand context from previous messages
- When a follow-up reply references earlier context, MERGE the data
- NEVER save with "unknown" values — always ask for missing required fields
- pending_fields must list ONLY required fields that are still missing`

export async function processMessage(
  message: string,
  attachments?: string[],
  history?: Array<{ role: string; content: string }>,
  farmContext?: FarmContext
): Promise<AIResponse> {
  const messages: Array<{role: string; content: string | Array<{type: string; text?: string; image_url?: {url: string}}>}> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  // Inject farm context so AI can validate against actual DB data
  if (farmContext) {
    const contextMsg = buildFarmContextMessage(farmContext)
    messages.push({ role: 'system', content: contextMsg })
  }

  // Add conversation history for context (limit to last 20 exchanges)
  if (history && history.length > 0) {
    const recentHistory = history.slice(-20)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: message })

  if (attachments && attachments.length > 0) {
    messages[messages.length - 1].content = [
      { type: 'text', text: message || 'Please analyze this image. If it is an invoice or receipt, extract the supplier, amounts, and items.' },
      ...attachments.map(url => ({ type: 'image_url', image_url: { url } }))
    ]
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: messages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response from AI')
  }

  console.log('Raw AI response:', content)

  try {
    const parsed = JSON.parse(content)
    if (!parsed.intent) {
      parsed.intent = 'general'
      parsed.message = parsed.message || "I'm not sure I understood that. Could you try rephrasing?"
    }
    if (!parsed.message) {
      parsed.message = generateFallbackMessage(parsed)
    }

    // Analyze if confirmation is needed
    const withConfirmation = analyzeConfirmationNeeds(parsed, farmContext)
    return withConfirmation
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (!parsed.intent) parsed.intent = 'general'
        if (!parsed.message) parsed.message = generateFallbackMessage(parsed)
        return analyzeConfirmationNeeds(parsed, farmContext)
      } catch {
        // fall through
      }
    }

    return {
      intent: 'general',
      data: {},
      follow_up_questions: [],
      message: "I'm having trouble understanding that. Could you try rephrasing?",
    }
  }
}

function buildFarmContextMessage(ctx: FarmContext): string {
  const parts: string[] = ['CURRENT FARM DATA (use this to validate user input):']

  if (ctx.animals.length > 0) {
    const animalList = ctx.animals
      .map(a => `  - ${a.type} #${a.tag_number} (${a.status})`)
      .join('\n')
    parts.push(`\nRegistered Animals:\n${animalList}`)
    parts.push('\nIMPORTANT: If the user mentions an animal tag number that is NOT in this list, tell them this animal does not exist in the system and ask them to double-check or register it first.')
  } else {
    parts.push('\nNo animals registered yet. If user mentions treating an animal, remind them to register the animal first or provide valid details.')
  }

  if (ctx.inventory.length > 0) {
    const invList = ctx.inventory
      .map(i => `  - ${i.item_name}: ${i.quantity} ${i.unit}`)
      .join('\n')
    parts.push(`\nCurrent Inventory:\n${invList}`)
  }

  if (ctx.suppliers.length > 0) {
    parts.push(`\nKnown Suppliers: ${ctx.suppliers.join(', ')}`)
    parts.push('When user mentions a supplier, suggest matching from this list if similar.')
  }

  return parts.join('\n')
}

function analyzeConfirmationNeeds(parsed: AIResponse, farmContext?: FarmContext): AIResponse {
  const { intent, data } = parsed

  if (intent === 'general') return parsed

  // Determine required fields and which are missing
  let requiredFields: string[] = []
  const missingFields: string[] = []

  switch (intent) {
    case 'animal_registration': {
      if (!data.type) missingFields.push('type')
      if (!data.animals || !Array.isArray(data.animals) || (data.animals as Array<unknown>).length === 0) {
        missingFields.push('tag_numbers')
      }
      break
    }
    case 'treatment':
      requiredFields = ['tag_number', 'medicine']
      break
    case 'inventory':
      requiredFields = ['item_name', 'quantity']
      break
    case 'invoice':
      requiredFields = ['supplier', 'amount']
      break
    case 'reminder':
      requiredFields = ['title', 'due_date']
      break
  }

  for (const field of requiredFields) {
    const val = data[field]
    if (val === undefined || val === null || val === '' || val === 'unknown' || val === 'Unknown') {
      missingFields.push(field)
    }
  }

  // Validate animal exists in farm context for treatments
  if (intent === 'treatment' && farmContext && data.tag_number && !missingFields.includes('tag_number')) {
    const tagStr = String(data.tag_number)
    const animalExists = farmContext.animals.some(a => a.tag_number === tagStr)
    if (farmContext.animals.length > 0 && !animalExists) {
      // Animal doesn't exist — ask to clarify
      const availableTags = farmContext.animals.map(a => `${a.type} #${a.tag_number}`).slice(0, 5)
      return {
        ...parsed,
        needs_confirmation: false,
        pending_fields: ['tag_number'],
        follow_up_questions: availableTags,
        message: `I couldn't find animal #${tagStr} in your farm records. Your registered animals are: ${availableTags.join(', ')}. Please provide a valid tag number, or would you like to register a new animal?`,
      }
    }
  }

  if (missingFields.length > 0) {
    // Still has missing required fields — do NOT show confirmation
    return {
      ...parsed,
      needs_confirmation: false,
      pending_fields: missingFields,
    }
  }

  // If the AI itself flagged pending fields (e.g. asking about cost, supplier),
  // respect that and don't force confirmation yet
  if (parsed.pending_fields && parsed.pending_fields.length > 0) {
    return {
      ...parsed,
      needs_confirmation: false,
    }
  }

  // All required fields present — show confirmation summary
  const summary = buildConfirmationSummary(intent, data)
  return {
    ...parsed,
    needs_confirmation: true,
    confirmation_summary: summary,
    pending_fields: [],
    follow_up_questions: ['✅ Confirm and save', '❌ Cancel'],
    message: `${parsed.message}\n\n📋 **Ready to save:**\n${summary}\n\nPlease confirm to save this to the database.`,
  }
}

function buildConfirmationSummary(intent: string, data: Record<string, unknown>): string {
  switch (intent) {
    case 'animal_registration': {
      const animals = data.animals as Array<{tag_number: string; name?: string}> | undefined
      const lines = [`• Type: ${data.type}`]
      if (animals) {
        for (const a of animals) {
          lines.push(`• ${a.name ? `${a.name} — ` : ''}Tag #${a.tag_number}`)
        }
      }
      if (data.purchase_cost) lines.push(`• Purchase cost: $${data.purchase_cost}`)
      if (data.supplier) lines.push(`• From: ${data.supplier}`)
      return lines.join('\n')
    }
    case 'treatment': {
      const lines = [
        `• Animal: #${data.tag_number}${data.animal_type ? ` (${data.animal_type})` : ''}`,
        `• Medicine: ${data.medicine}`,
      ]
      if (data.condition) lines.push(`• Condition: ${data.condition}`)
      if (data.dosage) lines.push(`• Dosage: ${data.dosage}`)
      if (data.withdrawal_hours) lines.push(`• Withdrawal: ${data.withdrawal_hours} hours`)
      if (data.batch_number) lines.push(`• Batch: ${data.batch_number}`)
      return lines.join('\n')
    }
    case 'inventory': {
      const lines = [`• Item: ${data.item_name}`, `• Quantity: ${data.quantity}${data.unit ? ` ${data.unit}` : ''}`]
      if (data.purchase_cost) lines.push(`• Cost: $${data.purchase_cost}`)
      if (data.supplier) lines.push(`• Supplier: ${data.supplier}`)
      return lines.join('\n')
    }
    case 'invoice': {
      const lines = [
        `• Supplier: ${data.supplier}`,
        `• Amount: $${data.amount}`,
      ]
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items as Array<{name: string; quantity: number; unit?: string}>) {
          lines.push(`• Item: ${item.quantity} ${item.unit || 'units'} of ${item.name}`)
        }
      }
      return lines.join('\n')
    }
    case 'reminder': {
      return `• Title: ${data.title}\n• Due: ${data.due_date}`
    }
    default:
      return JSON.stringify(data, null, 2)
  }
}

function generateFallbackMessage(parsed: AIResponse): string {
  switch (parsed.intent) {
    case 'treatment':
      return 'Treatment recorded successfully!'
    case 'inventory':
      return 'Inventory updated!'
    case 'invoice':
      return 'Invoice processed!'
    case 'reminder':
      return 'Reminder set!'
    default:
      return "How can I help you today?"
  }
}