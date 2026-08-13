import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScripturePopover } from '../../components/ScripturePopover'
import type { WatchtowerQuestion } from './WatchtowerWorkspace'
import type { WatchtowerPrivateArticle, WatchtowerPrivateFigure, WatchtowerPrivateParagraph } from './watchtowerPrivateContent'

type WatchtowerArticleReaderProps = {
  article: WatchtowerPrivateArticle
  questions: WatchtowerQuestion[]
}

function ArticleFigure({ figure }: { figure: WatchtowerPrivateFigure }) {
  const [expanded, setExpanded] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const srcSet = figure.sources
    .slice()
    .sort((left, right) => left.width - right.width)
    .map((source) => `${source.url} ${source.width}w`)
    .join(', ')

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    closeRef.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
      if (event.key === 'Tab') {
        event.preventDefault()
        closeRef.current?.focus()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.documentElement.style.overflow = previousOverflow
      triggerRef.current?.focus()
    }
  }, [expanded])

  return (
    <figure className="watchtower-reader__figure">
      <button
        type="button"
        className="watchtower-reader__figure-trigger"
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-label={`Jereo akaiky: ${figure.alt}`}
        onClick={() => setExpanded(true)}
        ref={triggerRef}
      >
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
      </button>
      <figcaption>{figure.caption}</figcaption>
      {expanded && createPortal(
        <div className="watchtower-image-dialog" role="presentation" onPointerDown={() => setExpanded(false)}>
          <div
            className="watchtower-image-dialog__panel"
            role="dialog"
            aria-modal="true"
            aria-label={figure.alt}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="watchtower-image-dialog__close" onClick={() => setExpanded(false)} ref={closeRef}>
              Akatona ny sary
            </button>
            <img
              src={figure.src}
              srcSet={srcSet}
              sizes="96vw"
              alt={figure.alt}
              width={figure.width}
              height={figure.height}
              decoding="async"
            />
            <p>{figure.caption}</p>
          </div>
        </div>,
        document.body,
      )}
    </figure>
  )
}

function ArticleParagraphText({ paragraph }: { paragraph: WatchtowerPrivateParagraph }) {
  if (!paragraph.segments) return <>{paragraph.text}</>

  return <>{paragraph.segments.map((segment, index) => segment.type === 'text'
    ? <span key={`text-${index}`}>{segment.text}</span>
    : (
      <ScripturePopover key={`${segment.url}-${index}`} label={segment.label} url={segment.url} variant="watchtower">
        {segment.excerpt}
      </ScripturePopover>
    ))}</>
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
            aria-label={`Ny eritreritro tsy voatery - ${question.number}`}
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
          if (block.type === 'summary') {
            return (
              <section className="watchtower-reader__summary" aria-labelledby={`${block.id}-title`} key={block.id}>
                <h2 id={`${block.id}-title`}>Famintinana</h2>
                <p className="watchtower-reader__summary-title">{block.title}</p>
                <ul>
                  {block.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
                </ul>
              </section>
            )
          }

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
                <p><ArticleParagraphText paragraph={block} /></p>
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
