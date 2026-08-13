import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { visibleArchiveItems } from './archiveWindow'
import { getStudySelectionReason, selectStudy } from './studySelection'
import { WatchtowerArticleReader, WatchtowerPreparedQuestion } from './WatchtowerArticleReader'
import {
  createIndexedDbPrivateArticleRepository,
  importWatchtowerPrivatePack,
  parseWatchtowerPrivatePack,
  type PrivateArticleRepository,
  type WatchtowerPrivateArticle,
  type WatchtowerPrivatePack,
} from './watchtowerPrivateContent'

export type WatchtowerReference = {
  label: string
  url: string
  excerpt?: string
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
  sourceDigest: string
  generatedAt: string
  model: string
  questions: WatchtowerQuestion[]
}

type WatchtowerWorkspaceProps = {
  studies: WatchtowerStudy[]
  selectedStudyId?: string
  today?: Date
  onSelectStudy?: (studyId: string) => void
  privateContentRepository?: PrivateArticleRepository
  privateArticleLoader?: PrivateArticleLoader
}

type PrivateArticleLoader = (
  study: WatchtowerStudy,
  repository: PrivateArticleRepository,
  studies: WatchtowerStudy[],
) => Promise<WatchtowerPrivateArticle | undefined>

function selectDefaultStudy(studies: WatchtowerStudy[], today: Date) {
  const selection = selectStudy(studies.map((study) => ({ ...study, kind: 'watchtower' })), 'watchtower', today)
  return studies.find((study) => study.id === selection.study?.id)
}

function isPrivateArticleCompatible(article: WatchtowerPrivateArticle, study: WatchtowerStudy) {
  if (
    article.contentKey !== study.id
    || article.documentId !== study.documentId
    || article.sourceUrl !== study.sourceUrl
    || article.sourceDigest.toLowerCase() !== study.sourceDigest.toLowerCase()
    || article.title !== study.title
  ) return false

  const expectedByParagraph = new Map<string, string[]>()
  study.questions.forEach((question) => {
    question.paragraphNumbers.forEach((number) => {
      expectedByParagraph.set(number, [...(expectedByParagraph.get(number) ?? []), question.id].sort())
    })
  })
  const paragraphs = article.blocks.filter((block) => block.type === 'paragraph')
  const actualNumbers = new Set(paragraphs.map((paragraph) => paragraph.number))
  if ([...expectedByParagraph.keys()].some((number) => !actualNumbers.has(number))) return false

  return paragraphs.every((paragraph) => {
    const expected = paragraph.number.startsWith('fanampiny-') ? [] : (expectedByParagraph.get(paragraph.number) ?? [])
    const actual = [...paragraph.questionIds].sort()
    return expected.length === actual.length && expected.every((id, index) => id === actual[index])
  })
}

function assertPrivatePackCompatible(pack: WatchtowerPrivatePack, studies: WatchtowerStudy[]) {
  pack.articles.forEach((article) => {
    const publishedStudy = studies.find((study) => study.id === article.contentKey)
    if (!publishedStudy || !isPrivateArticleCompatible(article, publishedStudy)) {
      throw new Error(`Le contenu privé ${article.contentKey} ne correspond pas au catalogue public.`)
    }
  })
}

const loadDevelopmentPrivateArticle: PrivateArticleLoader = async (study, repository, studies) => {
  const response = await fetch(`${import.meta.env.BASE_URL}__private-watchtower/${study.id}.json`)
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error('Impossible de charger le pack privé local.')

  const pack = parseWatchtowerPrivatePack(await response.text())
  assertPrivatePackCompatible(pack, studies)
  await repository.replaceAll(pack.articles)
  return repository.get(study.id)
}

