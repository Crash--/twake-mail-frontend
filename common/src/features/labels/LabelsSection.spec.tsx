import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeLabels
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { LabelActionsProvider } from './LabelActionsProvider'
import { LabelsSection } from './LabelsSection'

function setup(): ReturnType<typeof installFakeLabels> {
  const server = makeFakeJmapServer({
    capabilities: FAKE_LINAGORA_CAPABILITIES
  })
  const fake = installFakeLabels(server, [
    { id: 'work', displayName: 'Work', keyword: 'work', color: '#273891' }
  ])
  renderWithProviders(
    <LabelActionsProvider>
      <LabelsSection />
    </LabelActionsProvider>,
    { jmapServer: server, withJmapSession: true }
  )
  return fake
}

describe('LabelsSection', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('lists the labels, each opening its emails', async () => {
    setup()

    const nav = await screen.findByRole('navigation', { name: 'Labels' })
    expect(
      await within(nav).findByRole('link', { name: 'Work' })
    ).toHaveAttribute('href', '/label/work')
    // The list of the labels is not a second landmark inside it
    expect(screen.getAllByRole('navigation')).toEqual([nav])
  })

  it('creates a label with a colour, refusing a taken name', async () => {
    const fake = setup()

    await userEvent.click(
      await screen.findByRole('button', { name: 'New label' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Create a new label' })
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Label name' }),
      'work'
    )
    await userEvent.click(within(dialog).getByTestId('label-save-button'))
    expect(
      within(dialog).getByRole('textbox', { name: 'Label name' })
    ).toHaveAccessibleDescription(
      'A tag with this name already exists. Please choose a different name.'
    )

    await userEvent.clear(
      within(dialog).getByRole('textbox', { name: 'Label name' })
    )
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Label name' }),
      'Travel'
    )
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Magenta' })
    )
    await userEvent.click(within(dialog).getByTestId('label-save-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You successfully created the Travel label'
    )
    expect(fake.labels()).toContainEqual(
      expect.objectContaining({
        displayName: 'Travel',
        color: '#ED20A4',
        description: null
      })
    )
    expect(await screen.findByRole('link', { name: 'Travel' })).toBeVisible()
  })

  it('creates a label with a custom colour, refusing an invalid one', async () => {
    const fake = setup()

    await userEvent.click(
      await screen.findByRole('button', { name: 'New label' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Create a new label' })
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Label name' }),
      'Travel'
    )
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Custom color' })
    )
    const hex = within(dialog).getByRole('textbox', {
      name: 'Custom color (hexadecimal)'
    })
    await userEvent.clear(hex)
    await userEvent.type(hex, '#12')
    await userEvent.click(within(dialog).getByTestId('label-save-button'))

    expect(hex).toBeInvalid()
    expect(hex).toHaveFocus()
    expect(fake.labels()).toHaveLength(1)

    await userEvent.clear(hex)
    await userEvent.type(hex, 'c0ffee')
    await userEvent.click(within(dialog).getByTestId('label-save-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You successfully created the Travel label'
    )
    expect(fake.labels()).toContainEqual(
      expect.objectContaining({ displayName: 'Travel', color: '#C0FFEE' })
    )
  })

  it('edits a custom colour, and offers no "No color" to a coloured label', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    const fake = installFakeLabels(server, [
      { id: 'a', displayName: 'Blue', keyword: 'a', color: '#aabbcc' },
      { id: 'b', displayName: 'Plain', keyword: 'b', color: null }
    ])
    renderWithProviders(
      <LabelActionsProvider>
        <LabelsSection />
      </LabelActionsProvider>,
      { jmapServer: server, withJmapSession: true }
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions on Plain' })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(screen.getByRole('radio', { name: 'No color' })).toBeChecked()
    await userEvent.click(screen.getByTestId('label-cancel-button'))

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions on Blue' })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit label' })
    expect(within(dialog).queryByRole('radio', { name: 'No color' })).toBe(null)
    expect(
      within(dialog).getByRole('radio', { name: 'Custom color #AABBCC' })
    ).toBeChecked()
    const hex = within(dialog).getByRole('textbox', {
      name: 'Custom color (hexadecimal)'
    })
    await userEvent.clear(hex)
    await userEvent.type(hex, '#112233')
    await userEvent.click(within(dialog).getByTestId('label-save-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You successfully edited'
    )
    expect(fake.labels()).toContainEqual(
      expect.objectContaining({ displayName: 'Blue', color: '#112233' })
    )
  })

  it('deletes a label from its menu once confirmed', async () => {
    const fake = setup()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions on Work' })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You successfully deleted the Work label'
    )
    expect(fake.labels()).toEqual([])
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Work' })).toBe(null)
    })
  })

  it('is hidden when the user turned labels off', async () => {
    window.localStorage.setItem('twake-mail.preferences.labels', 'false')
    setup()

    await waitFor(() => {
      expect(screen.queryByTestId('labels-section')).toBe(null)
    })
  })
})
