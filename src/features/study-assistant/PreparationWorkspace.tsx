import { useEffect, useMemo, useState } from 'react'
import { ModeChoice, PreparationFields } from './PreparationFields'
import { visibleArchiveItems } from './archiveWindow'

import {
  createPreparationDraft,
  loadPreparationStore,
  savePreparationDraft,
  type PreparationDraft,
} from './preparationStorage'
import { selectFamilyStudy, type StudySelectionReason } from './studySelection'

export type AssistantStudy = {
  id: string
  kind: string
  startDate: string
  endDate: string
  weekLabel: string
  reading: string
  theme: string
  days: Array<{ day: string; focus: string }>
  memoryVerse: { reference: string; application: string; url: string }
  sourceUrl: string
  guidedSuggestions?: Array<{ questionId: string; text: string; sourceUrl: string }>
}

type PreparationWorkspaceProps = {
  studies: AssistantStudy[]
  today?: Date
}

type WorkspaceSelectionReason = StudySelectionReason | 'history'

const reasonLabels: Record<WorkspaceSelectionReason, string> = {
  current: 'Fianarana ankehitriny / Étude actuelle',
  upcoming: 'Fianarana manaraka / Étude à venir',
  'archive-fallback': 'Tahiry farany / Archive de secours',
  history: 'Fanomanana taloha / Préparation historique',
}

