export type GuidedAnswer = {
  questionId: string
  suggestedAnswer: string
  supportingParagraphs: string[]
  confidence: number
}

export type GuidedSuggestion = {
  answers: GuidedAnswer[]
  warnings: string[]
}

type StudySuggestionInput = {
  source: { canonicalUrl: string }
  questionId: string
  questionText: string
  paragraphs: string[]
  personalAnswer?: string
  mode: 'guided'
}

const DEFAULT_API_URL = 'https://bible-api.159.195.148.88.sslip.io'

function apiUrl() {
  return (import.meta.env.VITE_STUDY_API_URL || DEFAULT_API_URL).replace(/\/$/, '')
}

function hasExactKeys(value: object, keys: string[]) {
  return Object.keys(value).sort().join('|') === [...keys].sort().join('|')
}

function isGuidedSuggestion(value: unknown): value is GuidedSuggestion {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (!hasExactKeys(candidate, ['answers', 'warnings']) || !Array.isArray(candidate.answers) || !Array.isArray(candidate.warnings)) return false
  if (!candidate.warnings.every((warning) => typeof warning === 'string')) return false
  return candidate.answers.every((answer) => {
    if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) return false
    const item = answer as Record<string, unknown>
    return (
      hasExactKeys(item, ['questionId', 'suggestedAnswer', 'supportingParagraphs', 'confidence']) &&
      typeof item.questionId === 'string' &&
      typeof item.suggestedAnswer === 'string' &&
      Array.isArray(item.supportingParagraphs) &&
      item.supportingParagraphs.every((paragraph) => typeof paragraph === 'string') &&
      typeof item.confidence === 'number' &&
      item.confidence >= 0 &&
      item.confidence <= 1
    )
  })
}

export async function requestStudySuggestion(input: StudySuggestionInput, fetchImpl = fetch) {
  const response = await fetchImpl(`${apiUrl()}/api/study/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Le backend a renvoyé une réponse illisible.')
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' && 'message' in payload.error && typeof payload.error.message === 'string'
        ? payload.error.message
        : `Le backend a renvoyé HTTP ${response.status}.`
    throw new Error(message)
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('mode' in payload) ||
    payload.mode !== 'guided' ||
    !('suggestion' in payload) ||
    !isGuidedSuggestion(payload.suggestion)
  ) {
    throw new Error('Le backend a renvoyé une suggestion invalide.')
  }

  return payload.suggestion
}
