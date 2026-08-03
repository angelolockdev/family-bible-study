import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScripturePopover } from './ScripturePopover'

function renderPopover() {
  render(
    <ScripturePopover label="Jeremia 20:9" url="https://www.jw.org/mg/bible/#v24020009">
      Tsy hangina ny tenin’i Jehovah.
    </ScripturePopover>,
  )
}

describe('ScripturePopover', () => {
  it('closes after the pointer leaves both the trigger and the portalled preview', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByRole('button', { name: 'Jeremia 20:9' })
    await user.hover(trigger)
    const preview = screen.getByRole('dialog', { name: 'Andinin-teny Jeremia 20:9' })
    await user.hover(preview)
    await user.unhover(preview)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Andinin-teny Jeremia 20:9' })).not.toBeInTheDocument()
    })
  })

  it('closes when a pinned trigger is clicked a second time', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByRole('button', { name: 'Jeremia 20:9' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Andinin-teny Jeremia 20:9' })).toBeInTheDocument()

    await user.click(trigger)
    expect(screen.queryByRole('dialog', { name: 'Andinin-teny Jeremia 20:9' })).not.toBeInTheDocument()
  })

  it('stays dismissed after Escape while focus remains on the trigger', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByRole('button', { name: 'Jeremia 20:9' })
    await user.tab()
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Andinin-teny Jeremia 20:9' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('dialog', { name: 'Andinin-teny Jeremia 20:9' })).not.toBeInTheDocument()
  })
})
