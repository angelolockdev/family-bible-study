import { useEffect, useMemo, useState } from 'react'
import { ModeChoice, PreparationFields } from './PreparationFields'

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
  return section === 'assistant' ? draftId : undefined
}

function defaultStudyId(reason: StudySelectionReason, studyId?: string) {
  return reason === 'archive-fallback' ? undefined : studyId
}

function resolveRouteStudyId(draftId: string | undefined, drafts: PreparationDraft[], fallbackStudyId?: string) {
  if (!draftId) return fallbackStudyId
  return drafts.find((draft) => draft.id === draftId)?.studyId
}

function isVisibleInTwoMonthArchive(study: AssistantStudy, today: Date) {
  const cutoff = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate())
  return new Date(`${study.endDate}T12:00:00`) >= cutoff
}

export function PreparationWorkspace({ studies, today = new Date() }: PreparationWorkspaceProps) {
  const defaultSelection = useMemo(() => selectFamilyStudy(studies, today), [studies, today])
  const [store, setStore] = useState(() => loadPreparationStore())
  const fallbackStudyId = defaultStudyId(defaultSelection.reason, defaultSelection.study?.id)
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
      <section className="assistant-empty" id="assistant">
        <h1>Préparation locale</h1>
        <p>Aucune étude actuelle ou à venir. Consultez l’historique pour reprendre une ancienne préparation.</p>
      </section>
    )
  }

  const activeDraft = draft
  const activeStudy = selectedStudy
  const selectionReason: WorkspaceSelectionReason = selectedStudy.id === fallbackStudyId ? defaultSelection.reason : 'history'
  const visibleHistory = store.drafts
    .map((item) => ({ draft: item, study: studies.find((study) => study.id === item.studyId) }))
    .filter((item): item is { draft: PreparationDraft; study: AssistantStudy } => Boolean(item.study && isVisibleInTwoMonthArchive(item.study, today)))
    .sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt))

  if (isVisibleInTwoMonthArchive(selectedStudy, today) && !visibleHistory.some((item) => item.draft.studyId === activeDraft.studyId)) {
    visibleHistory.unshift({ draft: activeDraft, study: selectedStudy })
  }

  function updateDraft(changes: Partial<PreparationDraft>) {
    const completedQuestionIds = changes.completedQuestionIds ?? activeDraft.completedQuestionIds
    const next: PreparationDraft = {
      ...activeDraft,
      ...changes,
      completedQuestionIds,
      completedQuestionCount: completedQuestionIds.length,
      revealedSuggestionCount: 0,
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


  return (
    <section className="assistant-workspace" id="assistant" aria-labelledby="assistant-title">
      <header className="assistant-header">
        <div><p className="eyebrow">{reasonLabels[selectionReason]}</p><h1 id="assistant-title">Préparation locale</h1><h2>{selectedStudy.reading}</h2><p>{selectedStudy.weekLabel} · {selectedStudy.theme}</p></div>
        <a href={selectedStudy.sourceUrl} target="_blank" rel="noreferrer">Loharano ofisialy / Source officielle</a>
      </header>
      <div className="assistant-layout">
        <aside className="assistant-history" aria-label="Historique des préparations">
          <h2>Historique</h2><p>Deux derniers mois</p>
          <nav aria-label="Préparations récentes">{visibleHistory.map(({ draft: historyDraft, study }) => {
            const selected = study.id === selectedStudy.id
            return <a key={historyDraft.id} href={`#/assistant/${historyDraft.id}`} aria-current={selected ? 'page' : undefined} className={selected ? 'is-selected' : ''} onClick={() => chooseDraft(study.id)}><strong>{study.weekLabel}</strong><small>{historyDraft.mode === 'guided' ? 'Guidée' : 'Manuelle'} · {historyDraft.completedQuestionCount}/{study.days.length}</small></a>
          })}</nav>
        </aside>
        <div className="assistant-editor">
          <ModeChoice mode={activeDraft.mode} onChange={(mode) => updateDraft({ mode })} />
          <section className="assistant-focus" aria-labelledby="source-focus-title"><h2 id="source-focus-title">Source focus</h2><p>{selectedStudy.theme}</p><p>{selectedStudy.memoryVerse.reference} — {selectedStudy.memoryVerse.application}</p></section>
          <fieldset className="assistant-questions"><legend>Fanontaniana / Questions</legend><ul>{selectedStudy.days.map((day, index) => {
            const questionId = `${selectedStudy.id}-question-${index}`
            return <li key={questionId}><label><input type="checkbox" checked={activeDraft.completedQuestionIds.includes(questionId)} onChange={() => toggleQuestion(questionId)} /><span><strong>{day.day}</strong>{day.focus}</span></label></li>
          })}</ul></fieldset>
          {activeDraft.mode === 'guided' && <section className="assistant-ai" aria-live="polite"><h2>Préparation guidée</h2><p>Les contenus générés par GPT-5.6-terra sont préparés chaque semaine par le cron Hermes local, validés, puis publiés dans ce catalogue et dans Slack. Cette page reste locale pour vos réponses personnelles.</p><p><strong>Ordre recommandé :</strong> répondez d’abord aux questions, puis comparez avec le briefing hebdomadaire publié dans #bible-malagasy.</p></section>}
          <PreparationFields draft={activeDraft} onChange={updateDraft} />
          {saveError
            ? <p className="assistant-save-status" role="alert">Impossible d’enregistrer localement. La saisie reste disponible jusqu’à la fermeture de cette page.</p>
            : <p className="assistant-save-status" role="status">Enregistré localement · {activeDraft.completedQuestionCount} question(s) terminée(s)</p>}
        </div>
      </div>
    </section>
  )
}
