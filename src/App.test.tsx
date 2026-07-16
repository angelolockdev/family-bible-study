import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => {
  window.history.replaceState(null, '', '#/top')
  localStorage.clear()
})

describe('Family Bible Study companion', () => {
  it('shows anonymized family role cards', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /fianaram-pianakaviana/i })).toBeInTheDocument()
    expect(screen.getAllByText('Ray aman-dreny')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Mpitarika' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mpampifandray' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mpamaly sy Mpisafidy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mpandray anjara' })).toBeInTheDocument()
  })

  it('rotates to the next activity when the family chooses another activity', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/Karatra safidy/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Karatra roa azo isafidianana/i })).toHaveAttribute('src', '/assets/activity-choice.svg')
    await user.click(screen.getByRole('button', { name: /activité suivante/i }))
    expect(screen.getByText(/Alaharo ny tantara/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Karatra telo arindra/i })).toHaveAttribute('src', '/assets/activity-order.svg')
  })

  it('shows every detected scripture as a hover/click preview', async () => {
    const user = userEvent.setup()
    render(<App />)

    const verse = screen.getByRole('button', { name: 'Jeremia 17:1-8' })
    await user.hover(verse)
    expect(screen.getByRole('dialog', { name: /Jeremia 17:1-8/i })).toBeInTheDocument()
    await user.unhover(verse)
    expect(screen.queryByRole('dialog', { name: /Jeremia 17:1-8/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '1 Petera 5:7' }))
    expect(screen.getByRole('dialog', { name: /1 Petera 5:7/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Vakio ao amin’ny jw.org/i })).toHaveAttribute(
      'href',
      'https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/1-petera/5/#v60005007',
    )
  })

  it('changes the reading directly from the chronological sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    const history = screen.getByRole('complementary', { name: /Navigation chronologique des lectures/i })
    const historicalStudy = within(history).getByRole('link', { name: /20-26 Jolay 2026Jeremia 18-19/i })
    await user.click(historicalStudy)

    expect(window.location.hash).toBe('#/fianarana/family-2026-07-20')
    expect(screen.getByRole('heading', { name: 'Jeremia 18-19' })).toBeInTheDocument()
    expect(within(history).getByRole('link', { name: /20-26 Jolay 2026Jeremia 18-19/i })).toHaveAttribute('aria-current', 'page')
    expect(within(history).getAllByRole('link', { current: 'page' })).toHaveLength(1)
  })

  it('opens a study directly from a route URL', () => {
    window.history.replaceState(null, '', '#/fianarana/family-2026-07-20')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Jeremia 18-19' })).toBeInTheDocument()
  })

  it('links to and renders the preparation assistant route', async () => {
    const user = userEvent.setup()
    render(<App />)

    const assistantLink = screen.getByRole('link', { name: 'Assistant / Fanomanana' })
    await user.click(assistantLink)

    expect(window.location.hash).toBe('#/assistant')
    expect(assistantLink).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: /Préparation locale/i })).toBeInTheDocument()
  })
})
