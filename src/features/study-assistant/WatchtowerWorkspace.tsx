import { useMemo, useState } from 'react'

export type WatchtowerReference = {
  label: string
  url: string
  excerpt?: string
}

function VersePreview({ reference }: { reference: WatchtowerReference }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <span className={`watchtower-verse ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="watchtower-verse__trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        {reference.label}
      </button>
      {isOpen && (
        <span className="watchtower-verse__preview" role="dialog" aria-label={`Andinin-teny ${reference.label}`}>
          <strong>{reference.label}</strong>
          {reference.excerpt ? <p>{reference.excerpt}</p> : <p>Jereo ao amin’ny jw.org ilay andinin-teny feno.</p>}
          <a href={reference.url} target="_blank" rel="noreferrer">Vakio ao amin’ny jw.org</a>
        </span>
      )}
    </span>
  )
}

export type WatchtowerQuestion = {
  id: string
  number: string
  text: string
  paragraphNumbers: string[]
  answer: string
  references: WatchtowerReference[]
}

export type WatchtowerStudy = {
  id: string
  documentId: number
  title: string
  weekLabel: string
  startDate: string
  endDate: string
  sourceUrl: string
  generatedAt: string
  model: 'gpt-5.6-terra'
  questions: WatchtowerQuestion[]
}

type WatchtowerWorkspaceProps = {
  studies: WatchtowerStudy[]
  selectedStudyId?: string
  today?: Date
  onSelectStudy?: (studyId: string) => void
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`)
}

function selectDefaultStudy(studies: WatchtowerStudy[], today: Date) {
  const active = studies.find((study) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return day >= dateAtNoon(study.startDate) && day <= dateAtNoon(study.endDate)
  })
  return active ?? [...studies].sort((a, b) => a.startDate.localeCompare(b.startDate)).find((study) => dateAtNoon(study.endDate) >= today) ?? studies[0]
}

function visibleHistory(studies: WatchtowerStudy[], today: Date) {
  const cutoff = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate())
  return studies
    .filter((study) => dateAtNoon(study.endDate) >= cutoff)
    .sort((first, second) => second.startDate.localeCompare(first.startDate))
}

export function WatchtowerWorkspace({ studies, selectedStudyId, today = new Date(), onSelectStudy }: WatchtowerWorkspaceProps) {
  const defaultStudy = useMemo(() => selectDefaultStudy(studies, today), [studies, today])
  const selected = studies.find((study) => study.id === selectedStudyId) ?? defaultStudy
  const history = useMemo(() => visibleHistory(studies, today), [studies, today])
  const [revealed, setRevealed] = useState<string[]>([])
  const [showParagraphs, setShowParagraphs] = useState(false)

  if (!selected) {
    return (
      <section className="watchtower-empty" aria-labelledby="watchtower-empty-title">
        <p className="eyebrow">Étude de La Tour de Garde</p>
        <h1 id="watchtower-empty-title">Aucune étude préparée</h1>
        <p>Le prochain cron Hermes recherchera l’étude officielle sur jw.org, préparera les réponses en malagasy, puis alimentera cette page.</p>
      </section>
    )
  }

  const toggleAnswer = (id: string) => setRevealed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <section className="watchtower-workspace" id="watchtower" aria-labelledby="watchtower-title">
      <header className="watchtower-header">
        <div>
          <p className="eyebrow">Étude de La Tour de Garde · Étude actuelle</p>
          <h1 id="watchtower-title">{selected.title}</h1>
          <p>{selected.weekLabel} · Réponses préparées en malagasy</p>
        </div>
        <div className="watchtower-header__meta">
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Lire l’article officiel</a>
        </div>
      </header>
      <div className="watchtower-layout">
        <aside className="watchtower-history" aria-label="Historique des études de La Tour de Garde">
          <h2>Historique</h2>
          <p>Deux derniers mois</p>
          <nav aria-label="Études Watchtower publiées">
            {history.map((study) => {
              const isSelected = study.id === selected.id
              return <a key={study.id} href={`#/assistant/${study.id}`} aria-current={isSelected ? 'page' : undefined} className={isSelected ? 'is-selected' : ''} onClick={() => onSelectStudy?.(study.id)}><strong>{study.weekLabel}</strong><small>{study.title}</small></a>
            })}
          </nav>
        </aside>
        <div className="watchtower-main">
          <div className="watchtower-notice" role="note">
            <span>Répondez d’abord avec vos propres mots. Ouvrez ensuite la réponse préparée pour la comparer.</span>
            <button type="button" className="watchtower-paragraph-toggle" aria-pressed={showParagraphs} onClick={() => setShowParagraphs((value) => !value)}>
              {showParagraphs ? 'Afeno ny paragrafy' : 'Asehoy ny paragrafy'}
            </button>
          </div>
          {selected.questions.length === 0 ? (
            <p className="watchtower-empty">Les questions de cette étude seront publiées après la prochaine génération hebdomadaire.</p>
          ) : (
            <div className="watchtower-question-list">
              {selected.questions.map((question) => {
                const isRevealed = revealed.includes(question.id)
                return (
                  <article className={`watchtower-question ${isRevealed ? 'is-revealed' : ''}`} key={question.id}>
                    <div className="watchtower-question__topline">
                      <span className="watchtower-question__number">{question.number}</span>
                      {showParagraphs && <span>Paragraphes {question.paragraphNumbers.join(', ') || 'article'}</span>}
                    </div>
                    <h2>{question.text}</h2>
                    {isRevealed ? (
                      <div className="watchtower-answer" aria-live="polite">
                        <p>{question.answer}</p>
                        {question.references.length > 0 && <ul>{question.references.map((reference) => <li key={`${question.id}-${reference.url}`}><VersePreview reference={reference} /></li>)}</ul>}
                      </div>
                    ) : <p className="watchtower-answer-placeholder">Valio aloha ilay fanontaniana, dia asehoy ny valiny.</p>}
                    <button type="button" onClick={() => toggleAnswer(question.id)}>{isRevealed ? 'Afeno ny valiny' : 'Asehoy ny valiny'}</button>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
