import { useMemo, useState } from 'react'

export type WatchtowerReference = {
  label: string
  url: string
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
  today?: Date
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`)
}

function selectStudy(studies: WatchtowerStudy[], today: Date) {
  const active = studies.find((study) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return day >= dateAtNoon(study.startDate) && day <= dateAtNoon(study.endDate)
  })
  return active ?? [...studies].sort((a, b) => a.startDate.localeCompare(b.startDate)).find((study) => dateAtNoon(study.endDate) >= today) ?? studies[0]
}

export function WatchtowerWorkspace({ studies, today = new Date() }: WatchtowerWorkspaceProps) {
  const selected = useMemo(() => selectStudy(studies, today), [studies, today])
  const [revealed, setRevealed] = useState<string[]>([])

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
          <span>GPT-5.6-terra · Hermes local</span>
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Lire l’article officiel</a>
        </div>
      </header>
      <div className="watchtower-notice" role="note">
        Répondez d’abord avec vos propres mots. Ouvrez ensuite la réponse préparée pour la comparer avec les paragraphes indiqués.
      </div>
      {selected.questions.length === 0 ? (
        <p className="watchtower-empty">Les questions de cette étude seront publiées après la prochaine génération hebdomadaire.</p>
      ) : (
        <div className="watchtower-question-list">
          {selected.questions.map((question) => {
            const isRevealed = revealed.includes(question.id)
            return (
              <article className={`watchtower-question ${isRevealed ? 'is-revealed' : ''}`} key={question.id}>
                <div className="watchtower-question__topline"><span className="watchtower-question__number">{question.number}</span><span>Paragraphes {question.paragraphNumbers.join(', ') || 'article'}</span></div>
                <h2>{question.text}</h2>
                {isRevealed ? (
                  <div className="watchtower-answer" aria-live="polite">
                    <p>{question.answer}</p>
                    {question.references.length > 0 && <ul>{question.references.map((reference) => <li key={`${question.id}-${reference.url}`}><a href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></li>)}</ul>}
                  </div>
                ) : <p className="watchtower-answer-placeholder">Valio aloha ilay fanontaniana, dia asehoy ny valiny.</p>}
                <button type="button" onClick={() => toggleAnswer(question.id)}>{isRevealed ? 'Afeno ny valiny' : 'Asehoy ny valiny'}</button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
