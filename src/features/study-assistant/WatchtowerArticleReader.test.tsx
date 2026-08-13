import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WatchtowerArticleReader } from './WatchtowerArticleReader'
import type { WatchtowerQuestion } from './WatchtowerWorkspace'
import type { WatchtowerPrivateArticle } from './watchtowerPrivateContent'

const article: WatchtowerPrivateArticle = {
  contentKey: 'watchtower-2026401',
  documentId: 2026401,
  sourceUrl: 'https://www.jw.org/finder?wtlocale=MG&docid=2026401',
  sourceDigest: 'a'.repeat(64),
  title: 'Lahatsoratra fitsapana',
  blocks: [
    { id: 'heading-1', type: 'heading', level: 2, text: 'Intertitre' },
    {
      id: 'paragraph-1',
      type: 'paragraph',
      number: '1',
      text: 'Paragrafy voalohany. Jaona 6:68.',
      questionIds: ['2026401-q1-2'],
      segments: [
        { type: 'text', text: 'Paragrafy voalohany. ' },
        {
          type: 'scripture',
          label: 'Jaona 6:68',
          url: 'https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/jaona/6/#v43006068',
          excerpt: 'Tompo ô, hankany amin’iza moa izahay?',
        },
        { type: 'text', text: '.' },
      ],
    },
    {
      id: 'figure-1',
      type: 'figure',
      src: 'https://cms-imgp.jw-cdn.org/img/p/2026401/univ/art/image-lg.jpg',
      alt: 'Sary fanazavana',
      caption: 'Fanazavana ny sary.',
      afterParagraph: '1',
      width: 1200,
      height: 800,
      sources: [
        { url: 'https://cms-imgp.jw-cdn.org/img/p/test_sm.jpg', width: 480 },
        { url: 'https://cms-imgp.jw-cdn.org/img/p/test_md.jpg', width: 800 },
      ],
    },
    { id: 'paragraph-2', type: 'paragraph', number: '2', text: 'Paragrafy faharoa.', questionIds: ['2026401-q1-2'] },
    { id: 'paragraph-supplemental', type: 'paragraph', number: 'fanampiny-68', text: 'Fanampim-panazavana.', questionIds: [] },
    {
      id: 'summary-review',
      type: 'summary',
      title: 'NAHOANA IRETO FAHAMARINANA IRETO NO MANAMPY ANTSIKA?',
      prompts: ['I Jehovah no Mpamorona', 'Tenin’Andriamanitra ny Baiboly'],
    },
  ],
}

const questions: WatchtowerQuestion[] = [{
  id: '2026401-q1-2',
  number: '1-2',
  text: 'Inona no nianarantsika?',
  paragraphNumbers: ['1', '2'],
  answer: 'Ity ny valiny voaomana.',
  references: [],
}]

describe('WatchtowerArticleReader', () => {
  it('shows each question before its first associated official paragraph', () => {
    render(<WatchtowerArticleReader article={article} questions={questions} />)

    const question = screen.getByRole('heading', { name: 'Inona no nianarantsika?' })
    const firstParagraph = screen.getByText(/Paragrafy voalohany/)
    const lastParagraph = screen.getByText('Paragrafy faharoa.')
    expect(question.compareDocumentPosition(firstParagraph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(firstParagraph.compareDocumentPosition(lastParagraph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('heading', { name: 'Inona no nianarantsika?' })).toHaveLength(1)
    expect(screen.getByText('Fanampim-panazavana.')).toBeVisible()
    expect(screen.queryByText('fanampiny-68')).not.toBeInTheDocument()
  })

  it('keeps reflection optional and toggles the prepared answer independently', async () => {
    const user = userEvent.setup()
    render(<WatchtowerArticleReader article={article} questions={questions} />)

    const reveal = screen.getByRole('button', { name: 'Asehoy ny valiny' })
    expect(reveal).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /tsy voatery/i })).toBeVisible()
    expect(screen.queryByText('Ity ny valiny voaomana.')).not.toBeInTheDocument()

    await user.click(reveal)
    expect(screen.getByText('Ity ny valiny voaomana.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Afeno ny valiny' }))
    expect(screen.queryByText('Ity ny valiny voaomana.')).not.toBeInTheDocument()
  })

  it('opens an official scripture excerpt directly from an article paragraph', async () => {
    const user = userEvent.setup()
    render(<WatchtowerArticleReader article={article} questions={questions} />)

    await user.click(screen.getByRole('button', { name: 'Jaona 6:68' }))

    const dialog = screen.getByRole('dialog', { name: 'Andinin-teny Jaona 6:68' })
    expect(dialog).toHaveTextContent('Tompo ô, hankany amin’iza moa izahay?')
    expect(screen.getByRole('link', { name: 'Vakio ao amin’ny jw.org' })).toHaveAttribute(
      'href',
      'https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/jaona/6/#v43006068',
    )
  })

  it('shows the final Famintinana with every official review prompt', () => {
    render(<WatchtowerArticleReader article={article} questions={questions} />)

    expect(screen.getByRole('heading', { name: 'Famintinana' })).toBeVisible()
    expect(screen.getByText('NAHOANA IRETO FAHAMARINANA IRETO NO MANAMPY ANTSIKA?')).toBeVisible()
    expect(screen.getByText('I Jehovah no Mpamorona')).toBeVisible()
    expect(screen.getByText('Tenin’Andriamanitra ny Baiboly')).toBeVisible()
  })

  it('reserves image space and lazy-loads an official responsive source', () => {
    render(<WatchtowerArticleReader article={article} questions={questions} />)

    const image = screen.getByRole('img', { name: 'Sary fanazavana' })
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('decoding', 'async')
    expect(image).toHaveAttribute('width', '1200')
    expect(image).toHaveAttribute('height', '800')
    expect(image).toHaveAttribute('srcset', expect.stringContaining('test_md.jpg 800w'))
    expect(screen.getByText('Fanazavana ny sary.')).toBeVisible()
  })

  it('opens an article image in an accessible detail dialog and closes it again', async () => {
    const user = userEvent.setup()
    render(<WatchtowerArticleReader article={article} questions={questions} />)

    await user.click(screen.getByRole('button', { name: /Jereo akaiky: Sary fanazavana/i }))

    const dialog = screen.getByRole('dialog', { name: 'Sary fanazavana' })
    expect(dialog).toBeVisible()
    expect(screen.getAllByRole('img', { name: 'Sary fanazavana' })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Akatona ny sary' }))
    expect(screen.queryByRole('dialog', { name: 'Sary fanazavana' })).not.toBeInTheDocument()
  })
})