function routeDraftId() {
  const [section, draftId] = window.location.hash.replace(/^#\/?/, '').split('/')
  return section === 'fanomanana' ? draftId : undefined
}

function resolveRouteStudyId(draftId: string | undefined, drafts: PreparationDraft[], fallbackStudyId?: string) {
  if (!draftId) return fallbackStudyId
  return drafts.find((draft) => draft.id === draftId)?.studyId
}

export function PreparationWorkspace({ studies, today = new Date() }: PreparationWorkspaceProps) {
  const defaultSelection = useMemo(() => selectFamilyStudy(studies, today), [studies, today])
  const [store, setStore] = useState(() => loadPreparationStore())
  const fallbackStudyId = defaultSelection.study?.id
  const [selectedStudyId, setSelectedStudyId] = useState(() => resolveRouteStudyId(routeDraftId(), store.drafts, fallbackStudyId))
  const [saveError, setSaveError] = useState(false)


  useEffect(() => {
    const syncRoute = () => setSelectedStudyId(resolveRouteStudyId(routeDraftId(), store.drafts, fallbackStudyId))
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [fallbackStudyId, store.drafts])

  const selectedStudy = studies.find((study) => study.id === selectedStudyId)
  const existingDraft = store.drafts.find((draft) => draft.studyId === selectedStudy?.id)
  const draft = selectedStudy ? existingDraft ?? createPreparationDraft(selectedStudy.id, today) : undefined

  if (!selectedStudyId || !selectedStudy || !draft) {
    return (
      <section className="assistant-empty" id="fanomanana">
        <h1>Tsy misy fianarana homanina <small>Aucune étude à préparer</small></h1>
        <p>Tsy misy fianarana ankehitriny na manaraka. Mbola azonao jerena ao amin’ny tahiry ny fanomanana taloha. <small>Aucune étude actuelle ou à venir.</small></p>
      </section>
    )
  }

  const activeDraft = draft
  const activeStudy = selectedStudy
  const selectionReason: WorkspaceSelectionReason = selectedStudy.id === fallbackStudyId ? defaultSelection.reason : 'history'
  const visibleStudyIds = new Set(visibleArchiveItems(studies, today).map((study) => study.id))
  const visibleHistory = store.drafts
    .map((item) => ({ draft: item, study: studies.find((study) => study.id === item.studyId) }))
    .filter((item): item is { draft: PreparationDraft; study: AssistantStudy } => Boolean(item.study && visibleStudyIds.has(item.study.id)))
    .sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt))

  if (visibleStudyIds.has(selectedStudy.id) && !visibleHistory.some((item) => item.draft.studyId === activeDraft.studyId)) {
    visibleHistory.unshift({ draft: activeDraft, study: selectedStudy })
  }

  function updateDraft(changes: Partial<PreparationDraft>) {
    const completedQuestionIds = changes.completedQuestionIds ?? activeDraft.completedQuestionIds
    const next: PreparationDraft = {
      ...activeDraft,
      ...changes,
      completedQuestionIds,
      completedQuestionCount: completedQuestionIds.length,
      revealedSuggestionCount: (changes.revealedSuggestionIds ?? activeDraft.revealedSuggestionIds).length,
      updatedAt: new Date().toISOString(),
    }
    const saved = savePreparationDraft(next)
    setStore((current) => ({
      ...current,
      drafts: [next, ...current.drafts.filter((item) => item.studyId !== next.studyId)],
    }))
    setSaveError(!saved)
  }

  function chooseDraft(studyId: string) {
    const nextStudy = studies.find((study) => study.id === studyId)
    if (!nextStudy) return
    const nextDraft = store.drafts.find((item) => item.studyId === studyId) ?? createPreparationDraft(studyId, today)
    const saved = savePreparationDraft(nextDraft)
    setStore((current) => ({
      ...current,
      drafts: [nextDraft, ...current.drafts.filter((item) => item.studyId !== nextDraft.studyId)],
    }))
    setSaveError(!saved)
    setSelectedStudyId(studyId)
  }

  function toggleQuestion(questionId: string) {
    const completed = activeDraft.completedQuestionIds.includes(questionId)
      ? activeDraft.completedQuestionIds.filter((id) => id !== questionId)
      : [...activeDraft.completedQuestionIds, questionId]
    updateDraft({ completedQuestionIds: completed })
  }

  function updateQuestionResponse(questionId: string, value: string) {
    updateDraft({ questionResponses: { ...activeDraft.questionResponses, [questionId]: value } })
  }

  function toggleSuggestion(questionId: string) {
    const revealedSuggestionIds = activeDraft.revealedSuggestionIds.includes(questionId)
      ? activeDraft.revealedSuggestionIds.filter((id) => id !== questionId)
      : [...activeDraft.revealedSuggestionIds, questionId]
    updateDraft({ revealedSuggestionIds })
  }


  return (
    <section className="assistant-workspace" id="fanomanana" aria-labelledby="assistant-title">
      <header className="assistant-header">
        <div><p className="eyebrow">{reasonLabels[selectionReason]}</p><h1 id="assistant-title">Fanomanana manokana <small>Préparation locale</small></h1><h2>{selectedStudy.reading}</h2><p>{selectedStudy.weekLabel} · {selectedStudy.theme}</p></div>
        <a href={selectedStudy.sourceUrl} target="_blank" rel="noreferrer">Loharano ofisialy <small>Source officielle</small></a>
      </header>
      <div className="assistant-layout">
        <aside className="assistant-history" aria-label="Historique des préparations">
          <h2>Tahiry</h2><p>Roa volana farany</p>
          <nav aria-label="Préparations récentes">{visibleHistory.map(({ draft: historyDraft, study }) => {
            const selected = study.id === selectedStudy.id
            return <a key={historyDraft.id} href={`#/fanomanana/${historyDraft.id}`} aria-current={selected ? 'page' : undefined} className={selected ? 'is-selected' : ''} onClick={() => chooseDraft(study.id)}><strong>{study.weekLabel}</strong><small>{historyDraft.mode === 'guided' ? 'Misy tari-dalana' : 'An-tanana'} · {historyDraft.completedQuestionCount}/{study.days.length}</small></a>
          })}</nav>
        </aside>
        <div className="assistant-editor">
          <ModeChoice mode={activeDraft.mode} onChange={(mode) => updateDraft({ mode })} />
          <section className="assistant-focus" aria-labelledby="source-focus-title"><h2 id="source-focus-title">Hevi-dehibe <small>Repère de l’étude</small></h2><p>{selectedStudy.theme}</p><p>{selectedStudy.memoryVerse.reference} — {selectedStudy.memoryVerse.application}</p></section>
          {activeDraft.mode === 'guided' && (
            <section className="assistant-ai" aria-live="polite">
              <h2>Fanomanana misy tari-dalana</h2>
              {selectedStudy.guidedSuggestions?.length
                ? <p>Valio amin’ny teninao aloha ny fanontaniana. Rehefa avy eo vao azonao sokafana ny soso-kevitra voaomana ao amin’ny katalaogy.</p>
                : <p><strong>Tsy mbola misy soso-kevitra voaomana / Suggestions indisponibles.</strong> Mbola afaka manoratra sy mitahiry ny valinteninao an-tanana ianao.</p>}
            </section>
          )}
          <fieldset className="assistant-questions"><legend>Fanontaniana <small>Questions</small></legend><ul>{selectedStudy.days.map((day, index) => {
            const questionId = `${selectedStudy.id}-question-${index}`
            const reflection = activeDraft.questionResponses[questionId] ?? ''
            const suggestion = selectedStudy.guidedSuggestions?.find((item) => item.questionId === questionId)
            const isRevealed = activeDraft.revealedSuggestionIds.includes(questionId)
            const isComplete = activeDraft.completedQuestionIds.includes(questionId)
            return <li className="assistant-question" data-complete={isComplete} key={questionId}>
              <label className="assistant-question__complete"><input type="checkbox" checked={activeDraft.completedQuestionIds.includes(questionId)} onChange={() => toggleQuestion(questionId)} /><span><strong>{day.day}</strong>{day.focus}</span></label>
              <label className="assistant-question__reflection">Ny eritreritro momba an’i {day.day}<textarea data-filled={Boolean(reflection.trim())} placeholder="Soraty aloha amin’ny teninao…" value={reflection} onChange={(event) => updateQuestionResponse(questionId, event.target.value)} /></label>
              {activeDraft.mode === 'guided' && suggestion && <div className="assistant-suggestion">
                {isRevealed && <div className="assistant-suggestion__content"><p>{suggestion.text}</p><a href={suggestion.sourceUrl} target="_blank" rel="noreferrer">Loharano jw.org</a></div>}
                <button type="button" aria-expanded={isRevealed} disabled={!reflection.trim()} onClick={() => toggleSuggestion(questionId)}>{isRevealed ? 'Afeno ny soso-kevitra' : 'Asehoy ny soso-kevitra'}</button>
                {!reflection.trim() && <small>Manorata ny eritreritrao aloha.</small>}
              </div>}
            </li>
          })}</ul></fieldset>
          <PreparationFields draft={activeDraft} onChange={updateDraft} />
          {activeDraft.completedQuestionCount === selectedStudy.days.length && <p className="assistant-complete" role="status">Vita ny fanomanana amin’ity herinandro ity.</p>}
          {saveError
            ? <p className="assistant-save-status" role="alert">Tsy voatahiry eo an-toerana. Mbola hita eto ny soratrao mandra-pikaton’ity pejy ity. <small>Impossible d’enregistrer localement.</small></p>
            : <p className="assistant-save-status" role="status">Voatahiry eo an-toerana · {activeDraft.completedQuestionCount}/{selectedStudy.days.length} vita · {new Date(activeDraft.updatedAt).toLocaleTimeString('mg-MG', { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
      </div>
    </section>
  )
}
