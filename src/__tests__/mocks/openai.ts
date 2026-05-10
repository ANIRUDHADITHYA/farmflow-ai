/**
 * Mock for OpenAI client used across tests.
 */

interface MockChatResponse {
  choices: Array<{
    message: {
      content: string | null
    }
  }>
}

let nextResponse: MockChatResponse = {
  choices: [{ message: { content: '{"intent":"general","data":{},"message":"Hello!","follow_up_questions":[]}' } }],
}

const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(async () => nextResponse),
    },
  },
  audio: {
    transcriptions: {
      create: vi.fn(async () => ({ text: 'Treated cow 123 with Amoxicillin' })),
    },
  },
}

function setAIResponse(intent: string, data: Record<string, unknown> = {}, message = 'OK', followUps: string[] = []) {
  nextResponse = {
    choices: [{
      message: {
        content: JSON.stringify({ intent, data, message, follow_up_questions: followUps }),
      },
    }],
  }
}

function setAIRawResponse(content: string | null) {
  nextResponse = { choices: [{ message: { content } }] }
}

export { mockOpenAI, setAIResponse, setAIRawResponse }
