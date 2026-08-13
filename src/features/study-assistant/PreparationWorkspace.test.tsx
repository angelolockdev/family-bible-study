import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import studiesData from '../../data/studies.json'
import { PreparationWorkspace, type AssistantStudy } from './PreparationWorkspace'
import { PREPARATION_STORAGE_KEY } from './preparationStorage'

const familyStudies = studiesData.filter((study) => study.kind === 'family') as AssistantStudy[]
const selectedStudy = familyStudies[1]

const storedDraft = (id: string, studyId: string, personalAnswer = '') => ({
  id,
  studyId,
  mode: 'manual',
  mainIdea: '',
  evidenceNotes: '',
  reflectionNotes: '',
  personalAnswer,
  questionResponses: {},
  completedQuestionIds: [],
  completedQuestionCount: 0,
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
  revealedSuggestionIds: [],
  revealedSuggestionCount: 0,
})

beforeEach(() => {
  window.history.replaceState(null, '', '#/fanomanana')
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PreparationWorkspace', () => {
  it('offers manual and guided preparation modes and starts in manual mode', () => {
    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)

    expect(screen.getByRole('heading', { name: /Préparation locale/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Fanomanana an-tanana/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Fanomanana misy tari-dalana/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Analyse personnelle/i })).toBeInTheDocument()
  })

  it('exposes selected mode and completed-question states for visual feedback', async () => {
    const user = userEvent.setup()
    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)

    const manual = screen.getByRole('radio', { name: /Fanomanana an-tanana/i })
    const guided = screen.getByRole('radio', { name: /Fanomanana misy tari-dalana/i })
    expect(manual.closest('label')).toHaveAttribute('data-selected', 'true')
    expect(guided.closest('label')).toHaveAttribute('data-selected', 'false')

    await user.click(guided)
    expect(guided.closest('label')).toHaveAttribute('data-selected', 'true')

    const firstQuestion = screen.getAllByRole('checkbox')[0]
    expect(firstQuestion.closest('li')).toHaveAttribute('data-complete', 'false')
    await user.click(firstQuestion)
    expect(firstQuestion.closest('li')).toHaveAttribute('data-complete', 'true')
  })

  it('persists a manual answer when the workspace is rendered again', async () => {
    const user = userEvent.setup()
    const first = render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)
    const answer = screen.getByLabelText(/Valin-tena/i)

    await user.type(answer, 'Hiezaka hanetry tena aho.')
    expect(JSON.parse(localStorage.getItem(PREPARATION_STORAGE_KEY) ?? '{}').drafts[0].personalAnswer).toContain('Hiezaka')

    first.unmount()
    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)
    expect(screen.getByLabelText(/Valin-tena/i)).toHaveValue('Hiezaka hanetry tena aho.')
  })

  it('renders one selected history item and can select another draft', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify({
      version: 2,
      drafts: [
        storedDraft('family-2026-07-20', 'family-2026-07-20'),
        storedDraft('family-2026-07-13', 'family-2026-07-13'),
      ],
    }))

    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)
    const history = screen.getByRole('complementary', { name: /Historique des préparations/i })
    expect(within(history).getAllByRole('link', { current: 'page' })).toHaveLength(1)
    await user.click(within(history).getByRole('link', { name: /13-19 Jolay/i }))
    expect(window.location.hash).toBe('#/fanomanana/family-2026-07-13')
    expect(within(history).getByRole('link', { name: /13-19 Jolay/i })).toHaveAttribute('aria-current', 'page')
  })

  it('shows an explicit unavailable state when guided suggestions were not prepared', async () => {
    const user = userEvent.setup()
    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)
    await user.click(screen.getByRole('radio', { name: /Fanomanana misy tari-dalana/i }))

    expect(screen.getByText(/Tsy mbola misy soso-kevitra voaomana/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Asehoy ny soso-kevitra/i })).not.toBeInTheDocument()
  })

  it('requires a personal reflection before revealing a pre-generated catalogue suggestion', async () => {
    const user = userEvent.setup()
    const study = familyStudies[1]
    const questionId = `${study.id}-question-0`
    render(<PreparationWorkspace studies={[{
      ...study,
      guidedSuggestions: [{ questionId, text: 'Soso-kevitra voaomana sy voamarina.', sourceUrl: study.sourceUrl }],
    }]} today={new Date(2026, 6, 21)} />)
    await user.click(screen.getByRole('radio', { name: /Fanomanana misy tari-dalana/i }))

    const reveal = screen.getByRole('button', { name: /Asehoy ny soso-kevitra/i })
    expect(reveal).toBeDisabled()
    expect(screen.queryByText('Soso-kevitra voaomana sy voamarina.')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/Ny eritreritro.*Alatsinainy/i), 'Ny valinteniko manokana')
    expect(reveal).toBeEnabled()
    await user.click(reveal)

    expect(screen.getByText('Soso-kevitra voaomana sy voamarina.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Loharano jw.org/i })).toHaveAttribute('href', study.sourceUrl)
  })

  it('shows the selected study source and selection reason', () => {
    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)

    expect(screen.getByRole('heading', { name: selectedStudy.reading })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Loharano ofisialy/i })).toHaveAttribute('href', selectedStudy.sourceUrl)
    expect(screen.getByText(/fianarana ankehitriny/i)).toBeInTheDocument()
  })

  it('resolves a direct draft route when its id differs from the study id', () => {
    localStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify({
      version: 2,
      drafts: [storedDraft('draft-personnel-13-jolay', 'family-2026-07-13', 'Valiny voatahiry')],
    }))
    window.history.replaceState(null, '', '#/fanomanana/draft-personnel-13-jolay')

    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)

    expect(screen.getByRole('heading', { name: 'Jeremia 16-17' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Valin-tena/i)).toHaveValue('Valiny voatahiry')
  })

  it('synchronizes the displayed preparation when the assistant hash changes', () => {
    localStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify({
      version: 2,
      drafts: [
        storedDraft('draft-current', 'family-2026-07-20', 'Current'),
        storedDraft('draft-history', 'family-2026-07-13', 'History'),
      ],
    }))
    window.history.replaceState(null, '', '#/fanomanana/draft-current')
    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)

    act(() => {
      window.history.replaceState(null, '', '#/fanomanana/draft-history')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(screen.getByLabelText(/Valin-tena/i)).toHaveValue('History')
    expect(screen.getByRole('heading', { name: 'Jeremia 16-17' })).toBeInTheDocument()
  })

  it('falls back explicitly to the latest archived study when none is current or upcoming', () => {
    const pastStudies = familyStudies.map((study) => ({ ...study, startDate: '2025-01-01', endDate: '2025-01-07' }))

    render(<PreparationWorkspace studies={pastStudies} today={new Date(2026, 6, 21)} />)

    expect(screen.getByText(/Archive de secours/i)).toBeInTheDocument()
    expect(screen.queryByText(/Aucune étude actuelle ou à venir/i)).not.toBeInTheDocument()
  })

  it('reports a local persistence error without breaking the editor', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 6, 21)} />)

    await user.type(screen.getByLabelText(/Valin-tena/i), 'Réponse conservée en mémoire')

    expect(screen.getByLabelText(/Valin-tena/i)).toHaveValue('Réponse conservée en mémoire')
    expect(screen.getByRole('alert')).toHaveTextContent(/Impossible d’enregistrer localement/i)
  })

  it('excludes preparation history older than two months', () => {
    localStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify({
      version: 2,
      drafts: [storedDraft('old-draft', 'family-2026-07-13')],
    }))

    render(<PreparationWorkspace studies={familyStudies} today={new Date(2026, 9, 21)} />)

    expect(screen.queryByRole('link', { name: /13-19 Jolay/i })).not.toBeInTheDocument()
  })
})
