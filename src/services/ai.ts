import openai from '@/lib/openai'
import { AIResponse } from '@/types'

const SYSTEM_PROMPT = `You MUST respond with ONLY valid JSON. Nothing else.

You are a friendly farm operations AI assistant called FarmFlow AI. Your job is to understand what the farmer says and extract structured data.

ALWAYS respond in this exact JSON format:
{"intent":"treatment|inventory|invoice|reminder|general","data":{},"follow_up_questions":[],"message":""}

The "message" field should contain a SHORT, friendly, human-readable response to the farmer.

RECOGNIZE THESE INTENTS:

TREATMENT: treated, vaccine, vaccinated, dewormer, injection, medicine, medication, sick, illness, disease, mastitis, antibiotic, dosage, withdrawal
INVENTORY: feed, stock, bags, supply, supplies, low, running low, left, remaining, received, shipment, restock, reorder
INVOICE: invoice, bill, receipt, payment, purchase, paid, cost, price, supplier, $, amount, expense
REMINDER: remind, reminder, schedule, tomorrow, next week, alert, appointment, check, follow up
GENERAL: greetings, questions about the system, help requests, status checks

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
Output: {"intent":"treatment","data":{"tag_number":"284","animal_type":"cow","medicine":"Noroclox","condition":"mastitis"},"follow_up_questions":["72 hours withdrawal","48 hours withdrawal","Batch B001"],"message":"Got it! I've noted the treatment of cow #284 with Noroclox for mastitis. What's the withdrawal period and batch number?"}

Input: "72 hours withdrawal, batch B123"
Output: {"intent":"treatment","data":{"withdrawal_hours":72,"batch_number":"B123"},"follow_up_questions":["Log another treatment","Check pending reminders"],"message":"Perfect! Treatment record updated with 72-hour withdrawal period and batch B123. I'll set a withdrawal reminder for you."}

Input: "Only 5 feed bags left"
Output: {"intent":"inventory","data":{"item_name":"feed bags","quantity":5},"follow_up_questions":["Remind me to reorder tomorrow","Order 10 more bags","Check other stock"],"message":"Noted — feed bags stock updated to 5. That's getting low! Want me to set a reorder reminder?"}

Input: "Yes, remind me tomorrow morning"
Output: {"intent":"reminder","data":{"title":"Reorder feed bags","due_date":"tomorrow morning"},"follow_up_questions":[],"message":"Done! I'll remind you tomorrow morning to reorder feed bags."}

Input: "Invoice $450 from ABC Feeds for 20 bags of cattle feed"
Output: {"intent":"invoice","data":{"supplier":"ABC Feeds","amount":450,"items":[{"name":"cattle feed","quantity":20,"unit":"bags"}]},"follow_up_questions":[],"message":"Invoice recorded! $450 from ABC Feeds for 20 bags of cattle feed. Inventory will be updated."}

Input: "Hello" or "Hi"
Output: {"intent":"general","data":{},"follow_up_questions":[],"message":"Hello! I'm your FarmFlow AI assistant. I can help you with animal treatments, inventory tracking, invoice processing, and setting reminders. What would you like to do?"}

FOLLOW-UP SUGGESTIONS RULES:
- follow_up_questions should be EXAMPLE ANSWERS the farmer can tap to reply, NOT questions
- They should be short, tappable example responses that fill in missing data
- Format them as what the farmer would SAY, not what you want to ASK

Examples of GOOD follow_up_questions:
  After treatment missing withdrawal: ["72 hours withdrawal", "48 hours withdrawal", "24 hours withdrawal"]
  After treatment missing batch: ["Batch B001", "No batch number"]
  After inventory update: ["Set reorder reminder", "Check other stock levels"]
  After low stock alert: ["Order 10 more bags", "Remind me tomorrow to reorder"]
  After invoice: ["Add another invoice", "Check total expenses"]

Examples of BAD follow_up_questions (NEVER do this):
  ["What's the withdrawal period?", "What's the batch number?"] ← these are questions, not answers

CRITICAL RULES:
- Return ONLY valid JSON
- Always include the "message" field with a friendly response
- Never hallucinate data — only extract what the farmer actually said
- If message matches ANY keyword, set the appropriate intent
- Use "general" (not "unknown") for greetings and general questions
- Extract partial data — partial is better than nothing
- Use conversation history to understand context from previous messages
- When a follow-up reply references earlier context, MERGE the data (e.g. if previous message was about cow 284 and current says "72 hours", combine them)
- follow_up_questions must be example ANSWERS the user can tap, not questions`

export async function processMessage(
  message: string,
  attachments?: string[],
  history?: Array<{ role: string; content: string }>
): Promise<AIResponse> {
  const messages: Array<{role: string; content: string | Array<{type: string; text?: string; image_url?: {url: string}}>}> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

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
    return parsed
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (!parsed.intent) parsed.intent = 'general'
        if (!parsed.message) parsed.message = generateFallbackMessage(parsed)
        return parsed
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