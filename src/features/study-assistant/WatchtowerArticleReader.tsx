import { useMemo, useState } from 'react'
import { ScripturePopover } from '../../components/ScripturePopover'
import type { WatchtowerQuestion } from './WatchtowerWorkspace'
import type { WatchtowerPrivateArticle, WatchtowerPrivateFigure } from './watchtowerPrivateContent'

type WatchtowerArticleReaderProps = {
  article: WatchtowerPrivateArticle
  questions: WatchtowerQuestion[]
}

function ArticleFigure({ figure }: { figure: WatchtowerPrivateFigure }) {
  const srcSet = figure.sources
    .slice()
    .sort((left, right) => left.width - right.width)
    .map((source) => `${source.url} ${source.width}w`)
    .join(', ')

  return (
    <figure className="watchtower-reader__figure">
      <img
        src={figure.src}
        srcSet={srcSet}
        sizes="(max-width: 700px) calc(100vw - 40px), 760px"
        alt={figure.alt}
        width={figure.width}
        height={figure.height}
        loading="lazy"
        decoding="async"
      />
      <figcaption>{figure.caption}</figcaption>
    </figure>
  )
}

export function WatchtowerPreparedQuestion({ question }: { question: WatchtowerQuestion }) {
  const [reflection, setReflection] = useState('')
  const [revealed, setRevealed] = useState(false)

  return (
    <section className={`watchtower-reader__question ${revealed ? 'is-revealed' : ''}`} aria-labelledby={`reader-${question.id}`}>
      <div className="watchtower-reader__question-heading">
        <span>{question.number}</span>
        <h2 id={`reader-${question.id}`}>{question.text}</h2>
      </div>
      <div className="watchtower-reader__response-controls">
        <label className="watchtower-reader__reflection">
          <span>Ny eritreritro <small>Tsy voatery · Réflexion facultative</small></span>
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="Soraty eto raha tianao…"
            aria-label={`Ny eritreritro tsy voatery — ${question.number}`}
          />
        </label>
        <button
          type="button"
          className="secondary-action"
          aria-expanded={revealed}
          aria-controls={`reader-answer-${question.id}`}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? 'Afeno ny valiny' : 'Asehoy ny valiny'}
        </button>
      </div>
      {revealed && (
        <div className="watchtower-reader__answer" id={`reader-answer-${question.id}`} aria-live="polite">
          <p>{question.answer}</p>
          {question.references.length > 0 && (
            <ul>
              {question.references.map((reference) => (
                <li key={`${question.id}-${reference.url}`}>
                  <ScripturePopover label={reference.label} url={reference.url} variant="watchtower">
                    {reference.excerpt ?? 'Jereo ao amin’ny jw.org ilay andinin-teny feno.'}
                  </ScripturePopover>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

export function WatchtowerArticleReader({ article, questions }: WatchtowerArticleReaderProps) {
  const questionsById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions])
  const firstParagraphByQuestion = useMemo(() => {
    const positions = new Map<string, number>()
    article.blocks.forEach((block, index) => {
      if (block.type !== 'paragraph') return
      block.questionIds.forEach((questionId) => {
        if (!positions.has(questionId)) positions.set(questionId, index)
      })
    })
    return positions
  }, [article.blocks])
  const paragraphCount = article.blocks.filter((block) => block.type === 'paragraph' && !block.number.startsWith('fanampiny-')).length
  const associatedQuestionIds = new Set(firstParagraphByQuestion.keys())

  return (
    <article className="watchtower-reader" aria-label="Lahatsoratra feno ho an’ny fianakaviana">
      <header className="watchtower-reader__toolbar">
        <div>
          <span className="watchtower-reader__status-dot" aria-hidden="true" />
          <strong>Votoaty manokana tafiditra</strong>
        </div>
        <span>{paragraphCount} paragrafy</span>
      </header>
      <div className="watchtower-reader__flow">
        {article.blocks.map((block, index) => {
          if (block.type === 'heading') {
            const Heading = block.level === 2 ? 'h2' : 'h3'
            return <Heading className="watchtower-reader__heading" key={block.id}>{block.text}</Heading>
          }
          if (block.type === 'figure') return <ArticleFigure figure={block} key={block.id} />

          const questionsBefore = block.questionIds
            .filter((questionId) => firstParagraphByQuestion.get(questionId) === index)
            .map((questionId) => questionsById.get(questionId))
            .filter((question): question is WatchtowerQuestion => Boolean(question))

          const supplemental = block.number.startsWith('fanampiny-')
          return (
            <div className={`watchtower-reader__unit ${supplemental ? 'is-supplemental' : ''}`} key={block.id}>
              {questionsBefore.map((question) => <WatchtowerPreparedQuestion question={question} key={question.id} />)}
              <div className="watchtower-reader__paragraph" id={`paragraph-${block.number}`}>
                {!supplemental && <span className="watchtower-reader__paragraph-number" aria-label={`Paragrafy ${block.number}`}>{block.number}</span>}
                <p>{block.text}</p>
              </div>

            </div>
          )
        })}
        {questions.filter((question) => !associatedQuestionIds.has(question.id)).map((question) => (
          <WatchtowerPreparedQuestion question={question} key={question.id} />
        ))}
      </div>
    </article>
  )
}
