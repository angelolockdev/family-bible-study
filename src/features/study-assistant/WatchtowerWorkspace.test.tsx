import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { WatchtowerWorkspace, type WatchtowerStudy } from './WatchtowerWorkspace'
import type { PrivateArticleRepository, WatchtowerPrivateArticle, WatchtowerPrivatePack } from './watchtowerPrivateContent'

const study: WatchtowerStudy = {
  id: 'watchtower-2026401',
  documentId: 2026401,
  title: 'Ampiasao Hampiofanana ny Feon’ny Fieritreretanao ny Torolalan’ny Baiboly',
  weekLabel: '13-19 Jolay 2026',
  startDate: '2026-07-13',
  endDate: '2026-07-19',
  sourceUrl: 'https://www.jw.org/finder?srcid=jwlshare&wtlocale=MG&prefer=lang&docid=2026401',
  sourceDigest: 'a'.repeat(64),
  generatedAt: '2026-07-16T12:00:00Z',
  model: 'gpt-5.6-terra',
  questions: [{
    id: '2026401-q1-2',
    number: '1-2',
    text: 'a) Inona no fanomezana nomen’i Jehovah an’i Adama sy Eva?',
    paragraphNumbers: ['1', '2'],

    answer: 'Nomen’i Jehovah safidy malalaka i Adama sy Eva.',
    references: [{
      label: 'Genesisy 1:26, 27',
      url: 'https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/genesisy/1/#v1001026-v1001027',
      excerpt: '26 Hoy koa Andriamanitra: “Andao isika hanao olona mitovy endrika amintsika.” 27 Dia namorona ny olona hitovy endrika aminy Andriamanitra.',
    }],
  }],
}

const historicStudy: WatchtowerStudy = {
  ...study,
  id: 'watchtower-2026399',
  documentId: 2026399,
  title: 'Fianarana teo aloha',
  weekLabel: '6-12 Jolay 2026',
  startDate: '2026-07-06',
  endDate: '2026-07-12',
}

const privateArticle: WatchtowerPrivateArticle = {
  contentKey: study.id,
  documentId: study.documentId,
  sourceUrl: study.sourceUrl,
  sourceDigest: 'a'.repeat(64),
  title: study.title,
  blocks: [
    { id: 'paragraph-1', type: 'paragraph', number: '1', text: 'Paragrafy ofisialy voalohany.', questionIds: [study.questions[0].id] },
    { id: 'paragraph-2', type: 'paragraph', number: '2', text: 'Paragrafy ofisialy faharoa.', questionIds: [study.questions[0].id] },
  ],
}

function createMemoryRepository(initialArticles: WatchtowerPrivateArticle[] = []): PrivateArticleRepository {
  let articles = new Map(initialArticles.map((article) => [article.contentKey, article]))
  return {
    async get(contentKey) { return articles.get(contentKey) },
    async replaceAll(nextArticles) { articles = new Map(nextArticles.map((article) => [article.contentKey, article])) },
  }
}

