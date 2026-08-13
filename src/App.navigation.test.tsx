import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { visualStateForReason } from './WeeklyCompanion'
import { PREPARATION_STORAGE_KEY } from './features/study-assistant/preparationStorage'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 8, 12))
  window.history.replaceState(null, '', '#/top')
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('weekly companion navigation', () => {
  it('maps the archive fallback to the past visual state', () => {
    expect(visualStateForReason('archive-fallback')).toBe('past')
  })
  it('exposes every workspace with exactly one active navigation item', () => {
    render(<App />)
    const navigation = screen.getByRole('navigation', { name: /Fizarana lehibe/i })

    expect(within(navigation).getByRole('link', { name: /Fandraisana/i })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: /^Fianarana$/i })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: /^Fanompoana$/i })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: /Tilikambo/i })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: /Fanomanana/i })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: /Tahiry/i })).toBeInTheDocument()
    expect(within(navigation).getAllByRole('link', { current: 'page' })).toHaveLength(1)
  })

  it('renders a lightweight weekly dashboard with generation freshness, progress, and primary preparation action', () => {
    localStorage.setItem(PREPARATION_STORAGE_KEY, JSON.stringify({
      version: 2,
      drafts: [{
        id: 'family-2026-08-03',
        studyId: 'family-2026-08-03',
        mode: 'manual',
        mainIdea: '',
        evidenceNotes: '',
        reflectionNotes: '',
        personalAnswer: '',
        questionResponses: {},
        completedQuestionIds: ['q1', 'q2'],
        completedQuestionCount: 2,
        createdAt: '2026-08-03T10:00:00.000Z',
        updatedAt: '2026-08-08T09:30:00.000Z',
        revealedSuggestionIds: [],
        revealedSuggestionCount: 0,
      }],
    }))

    render(<App />)

    expect(screen.getByRole('heading', { name: /Herinandro 3-9 Aogositra 2026/i })).toBeInTheDocument()
    expect(screen.getByText(/Votoaty nohavaozina farany/i)).toBeInTheDocument()
    expect(screen.getByText(/2\/7 vita/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Hanomboka ny fanomanana/i })).toHaveAttribute('href', '#/fanomanana')
    expect(screen.getByRole('link', { name: /Herinandro manaraka/i })).toHaveAttribute('href', '#/fianarana/family-2026-08-10')
    expect(screen.queryByRole('heading', { name: 'Mpitarika' })).not.toBeInTheDocument()
  })

  it('opens the personal preparation and Watchtower workspaces on distinct routes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    await user.click(screen.getByRole('link', { name: /Hanomboka ny fanomanana/i }))
    expect(window.location.hash).toBe('#/fanomanana')
    expect(screen.getByRole('heading', { name: /Fanomanana manokana/i })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Tilikambo/i }))
    expect(window.location.hash).toBe('#/tilikambo')
    expect(screen.getAllByText(/Tilikambo Fiambenana/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('navigation', { name: /Fizarana lehibe/i })).toContainElement(screen.getByRole('link', { name: /Tilikambo/i, current: 'page' }))
  })
})
