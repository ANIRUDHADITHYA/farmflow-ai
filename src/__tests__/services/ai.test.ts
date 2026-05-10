import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockOpenAI, setAIResponse, setAIRawResponse } from '../mocks/openai'

// Mock modules before imports
vi.mock('@/lib/openai', () => ({ default: mockOpenAI }))

import { processMessage } from '@/services/ai'

describe('AI Service – processMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Intent detection ────────────────────────────────────────────
  describe('Intent detection', () => {
    it('should detect treatment intent', async () => {
      setAIResponse('treatment', { tag_number: '284', medicine: 'Noroclox' }, 'Treatment logged')
      const result = await processMessage('Treated cow 284 with Noroclox')
      expect(result.intent).toBe('treatment')
      expect(result.data.tag_number).toBe('284')
      expect(result.data.medicine).toBe('Noroclox')
    })

    it('should detect inventory intent', async () => {
      setAIResponse('inventory', { item_name: 'feed bags', quantity: 5 }, 'Stock updated')
      const result = await processMessage('Only 5 feed bags left')
      expect(result.intent).toBe('inventory')
      expect(result.data.item_name).toBe('feed bags')
      expect(result.data.quantity).toBe(5)
    })

    it('should detect invoice intent', async () => {
      setAIResponse('invoice', { supplier: 'ABC Feeds', amount: 450 }, 'Invoice recorded')
      const result = await processMessage('Invoice $450 from ABC Feeds')
      expect(result.intent).toBe('invoice')
      expect(result.data.supplier).toBe('ABC Feeds')
      expect(result.data.amount).toBe(450)
    })

    it('should detect reminder intent', async () => {
      setAIResponse('reminder', { title: 'Order feed', due_date: 'tomorrow' }, 'Reminder set')
      const result = await processMessage('Remind me to order feed tomorrow')
      expect(result.intent).toBe('reminder')
      expect(result.data.title).toBe('Order feed')
    })

    it('should detect general intent for greetings', async () => {
      setAIResponse('general', {}, 'Hello! How can I help?')
      const result = await processMessage('Hi')
      expect(result.intent).toBe('general')
    })
  })

  // ─── Conversation history ────────────────────────────────────────
  describe('Conversation history', () => {
    it('should pass conversation history to OpenAI', async () => {
      setAIResponse('treatment', { withdrawal_hours: 72, batch_number: 'B123' }, 'Updated')
      const history = [
        { role: 'user', content: 'Treated cow 284 with Noroclox' },
        { role: 'assistant', content: 'Got it! What is the withdrawal period?' },
      ]
      await processMessage('72 hours withdrawal, batch B123', undefined, history)

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      // system + 2 history + 1 current = 4 messages
      expect(callArgs.messages.length).toBe(4)
      expect(callArgs.messages[1].content).toBe('Treated cow 284 with Noroclox')
      expect(callArgs.messages[2].content).toBe('Got it! What is the withdrawal period?')
      expect(callArgs.messages[3].content).toBe('72 hours withdrawal, batch B123')
    })

    it('should limit history to last 20 messages', async () => {
      setAIResponse('general', {}, 'OK')
      const history = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }))
      await processMessage('test', undefined, history)

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      // system(1) + last 20 history + current(1) = 22
      expect(callArgs.messages.length).toBe(22)
    })

    it('should work with empty history', async () => {
      setAIResponse('general', {}, 'Hello')
      await processMessage('Hi', undefined, [])

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      // system + current message = 2
      expect(callArgs.messages.length).toBe(2)
    })

    it('should work with undefined history', async () => {
      setAIResponse('general', {}, 'Hello')
      await processMessage('Hi')

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      expect(callArgs.messages.length).toBe(2)
    })
  })

  // ─── Attachments ─────────────────────────────────────────────────
  describe('Attachments', () => {
    it('should send image attachments as multimodal content', async () => {
      setAIResponse('invoice', { supplier: 'Test' }, 'Invoice scanned')
      await processMessage('Analyze this invoice', ['https://example.com/img.png'])

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      const lastMsg = callArgs.messages[callArgs.messages.length - 1]
      expect(Array.isArray(lastMsg.content)).toBe(true)
      expect(lastMsg.content[0].type).toBe('text')
      expect(lastMsg.content[1].type).toBe('image_url')
      expect(lastMsg.content[1].image_url.url).toBe('https://example.com/img.png')
    })

    it('should handle multiple attachments', async () => {
      setAIResponse('invoice', {}, 'Processed')
      await processMessage('Check these', ['https://a.com/1.png', 'https://b.com/2.png'])

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      const lastMsg = callArgs.messages[callArgs.messages.length - 1]
      expect(lastMsg.content.length).toBe(3) // text + 2 images
    })

    it('should use default text for empty message with attachment', async () => {
      setAIResponse('invoice', {}, 'Analyzed')
      await processMessage('', ['https://example.com/receipt.png'])

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      const lastMsg = callArgs.messages[callArgs.messages.length - 1]
      expect(lastMsg.content[0].text).toContain('analyze this image')
    })
  })

  // ─── Error handling / edge cases ─────────────────────────────────
  describe('Error handling', () => {
    it('should handle null AI response content', async () => {
      setAIRawResponse(null)
      await expect(processMessage('test')).rejects.toThrow('No response from AI')
    })

    it('should handle invalid JSON response', async () => {
      setAIRawResponse('This is not JSON at all')
      const result = await processMessage('test')
      expect(result.intent).toBe('general')
      expect(result.message).toContain('trouble understanding')
    })

    it('should extract JSON from wrapped response', async () => {
      setAIRawResponse('Here is the result: {"intent":"treatment","data":{"tag_number":"10"},"message":"Logged"}')
      const result = await processMessage('test')
      expect(result.intent).toBe('treatment')
      expect(result.data.tag_number).toBe('10')
    })

    it('should set default intent when missing from response', async () => {
      setAIRawResponse('{"data":{},"message":"Hello"}')
      const result = await processMessage('test')
      expect(result.intent).toBe('general')
    })

    it('should generate fallback message for treatment', async () => {
      setAIRawResponse('{"intent":"treatment","data":{"tag_number":"1"}}')
      const result = await processMessage('test')
      expect(result.message).toBe('Treatment recorded successfully!')
    })

    it('should generate fallback message for inventory', async () => {
      setAIRawResponse('{"intent":"inventory","data":{}}')
      const result = await processMessage('test')
      expect(result.message).toBe('Inventory updated!')
    })

    it('should generate fallback message for invoice', async () => {
      setAIRawResponse('{"intent":"invoice","data":{}}')
      const result = await processMessage('test')
      expect(result.message).toBe('Invoice processed!')
    })

    it('should generate fallback message for reminder', async () => {
      setAIRawResponse('{"intent":"reminder","data":{}}')
      const result = await processMessage('test')
      expect(result.message).toBe('Reminder set!')
    })
  })

  // ─── Follow-up questions format ──────────────────────────────────
  describe('Follow-up questions', () => {
    it('should return follow-up questions from AI response', async () => {
      setAIResponse('treatment', { tag_number: '5' }, 'Noted', ['72 hours withdrawal', '48 hours withdrawal'])
      const result = await processMessage('Treated cow 5 with Pen')
      expect(result.follow_up_questions).toEqual(['72 hours withdrawal', '48 hours withdrawal'])
    })

    it('should handle empty follow-ups', async () => {
      setAIResponse('general', {}, 'Hello', [])
      const result = await processMessage('Hi')
      expect(result.follow_up_questions).toEqual([])
    })
  })
})
