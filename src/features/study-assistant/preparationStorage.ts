export const PREPARATION_STORAGE_KEY = 'family-bible-study.preparations.v1'
export const PREPARATION_STORAGE_VERSION = 1

export type PreparationMode = 'manual' | 'guided'

export type PreparationDraft = {
  id: string
  studyId: string
  mode: PreparationMode
  mainIdea: string
  evidenceNotes: string
  reflectionNotes: string
  personalAnswer: string
  completedQuestionIds: string[]
  completedQuestionCount: number
  createdAt: string
  updatedAt: string
  revealedSuggestionCount: 0
}

type PreparationStore = {
  version: 1
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
  return {
    id: typeof value.id === 'string' ? value.id : value.studyId,
    studyId: value.studyId,
    mode: value.mode === 'guided' ? 'guided' : 'manual',
    mainIdea: typeof value.mainIdea === 'string' ? value.mainIdea : '',
    evidenceNotes: typeof value.evidenceNotes === 'string' ? value.evidenceNotes : '',
    reflectionNotes: typeof value.reflectionNotes === 'string' ? value.reflectionNotes : '',
    personalAnswer: typeof value.personalAnswer === 'string' ? value.personalAnswer : '',
    completedQuestionIds,
    completedQuestionCount: completedQuestionIds.length || (typeof value.completedQuestionCount === 'number' ? value.completedQuestionCount : 0),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    revealedSuggestionCount: 0,
  }
}

export function loadPreparationStore(storage: Storage = localStorage): PreparationStore {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PREPARATION_STORAGE_KEY) ?? 'null')
    if (!isRecord(parsed) || parsed.version !== PREPARATION_STORAGE_VERSION || !Array.isArray(parsed.drafts)) return emptyStore()
    const drafts = parsed.drafts.map(parseDraft).filter((draft): draft is PreparationDraft => draft !== null)
    const unique = new Map(drafts.map((draft) => [draft.studyId, draft]))
    return { version: PREPARATION_STORAGE_VERSION, drafts: [...unique.values()] }
  } catch {
    return emptyStore()
  }
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
    completedQuestionIds: [],
    completedQuestionCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    revealedSuggestionCount: 0,
  }
}
