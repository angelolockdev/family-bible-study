export const LEGACY_PREPARATION_STORAGE_KEY = 'family-bible-study.preparations.v1'
export const PREPARATION_STORAGE_KEY = 'family-bible-study.preparations.v2'
export const PREPARATION_STORAGE_VERSION = 2

export type PreparationMode = 'manual' | 'guided'

export type PreparationDraft = {
  id: string
  studyId: string
  mode: PreparationMode
  mainIdea: string
  evidenceNotes: string
  reflectionNotes: string
  personalAnswer: string
  questionResponses: Record<string, string>
  completedQuestionIds: string[]
  completedQuestionCount: number
  createdAt: string
  updatedAt: string
  revealedSuggestionIds: string[]
  revealedSuggestionCount: number
}

type PreparationStore = {
  version: 2
  drafts: PreparationDraft[]
}

const emptyStore = (): PreparationStore => ({ version: PREPARATION_STORAGE_VERSION, drafts: [] })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseDraft(value: unknown): PreparationDraft | null {
  if (!isRecord(value) || typeof value.studyId !== 'string') return null
  const now = new Date().toISOString()
  const completedQuestionIds = Array.isArray(value.completedQuestionIds)
    ? value.completedQuestionIds.filter((item): item is string => typeof item === 'string')
    : []
  const questionResponses = isRecord(value.questionResponses)
    ? Object.fromEntries(Object.entries(value.questionResponses).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {}
  const revealedSuggestionIds = Array.isArray(value.revealedSuggestionIds)
    ? value.revealedSuggestionIds.filter((item): item is string => typeof item === 'string')
    : []
  return {
    id: typeof value.id === 'string' ? value.id : value.studyId,
    studyId: value.studyId,
    mode: value.mode === 'guided' ? 'guided' : 'manual',
    mainIdea: typeof value.mainIdea === 'string' ? value.mainIdea : '',
    evidenceNotes: typeof value.evidenceNotes === 'string' ? value.evidenceNotes : '',
    reflectionNotes: typeof value.reflectionNotes === 'string' ? value.reflectionNotes : '',
    personalAnswer: typeof value.personalAnswer === 'string' ? value.personalAnswer : '',
    questionResponses,
    completedQuestionIds,
    completedQuestionCount: completedQuestionIds.length || (typeof value.completedQuestionCount === 'number' ? value.completedQuestionCount : 0),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    revealedSuggestionIds,
    revealedSuggestionCount: revealedSuggestionIds.length,
  }
}

function readStoredJson(storage: Storage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

export function loadPreparationStore(storage: Storage = localStorage): PreparationStore {
  const current = readStoredJson(storage, PREPARATION_STORAGE_KEY)
  const legacy = readStoredJson(storage, LEGACY_PREPARATION_STORAGE_KEY)
  const parsed = isRecord(current) && current.version === PREPARATION_STORAGE_VERSION ? current : legacy
  if (!isRecord(parsed) || !Array.isArray(parsed.drafts)) return emptyStore()
  const drafts = parsed.drafts.map(parseDraft).filter((draft): draft is PreparationDraft => draft !== null)
  const unique = new Map(drafts.map((draft) => [draft.studyId, draft]))
  return { version: PREPARATION_STORAGE_VERSION, drafts: [...unique.values()] }
}

export function savePreparationDraft(draft: PreparationDraft, storage: Storage = localStorage) {
  try {
    const store = loadPreparationStore(storage)
    const drafts = store.drafts.filter((item) => item.studyId !== draft.studyId)
    storage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify({ ...store, drafts: [draft, ...drafts] }))
    return true
  } catch {
    return false
  }
}

export function createPreparationDraft(studyId: string, now = new Date()): PreparationDraft {
  const timestamp = now.toISOString()
  return {
    id: studyId,
    studyId,
    mode: 'manual',
    mainIdea: '',
    evidenceNotes: '',
    reflectionNotes: '',
    personalAnswer: '',
    questionResponses: {},
    completedQuestionIds: [],
    completedQuestionCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    revealedSuggestionIds: [],
    revealedSuggestionCount: 0,
  }
}
