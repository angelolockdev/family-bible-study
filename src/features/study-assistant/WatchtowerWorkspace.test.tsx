import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { WatchtowerWorkspace, type WatchtowerStudy } from './WatchtowerWorkspace'

const study: WatchtowerStudy = {
  id: 'watchtower-2026401',
  documentId: 2026401,
  title: 'Ampiasao Hampiofanana ny Feon’ny Fieritreretanao ny Torolalan’ny Baiboly',
  weekLabel: '13-19 Jolay 2026',
  startDate: '2026-07-13',
  endDate: '2026-07-19',
  sourceUrl: 'https://www.jw.org/finder?srcid=jwlshare&wtlocale=MG&prefer=lang&docid=2026401',
  generatedAt: '2026-07-16T12:00:00Z',
  model: 'gpt-5.6-terra',
  questions: [{
    id: '2026401-q1-2',
    number: '1-2',
    text: 'a) Inona no fanomezana nomen’i Jehovah an’i Adama sy Eva?',
    paragraphNumbers: ['1', '2'],
    answer: 'Nomen’i Jehovah safidy malalaka i Adama sy Eva.',
    references: [{ label: 'Genesisy 1:26, 27', url: 'https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/genesisy/1/#v1001026-v1001027' }],
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

describe('WatchtowerWorkspace', () => {
  it('shows an explicit empty state before the cron publishes a study', () => {
    render(<WatchtowerWorkspace studies={[]} today={new Date(2026, 6, 16)} />)
    expect(screen.getByRole('heading', { name: /Aucune étude préparée/i })).toBeInTheDocument()
    expect(screen.getByText(/prochain cron Hermes/i)).toBeInTheDocument()
  })

  it('reveals a generated answer only after the user asks for it', async () => {
    const user = userEvent.setup()
    render(<WatchtowerWorkspace studies={[study]} today={new Date(2026, 6, 16)} />)

    expect(screen.getByRole('heading', { name: study.title })).toBeInTheDocument()
    expect(screen.queryByText(study.questions[0].answer)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Asehoy ny valiny' }))

    expect(screen.getByText(study.questions[0].answer)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Genesisy 1:26, 27' })).toHaveAttribute('href', study.questions[0].references[0].url)
  })

  it('lists published studies and selects a historical study through a durable route', async () => {
    const user = userEvent.setup()
    const onSelectStudy = vi.fn()
    const { rerender } = render(<WatchtowerWorkspace studies={[study, historicStudy]} selectedStudyId={study.id} today={new Date(2026, 6, 16)} onSelectStudy={onSelectStudy} />)

    const history = screen.getByRole('complementary', { name: /Historique des études/i })
    const historicLink = screen.getByRole('link', { name: /6-12 Jolay 2026Fianarana teo aloha/i })
    expect(historicLink).toHaveAttribute('href', '#/assistant/watchtower-2026399')
    expect(screen.getByRole('link', { name: /13-19 Jolay 2026Ampiasao/i })).toHaveAttribute('aria-current', 'page')

    await user.click(historicLink)
    expect(onSelectStudy).toHaveBeenCalledWith(historicStudy.id)

    rerender(<WatchtowerWorkspace studies={[study, historicStudy]} selectedStudyId={historicStudy.id} today={new Date(2026, 6, 16)} onSelectStudy={onSelectStudy} />)
    expect(screen.getByRole('heading', { name: historicStudy.title })).toBeInTheDocument()
    expect(history).toContainElement(screen.getByRole('link', { name: /6-12 Jolay 2026Fianarana teo aloha/i, current: 'page' }))
  })
})