export function WatchtowerWorkspace({ studies, selectedStudyId, today = new Date(), onSelectStudy, privateContentRepository, privateArticleLoader }: WatchtowerWorkspaceProps) {
  const defaultStudy = useMemo(() => selectDefaultStudy(studies, today), [studies, today])
  const selected = studies.find((study) => study.id === selectedStudyId) ?? defaultStudy
  const history = useMemo(() => visibleArchiveItems(studies, today), [studies, today])
  const repository = useMemo(() => {
    if (privateContentRepository) return privateContentRepository
    return typeof indexedDB === 'undefined' ? undefined : createIndexedDbPrivateArticleRepository(indexedDB)
  }, [privateContentRepository])
  const [privateArticle, setPrivateArticle] = useState<WatchtowerPrivateArticle>()
  const [privateContentStatus, setPrivateContentStatus] = useState<'loading' | 'missing' | 'ready' | 'error' | 'unsupported'>('loading')
  const [privateContentMessage, setPrivateContentMessage] = useState('')
  const effectivePrivateArticleLoader = privateArticleLoader
    ?? (import.meta.env.MODE === 'development' ? loadDevelopmentPrivateArticle : undefined)

  useEffect(() => {
    let cancelled = false
    setPrivateArticle(undefined)
    setPrivateContentMessage('')
    if (!selected) return () => { cancelled = true }
    if (!repository) return () => { cancelled = true }

    setPrivateContentStatus('loading')
    const loadArticle = async () => {
      let article = await repository.get(selected.id)
      if (!article && effectivePrivateArticleLoader) {
        article = await effectivePrivateArticleLoader(selected, repository, studies)
      }
      if (cancelled) return
      if (!article) {
        setPrivateContentStatus('missing')
        return
      }
      if (!isPrivateArticleCompatible(article, selected)) {
        setPrivateContentStatus('error')
        setPrivateContentMessage('Le pack privé ne correspond pas à cette étude publiée.')
        return
      }
      setPrivateArticle(article)
      setPrivateContentStatus('ready')
    }
    loadArticle().catch(() => {
      if (cancelled) return
      setPrivateContentStatus('error')
      setPrivateContentMessage('Impossible de lire le contenu privé local.')
    })
    return () => { cancelled = true }
  }, [effectivePrivateArticleLoader, repository, selected, studies])

  const handlePrivatePackImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !repository || !selected) return
    setPrivateContentStatus('loading')
    setPrivateContentMessage('')
    try {
      const result = await importWatchtowerPrivatePack(file, repository, (pack) => {
        assertPrivatePackCompatible(pack, studies)
      })
      const article = await repository.get(selected.id)
      if (article && isPrivateArticleCompatible(article, selected)) {
        setPrivateArticle(article)
        setPrivateContentStatus('ready')
      } else {
        setPrivateArticle(undefined)
        setPrivateContentStatus('missing')
      }
      setPrivateContentMessage(`${result.articleCount} article privé importé${result.articleCount > 1 ? 's' : ''}.`)
    } catch (error) {
      setPrivateArticle(undefined)
      setPrivateContentStatus('error')
      setPrivateContentMessage(error instanceof Error ? error.message : 'Import privé impossible.')
    }
  }


  if (!selected) {
    return (
      <section className="watchtower-empty" aria-labelledby="watchtower-empty-title">
        <p className="eyebrow">Tilikambo Fiambenana</p>
        <h1 id="watchtower-empty-title">Tsy mbola misy fianarana voaomana <small>Aucune étude préparée</small></h1>
        <p>Hikaroka ny lahatsoratra ofisialy ao amin’ny jw.org ny fanavaozana manaraka. Mandra-pahatongan’izay dia mbola azo jerena ny tahiry farany voamarina.</p>
      </section>
    )
  }

  const selectedReason = getStudySelectionReason(selected, today)
  const selectedPeriodLabel = selectedReason === 'current' ? 'Amin’ity herinandro ity' : selectedReason === 'upcoming' ? 'Herinandro manaraka' : 'Tahiry'
  const visiblePrivateContentStatus = repository ? privateContentStatus : 'unsupported'

  return (
    <section className="watchtower-workspace" id="watchtower" aria-labelledby="watchtower-title">
      <header className="watchtower-header">
        <div>
          <p className="eyebrow">Tilikambo Fiambenana · {selectedPeriodLabel}</p>
          <h1 id="watchtower-title">{selected.title}</h1>
          <p>{selected.weekLabel} · Valiny voaomana amin’ny teny malagasy</p>
        </div>
        <div className="watchtower-header__meta">
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Vakio ny lahatsoratra ofisialy</a>
        </div>
      </header>
      <div className="watchtower-layout">
        <aside className="watchtower-history" aria-label="Historique des études de La Tour de Garde">
          <h2>Tahiry</h2>
          <p>Roa volana farany</p>
          <nav aria-label="Études Watchtower publiées">
            {history.map((study) => {
              const isSelected = study.id === selected.id
              return <a key={study.id} href={`#/tilikambo/${study.id}`} aria-current={isSelected ? 'page' : undefined} className={isSelected ? 'is-selected' : ''} onClick={() => onSelectStudy?.(study.id)}><strong>{study.weekLabel}</strong><small>{study.title}</small></a>
            })}
          </nav>
        </aside>
        <div className="watchtower-main">
          <section className={`watchtower-private-import is-${visiblePrivateContentStatus}`} aria-label="Contenu Watchtower privé">
            <div role="status" aria-live="polite">
              <strong>{visiblePrivateContentStatus === 'ready' ? 'Votoaty feno vonona' : 'Votoaty feno manokana'}</strong>
              <span>
                {visiblePrivateContentStatus === 'loading' && 'Chargement du contenu privé…'}
                {visiblePrivateContentStatus === 'missing' && 'Aucun contenu privé importé pour cette étude.'}
                {visiblePrivateContentStatus === 'ready' && 'Le texte intégral reste uniquement dans ce navigateur.'}
                {visiblePrivateContentStatus === 'error' && (privateContentMessage || 'Le contenu privé est invalide.')}
                {visiblePrivateContentStatus === 'unsupported' && 'IndexedDB est indisponible dans ce navigateur.'}
              </span>
              {privateContentMessage && visiblePrivateContentStatus !== 'error' && <small>{privateContentMessage}</small>}
            </div>
            <label className={`watchtower-private-import__action ${repository ? '' : 'is-disabled'}`}>
              <span>Hampiditra pack <small>Importer</small></span>
              <input type="file" accept="application/json,.json" aria-label="Importer un pack Watchtower privé" disabled={!repository || visiblePrivateContentStatus === 'loading'} onChange={handlePrivatePackImport} />
            </label>
          </section>
          {privateArticle ? (
            <WatchtowerArticleReader article={privateArticle} questions={selected.questions} />
          ) : (
            <>
              <div className="watchtower-notice" role="note">
                <span>Hita foana eto ambany ny fanontaniana. Ampidiro ny pack manokana mba hampisehoana ny paragrafy ofisialy.</span>
              </div>
              {selected.questions.length === 0 ? (
                <p className="watchtower-empty">Havoaka aorian’ny fanavaozana isan-kerinandro manaraka ny fanontaniana amin’ity fianarana ity.</p>
              ) : (
                <div className="watchtower-question-list">
                  {selected.questions.map((question) => (
                    <div className="watchtower-fallback-question" key={question.id}>
                      <WatchtowerPreparedQuestion question={question} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