describe('WatchtowerWorkspace', () => {
  it('shows an explicit empty state before the cron publishes a study', () => {
    render(<WatchtowerWorkspace studies={[]} today={new Date(2026, 6, 16)} />)
    expect(screen.getByRole('heading', { name: /Aucune étude préparée/i })).toBeInTheDocument()
    expect(screen.getByText(/fanavaozana manaraka/i)).toBeInTheDocument()
  })

  it('always shows fallback questions without a reflection field', async () => {
    const user = userEvent.setup()
    render(<WatchtowerWorkspace studies={[study]} today={new Date(2026, 6, 16)} />)

    expect(screen.getByRole('heading', { name: study.title })).toBeInTheDocument()
    expect(screen.queryByText(study.questions[0].answer)).not.toBeInTheDocument()

    const revealButton = screen.getByRole('button', { name: 'Asehoy ny valiny' })
    expect(revealButton).toBeEnabled()
    expect(screen.queryByRole('textbox', { name: /tsy voatery/i })).not.toBeInTheDocument()
    await user.click(revealButton)

    expect(screen.getByText(study.questions[0].answer)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Genesisy 1:26, 27' }))
    expect(screen.getByRole('dialog', { name: 'Andinin-teny Genesisy 1:26, 27' })).toHaveTextContent(study.questions[0].references[0].excerpt!)
    expect(screen.queryByText('Jereo ao amin’ny jw.org ilay andinin-teny feno.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vakio ao amin’ny jw.org' })).toHaveAttribute('href', study.questions[0].references[0].url)
  })

  it('does not present paragraph numbers as full content when the private pack is missing', async () => {
    render(<WatchtowerWorkspace studies={[study]} today={new Date(2026, 6, 16)} privateContentRepository={createMemoryRepository()} />)

    expect(screen.getByRole('heading', { name: study.questions[0].text })).toBeVisible()
    expect(await screen.findByText(/Aucun contenu privé importé/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /paragrafy/i })).not.toBeInTheDocument()
  })

  it('lists published studies and selects a historical study through a durable route', async () => {
    const user = userEvent.setup()
    const onSelectStudy = vi.fn()
    const { rerender } = render(<WatchtowerWorkspace studies={[study, historicStudy]} selectedStudyId={study.id} today={new Date(2026, 6, 16)} onSelectStudy={onSelectStudy} />)

    const history = screen.getByRole('complementary', { name: /Historique des études/i })
    const historicLink = screen.getByRole('link', { name: /6-12 Jolay 2026Fianarana teo aloha/i })
    expect(historicLink).toHaveAttribute('href', '#/tilikambo/watchtower-2026399')
    expect(screen.getByRole('link', { name: /13-19 Jolay 2026Ampiasao/i })).toHaveAttribute('aria-current', 'page')

    await user.click(historicLink)
    expect(onSelectStudy).toHaveBeenCalledWith(historicStudy.id)

    rerender(<WatchtowerWorkspace studies={[study, historicStudy]} selectedStudyId={historicStudy.id} today={new Date(2026, 6, 16)} onSelectStudy={onSelectStudy} />)
    expect(screen.getByRole('heading', { name: historicStudy.title })).toBeInTheDocument()
    expect(history).toContainElement(screen.getByRole('link', { name: /6-12 Jolay 2026Fianarana teo aloha/i, current: 'page' }))
  })

  it('loads a matching private article as a continuous reading experience', async () => {
    const repository = createMemoryRepository([privateArticle])

    render(<WatchtowerWorkspace studies={[study]} today={new Date(2026, 6, 16)} privateContentRepository={repository} />)

    expect(await screen.findByText('Paragrafy ofisialy voalohany.')).toBeVisible()
    expect(screen.getByText('Votoaty manokana tafiditra')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Asehoy ny paragrafy' })).not.toBeInTheDocument()
  })

  it('loads the generated local private pack automatically in development', async () => {
    const repository = createMemoryRepository()
    const privateArticleLoader = vi.fn(async () => privateArticle)

    render(
      <WatchtowerWorkspace
        studies={[study]}
        today={new Date(2026, 6, 16)}
        privateContentRepository={repository}
        privateArticleLoader={privateArticleLoader}
      />,
    )

    expect(await screen.findByText('Paragrafy ofisialy voalohany.')).toBeVisible()
    expect(privateArticleLoader).toHaveBeenCalledWith(study, repository, [study])
  })

  it('imports a validated private pack without exposing it in the public catalogue', async () => {
    const user = userEvent.setup()
    const repository = createMemoryRepository()
    const pack: WatchtowerPrivatePack = {
      version: 1,
      generatedAt: '2026-08-08T19:30:00.000Z',
      articles: [privateArticle],
    }
    render(<WatchtowerWorkspace studies={[study]} today={new Date(2026, 6, 16)} privateContentRepository={repository} />)

    expect(await screen.findByText(/Aucun contenu privé importé/i)).toBeVisible()
    const file = new File([JSON.stringify(pack)], 'watchtower-private-pack.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/Importer un pack Watchtower privé/i), file)

    expect(await screen.findByText('Paragrafy ofisialy faharoa.')).toBeVisible()
    expect(screen.getByText(/1 article privé importé/i)).toBeVisible()
  })

  it('rejects packs with unknown articles or incomplete question mappings', async () => {
    const user = userEvent.setup()
    const repository = createMemoryRepository()
    const incompatibleArticle = structuredClone(privateArticle)
    incompatibleArticle.contentKey = 'watchtower-unknown'
    incompatibleArticle.blocks = incompatibleArticle.blocks.map((block) => block.type === 'paragraph' ? { ...block, questionIds: [] } : block)
    const pack: WatchtowerPrivatePack = {
      version: 1,
      generatedAt: '2026-08-08T19:30:00.000Z',
      articles: [incompatibleArticle],
    }
    render(<WatchtowerWorkspace studies={[study]} today={new Date(2026, 6, 16)} privateContentRepository={repository} />)

    expect(await screen.findByText(/Aucun contenu privé importé/i)).toBeVisible()
    const file = new File([JSON.stringify(pack)], 'incompatible.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/Importer un pack Watchtower privé/i), file)

    expect(await screen.findByText(/ne correspond pas au catalogue public/i)).toBeVisible()
    expect(await repository.get('watchtower-unknown')).toBeUndefined()
  })
})
