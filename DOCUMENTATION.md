# FarmFlow AI — Documentation

FarmFlow AI is a chat-driven farm management app. Instead of filling forms, you talk to an AI assistant in plain English (or voice) and it automatically logs treatments, updates stock, records invoices, sets reminders, and maintains a full activity ledger.

---

## Table of Contents

1. [App Overview](#app-overview)
2. [Navigation](#navigation)
3. [Chat Interface](#chat-interface)
4. [Workflow Map](#workflow-map)
5. [Chatbot Guide with Examples](#chatbot-guide-with-examples)
6. [Multi-Turn Conversations](#multi-turn-conversations)
7. [Quick Actions](#quick-actions)
8. [Voice & Image Input](#voice--image-input)
9. [Chat History & Sessions](#chat-history--sessions)
10. [Database Schema](#database-schema)
11. [API Reference](#api-reference)

---

## App Overview

| Feature | Description |
|---|---|
| **AI Chat** | Talk naturally to log farm operations |
| **Treatments** | Record medicine, dosage, withdrawal, batch for any animal |
| **Inventory** | Track stock levels — feed, medicine, supplies |
| **Invoices** | Log purchases, auto-update stock from line items |
| **Reminders** | Set time-based alerts (withdrawal periods, reorders, vet visits) |
| **Ledger** | Every action creates an audit trail entry automatically |
| **Voice** | Speak instead of type — transcribed via Whisper |
| **Image** | Upload invoice photos for automatic extraction |

---

## Navigation

The app has 5 tabs accessible from the bottom nav bar:

| Tab | Page | Purpose |
|---|---|---|
| **Home** | `/dashboard` | Overview stats — low stock, pending reminders, recent activity |
| **Animals** | `/animals` | Browse and manage animal records |
| **Chat** | `/` (center button) | Main AI chat interface |
| **Stock** | `/inventory` | View all inventory items and quantities |
| **Activity** | `/reports` | Full ledger of all recorded actions |

---

## Chat Interface

The chat screen is the primary way to interact with FarmFlow. It includes:

- **Message input** — Type or paste your message
- **Voice button** (mic icon) — Hold to record, auto-transcribes
- **Camera button** — Upload invoice/receipt photos
- **Quick action chips** — Pre-filled prompts for common tasks
- **Suggestion pills** — Tappable follow-up answers after each AI response
- **History drawer** — Access previous chat sessions (clock icon)
- **New chat button** (+) — Start a fresh conversation

---

## Workflow Map

This is the complete flow of what happens when you send a chat message:

```
┌─────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                    │
│           (text / voice / image + text)                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 CHAT SESSION CREATED                     │
│  • First message creates a new session in chat_sessions  │
│  • User message saved to chat_messages                   │
│  • Last 20 messages sent as history context              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  AI PROCESSES MESSAGE                     │
│  • GPT-4o analyzes text + history + attachments          │
│  • Returns: intent, data, message, follow_up_questions   │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┼───────────┬───────────┬───────────┐
          ▼           ▼           ▼           ▼           ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │TREATMENT│ │INVENTORY│ │ INVOICE │ │REMINDER │ │ GENERAL │
     └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
          │           │           │           │           │
          ▼           ▼           ▼           ▼           ▼
   ┌────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  (no DB
   │Look up or  │ │Upsert   │ │Insert   │ │Parse    │   writes)
   │create      │ │inventory│ │invoice  │ │due date │
   │animal      │ │row      │ │row      │ │& insert │
   │            │ │         │ │         │ │reminder │
   │Insert      │ │         │ │Upsert   │ │         │
   │treatment   │ │         │ │inventory│ │         │
   │            │ │         │ │per item │ │         │
   │Reduce      │ │         │ │         │ │         │
   │medicine    │ │         │ │         │ │         │
   │stock by 1  │ │         │ │         │ │         │
   │            │ │         │ │         │ │         │
   │Create      │ │         │ │         │ │         │
   │withdrawal  │ │         │ │         │ │         │
   │reminder    │ │         │ │         │ │         │
   └─────┬──────┘ └────┬────┘ └────┬────┘ └────┬────┘
         │             │           │           │
         └──────┬──────┴───────────┴───────┬───┘
                │                          │
                ▼                          ▼
        ┌──────────────┐          ┌──────────────┐
        │ LEDGER ENTRY │          │ AI RESPONSE  │
        │  (audit log) │          │ + suggestions│
        └──────────────┘          └──────┬───────┘
                                         │
                                         ▼
                                ┌──────────────────┐
                                │ SAVE AI MESSAGE   │
                                │ to chat_messages   │
                                └──────────────────┘
```

---

## Chatbot Guide with Examples

### 1. Log a Treatment

Record medicine given to an animal. The AI extracts tag number, medicine, dosage, condition, withdrawal period, and batch number.

**Single message (all data at once):**

```
You:  Treated cow 284 with Noroclox 10ml for mastitis, 72 hour withdrawal, batch B123

Bot:  Got it! I've logged the treatment of cow #284 with Noroclox (10ml) for
      mastitis. Withdrawal reminder set for 72 hours. Batch B123 recorded.

      Suggestions: [Log another treatment] [Check pending reminders]
```

**What happens behind the scenes:**
- ✅ Animal `#284` looked up (or created if new)
- ✅ Treatment row inserted: medicine=Noroclox, dosage=10ml, withdrawal=72h, batch=B123
- ✅ If "Noroclox" exists in inventory → stock reduced by 1
- ✅ Withdrawal reminder created: due in 72 hours
- ✅ Ledger entry: `"Treated animal #284 with Noroclox"`

---

**Multi-turn conversation (providing data step by step):**

```
You:  Treated cow 284 with Noroclox for mastitis

Bot:  Got it! Treatment of cow #284 with Noroclox for mastitis noted.
      What's the withdrawal period and batch number?

      Suggestions: [72 hours withdrawal] [48 hours withdrawal] [Batch B001]

You:  72 hours withdrawal    ← (tapped the suggestion)

Bot:  Updated! 72-hour withdrawal period recorded for cow #284.
      I'll remind you when it ends. What's the batch number?

      Suggestions: [Batch B001] [Batch B002] [No batch number]

You:  Batch B123

Bot:  Perfect — batch B123 recorded. Treatment fully logged!

      Suggestions: [Log another treatment] [Check stock levels]
```

---

**New animal (auto-created):**

```
You:  Vaccinated goat 999 with Ivermectin

Bot:  I don't have goat #999 on file — I've created a new record for it.
      Treatment with Ivermectin logged!

      Suggestions: [Set withdrawal reminder] [Add dosage info]
```

---

### 2. Update Inventory / Stock

Track quantities of feed, medicine, supplies, or any item.

**Set stock level:**

```
You:  I have 25 bags of cattle feed

Bot:  Noted — cattle feed stock updated to 25 bags.

      Suggestions: [Remind me to reorder tomorrow] [Check other stock]
```

```
You:  Only 3 bottles of Noroclox left

Bot:  Noroclox updated to 3 bottles. That's getting low!
      Want me to set a reorder reminder?

      Suggestions: [Remind me to reorder tomorrow] [Order 10 more bottles]
```

**What happens:**
- ✅ Inventory upserted: item_name="cattle feed", quantity=25, unit="bags"
- ✅ If item already exists → quantity is replaced (not added)
- ✅ Ledger entry: `"Inventory updated: cattle feed → 25"`

---

### 3. Record an Invoice

Log purchases from suppliers. If the invoice lists items, inventory is automatically updated.

**Invoice with line items:**

```
You:  Invoice $450 from ABC Feeds for 20 bags of cattle feed and 5 salt lick blocks

Bot:  Invoice recorded! $450 from ABC Feeds. Inventory has been updated with
      the new items.

      Suggestions: [Add another invoice] [Check total expenses]
```

**What happens:**
- ✅ Invoice row inserted: supplier="ABC Feeds", amount=450
- ✅ Inventory "cattle feed": existing qty + 20 (additive)
- ✅ Inventory "salt lick": existing qty + 5 (additive)
- ✅ Ledger entry: `"Invoice from ABC Feeds: $450"`

---

**Simple invoice (no items):**

```
You:  Paid $200 to vet for checkup

Bot:  Invoice recorded — $200 to vet.

      Suggestions: [Add another expense] [Set follow-up reminder]
```

---

**Invoice from photo:**

```
You:  [📷 uploads photo of receipt]
      Process this invoice

Bot:  I've scanned your receipt. $320 from FarmSupply Co for:
      • 10 bags feed ($200)
      • 4 bottles vaccine ($120)
      Inventory updated!

      Suggestions: [Correct the amounts] [Add another invoice]
```

---

### 4. Set a Reminder

Create time-based reminders with natural language dates.

**Tomorrow morning:**

```
You:  Remind me to reorder feed tomorrow morning

Bot:  Done! I'll remind you tomorrow morning (8:00 AM) to reorder feed.

      Suggestions: [Also remind me about vaccines] [Check pending reminders]
```

**Relative dates:**

```
You:  Remind me next week to schedule the vet visit

Bot:  Reminder set for next week — schedule vet visit.

      Suggestions: [Set another reminder] [Check this week's tasks]
```

**Specific date:**

```
You:  Remind me on June 15 to do the annual checkup

Bot:  Reminder set for June 15 — annual checkup.

      Suggestions: [Add more details] [View all reminders]
```

**Supported date formats:**
| Input | Parsed as |
|---|---|
| `tomorrow morning` | Next day, 8:00 AM |
| `tomorrow afternoon` | Next day, 2:00 PM |
| `tomorrow evening` | Next day, 6:00 PM |
| `tomorrow` (no time) | Next day, current time |
| `next week` | +7 days |
| `June 15` / `2026-06-15` | Exact date |
| _(no date given)_ | Defaults to tomorrow |

**What happens:**
- ✅ Reminder row inserted with parsed due_date
- ✅ Ledger entry: `"Reminder created: Reorder feed"`

---

### 5. General / Greetings

Any message that doesn't match a specific intent is handled as general chat.

```
You:  Hello!

Bot:  Hello! I'm your FarmFlow AI assistant. I can help you with animal
      treatments, inventory tracking, invoice processing, and setting
      reminders. What would you like to do?
```

```
You:  What can you do?

Bot:  I can help you with:
      • Log animal treatments (medicine, dosage, withdrawal)
      • Track feed & supply stock levels
      • Record invoices and expenses
      • Set reminders for tasks and follow-ups
      Just tell me what you need in plain English!
```

**No database writes happen for general messages.**

---

## Multi-Turn Conversations

The chatbot remembers the last 20 messages in the conversation. This means you can provide information across multiple messages and the AI will merge it together.

**Example: building up a treatment record:**

```
You:  I just treated cow 284

Bot:  What medicine did you use?
      Suggestions: [Noroclox] [Ivermectin] [Penicillin]

You:  Noroclox 10ml

Bot:  Got it — Noroclox 10ml for cow #284. What's the condition and withdrawal?
      Suggestions: [Mastitis, 72 hours] [Lameness, 48 hours]

You:  Mastitis, 72 hours, batch B456

Bot:  All set! Treatment fully logged:
      • Cow #284 — Noroclox 10ml
      • Condition: mastitis
      • Withdrawal: 72 hours (reminder set!)
      • Batch: B456
```

**Example: follow-up from inventory to reminder:**

```
You:  Only 2 bags of feed left

Bot:  Feed bags updated to 2. That's very low!
      Suggestions: [Remind me to reorder tomorrow] [Order 10 more bags]

You:  Remind me to reorder tomorrow morning    ← (tapped suggestion)

Bot:  Reminder set for tomorrow 8:00 AM — reorder feed bags.
```

---

## Quick Actions

The chat screen has 4 quick action chips at the top (visible when the conversation is empty):

| Chip | Pre-fills |
|---|---|
| 🩺 **Log Treatment** | `"I treated "` |
| 📦 **Update Stock** | `"I have "` |
| 📄 **Log Invoice** | `"Invoice $"` |
| 🔔 **Set Reminder** | `"Remind me to "` |

Tap one to start typing with a pre-filled prompt.

---

## Voice & Image Input

### Voice
1. Tap the **mic icon** 🎤
2. Speak your message naturally
3. Tap again to stop — audio is sent to OpenAI Whisper for transcription
4. The transcribed text is auto-sent as a chat message

### Image
1. Tap the **camera icon** 📷
2. Select a photo (invoice, receipt, etc.)
3. The image is uploaded to Supabase storage
4. Add an optional text message and send
5. GPT-4o Vision analyzes the image and extracts data

---

## Chat History & Sessions

Every conversation is saved as a **session**:

- **New chat** (+) — Start a fresh session
- **History drawer** (clock icon) — Browse and resume previous sessions
- **Delete** — Remove a session and all its messages
- **Session title** — Auto-set from your first message

Messages persist across page reloads. Reopening a session restores the full conversation.

---

## Database Schema

| Table | Purpose | Key columns |
|---|---|---|
| `animals` | Animal registry | tag_number (unique), type, status |
| `treatments` | Treatment records | animal_id (FK), medicine, dosage, withdrawal_hours, batch_number |
| `inventory` | Stock levels | item_name (unique), quantity, unit |
| `invoices` | Purchase records | supplier, amount, extracted_json |
| `reminders` | Scheduled alerts | title, due_date, status |
| `ledger_entries` | Audit trail | type, description, metadata_json |
| `chat_sessions` | Conversation threads | title, updated_at |
| `chat_messages` | Individual messages | session_id (FK), role, content, intent |

**Key behaviors:**
- `inventory.item_name` has a UNIQUE constraint — upserts merge by name
- `treatments.animal_id` cascades on delete — removing an animal removes its treatments
- `chat_messages.session_id` cascades on delete — removing a session removes its messages
- Every intent (except `general`) creates a `ledger_entries` row automatically

---

## API Reference

### `POST /api/chat`

Main chat endpoint. Accepts a message, processes it through AI, performs DB operations, and returns the result.

**Request:**
```json
{
  "message": "Treated cow 284 with Noroclox 10ml",
  "attachments": ["https://storage.example/receipt.jpg"],
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ]
}
```

**Response:**
```json
{
  "intent": "treatment",
  "data": {
    "tag_number": "284",
    "medicine": "Noroclox",
    "dosage": "10ml"
  },
  "message": "Treatment logged for cow #284 with Noroclox (10ml)!",
  "follow_up_questions": ["72 hours withdrawal", "48 hours withdrawal", "Batch B001"]
}
```

### Other endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/animals` | GET | List all animals |
| `/api/inventory` | GET | List all inventory items |
| `/api/reminders` | GET | List all reminders |
| `/api/ledger` | GET | List all ledger entries |
| `/api/dashboard` | GET | Get dashboard statistics |
| `/api/transcribe` | POST | Transcribe audio via Whisper |

---

## Ledger Entry Formats

Every action creates a ledger entry with a consistent description format:

| Intent | Ledger description |
|---|---|
| Treatment | `Treated animal #284 with Noroclox` |
| Inventory | `Inventory updated: cattle feed → 25` |
| Invoice | `Invoice from ABC Feeds: $450` |
| Reminder | `Reminder created: Reorder feed` |

The `metadata_json` column stores the full extracted data for each entry, enabling detailed reporting on the Activity page.
