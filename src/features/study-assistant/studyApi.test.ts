import { describe, expect, it, vi } from 'vitest'
import { requestStudySuggestion } from './studyApi'

const input = {
  source: { canonicalUrl: 'https://www.jw.org/en/bible-teachings/' },
  questionId: 'theme',
  questionText: 'What can our family apply?',
  paragraphs: ['Be patient with one another.'],
  personalAnswer: 'We will listen first.',
  mode: 'guided' as const,
}

const suggestion = {
  answers: [
    {
      questionId: 'theme',
      suggestedAnswer: 'Listen patiently before answering.',
      supportingParagraphs: ['Be patient with one another.'],
      confidence: 0.9,
    },
  ],
  warnings: [],
}

describe('requestStudySuggestion', () => {
  it('sends the guided request and returns a validated suggestion', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mode: 'guided', suggestion }), { status: 200 }),
    )

    await expect(requestStudySuggestion(input, fetchImpl)).resolves.toEqual(suggestion)
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/study/generate'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    )
  })

  it('returns a useful provider error without accepting malformed output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'MODEL_TIMEOUT', message: 'Model request timed out.' } }), {
        status: 504,
      }),
    )

    await expect(requestStudySuggestion(input, fetchImpl)).rejects.toThrow('Model request timed out.')
  })

  it('rejects an unvalidated successful response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mode: 'guided', suggestion: { answers: [], warnings: ['ok'], extra: true } }), {
        status: 200,
      }),
    )

    await expect(requestStudySuggestion(input, fetchImpl)).rejects.toThrow(/suggestion invalide/i)
  })
})
