import { describe, expect, it } from 'vitest'
import {
  LEGACY_PREPARATION_STORAGE_KEY,
  PREPARATION_STORAGE_KEY,
  PREPARATION_STORAGE_VERSION,
  createPreparationDraft,
  loadPreparationStore,
  savePreparationDraft,
} from './preparationStorage'

describe('preparationStorage v2', () => {
  it('migrates a valid v1 draft defensively without losing personal notes', () => {
    const storage = new Map<string, string>()
    storage.set(LEGACY_PREPARATION_STORAGE_KEY, JSON.stringify({
      version: 1,
      drafts: [{
        id: 'family-2026-08-03',
        studyId: 'family-2026-08-03',
        mode: 'guided',
        personalAnswer: 'Valiny efa voatahiry',
        completedQuestionIds: ['q1'],
        createdAt: '2026-08-03T10:00:00.000Z',
        updatedAt: '2026-08-03T11:00:00.000Z',
      }],
    }))
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } as unknown as Storage

    const store = loadPreparationStore(fakeStorage)

    expect(store.version).toBe(PREPARATION_STORAGE_VERSION)
    expect(store.drafts[0]).toMatchObject({
      personalAnswer: 'Valiny efa voatahiry',
      questionResponses: {},
      revealedSuggestionIds: [],
      revealedSuggestionCount: 0,
    })
  })

  it('persists per-question reflections and revealed catalogue suggestions in v2', () => {
    const values = new Map<string, string>()
    const fakeStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } as unknown as Storage
    const draft = createPreparationDraft('family-2026-08-03', new Date('2026-08-03T10:00:00.000Z'))
    draft.questionResponses.q1 = 'Ny eritreritro'
    draft.revealedSuggestionIds = ['q1']
    draft.revealedSuggestionCount = 1

    expect(savePreparationDraft(draft, fakeStorage)).toBe(true)
    expect(JSON.parse(values.get(PREPARATION_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: 2,
      drafts: [{ questionResponses: { q1: 'Ny eritreritro' }, revealedSuggestionIds: ['q1'] }],
    })
  })

  it('falls back to a valid legacy store when the current payload is corrupted', () => {
    const legacy = {
      version: 1,
      drafts: [{ studyId: 'family-2026-08-03', personalAnswer: 'Valiny taloha' }],
    }
    const values = new Map([
      [PREPARATION_STORAGE_KEY, '{invalid'],
      [LEGACY_PREPARATION_STORAGE_KEY, JSON.stringify(legacy)],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => undefined,
    } as unknown as Storage

    expect(loadPreparationStore(storage).drafts[0].personalAnswer).toBe('Valiny taloha')
  })
})
