import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('Family Bible Study companion', () => {
  it('shows the four family members and their role cards', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /fianaram-pianakaviana/i })).toBeInTheDocument()
    expect(screen.getByText('Angelo')).toBeInTheDocument()
    expect(screen.getByText('Tatiana')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mpitarika' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mpampifandray' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mpamaly sy Mpisafidy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mpandray anjara' })).toBeInTheDocument()
  })

  it('rotates to the next activity when the family chooses another activity', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/Karatra safidy/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /activité suivante/i }))
    expect(screen.getByText(/Alaharo ny tantara/i)).toBeInTheDocument()
  })
})
