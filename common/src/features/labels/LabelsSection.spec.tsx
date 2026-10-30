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

function setup(
  labels: Parameters<typeof installFakeLabels>[1] = [
    { id: 'work', displayName: 'Work', keyword: 'work', color: '#273891' }
  ]
): ReturnType<typeof installFakeLabels> {
  const server = makeFakeJmapServer({
    capabilities: FAKE_LINAGORA_CAPABILITIES
  })
  const fake = installFakeLabels(server, labels)
  renderWithProviders(
    <LabelActionsProvider>
      <LabelsSection />
    </LabelActionsProvider>,
    { jmapServer: server, withJmapSession: true }
  )
  return fake
}

/** ColorList names no button until twake-ui#223 is published */
function colorButton(dialog: HTMLElement, position: number): HTMLElement {
  const button = within(
    within(dialog).getByTestId('label-color-picker')
  ).getAllByRole('button')[position]
  if (button === undefined) throw new Error(`No colour at ${String(position)}`)
  return button
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

  it('names a label another client left without a name', async () => {
    setup([{ id: 'blank', displayName: ' ', keyword: 'blank', color: null }])

    const nav = await screen.findByRole('navigation', { name: 'Labels' })
    expect(
      await within(nav).findByRole('link', { name: '(No name)' })
    ).toHaveAttribute('href', '/label/blank')
    expect(
      within(nav).getByRole('button', { name: 'Actions on (No name)' })
    ).toBeVisible()
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
    // The colour saved below says which swatch this is
    await userEvent.click(colorButton(dialog, 11))
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
    // After the 20 swatches, the custom colour
    await userEvent.click(colorButton(dialog, 20))
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

  it('opens a label of a palette colour with its check, without the custom field', async () => {
    setup()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions on Work' })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit label' })

    expect(colorButton(dialog, 0).querySelector('svg')).not.toBe(null)
    expect(colorButton(dialog, 1).querySelector('svg')).toBe(null)
    expect(
      within(dialog).queryByRole('textbox', {
        name: 'Custom color (hexadecimal)'
      })
    ).toBe(null)
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
    expect(screen.getByRole('button', { name: 'No color' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByTestId('label-cancel-button'))

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions on Blue' })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit label' })
    expect(within(dialog).queryByRole('button', { name: 'No color' })).toBe(
      null
    )
    const hex = within(dialog).getByRole('textbox', {
      name: 'Custom color (hexadecimal)'
    })
    expect(hex).toHaveValue('#aabbcc')
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
