import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
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

async function openColors(dialog: HTMLElement): Promise<HTMLElement> {
  await userEvent.click(within(dialog).getByTestId('label-color-picker'))
  return screen.findByRole('radiogroup', { name: 'Choose a label color' })
}

describe('LabelsSection', () => {
  afterEach(() => {
    window.localStorage.clear()
    resetViewport()
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
    expect(
      within(dialog).getByTestId('label-name-announcement')
    ).toHaveTextContent(
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
      within(await openColors(dialog)).getByRole('radio', { name: 'Magenta' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBe(null)
    })
    expect(
      within(dialog).getByRole('button', { name: 'Label color: Magenta' })
    ).toHaveFocus()
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

  it('creates a label with a colour drawn among the free ones', async () => {
    // The first swatch, navy blue, is taken by Work: the draw starts after it
    jest.spyOn(Math, 'random').mockReturnValue(0)
    const fake = setup()

    await userEvent.click(
      await screen.findByRole('button', { name: 'New label' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Create a new label' })
    expect(
      within(dialog).getByRole('button', { name: 'Label color: Purple' })
    ).toBeVisible()
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Label name' }),
      'Travel'
    )
    await userEvent.click(within(dialog).getByTestId('label-save-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You successfully created the Travel label'
    )
    expect(fake.labels()).toContainEqual(
      expect.objectContaining({ displayName: 'Travel', color: '#7E57E3' })
    )
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
      within(await openColors(dialog)).getByRole('radio', {
        name: 'Custom color (hexadecimal)'
      })
    )
    const hex = await within(dialog).findByRole('textbox', {
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

    const colors = await openColors(dialog)
    expect(
      within(colors).getByRole('radio', { name: 'Navy blue' })
    ).toBeChecked()
    expect(
      within(colors).getByRole('radio', { name: 'Purple' })
    ).not.toBeChecked()
    await userEvent.keyboard('{ArrowRight}')
    expect(within(colors).getByRole('radio', { name: 'Purple' })).toBeChecked()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBe(null)
    })
    expect(
      within(dialog).getByRole('button', { name: 'Label color: Purple' })
    ).toHaveFocus()
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
    const plain = screen.getByRole('dialog', { name: 'Edit label' })
    expect(
      within(await openColors(plain)).getByRole('radio', { name: 'No color' })
    ).toBeChecked()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBe(null)
    })
    await userEvent.click(screen.getByTestId('label-cancel-button'))

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions on Blue' })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit label' })
    const colors = await openColors(dialog)
    expect(within(colors).queryByRole('radio', { name: 'No color' })).toBe(null)
    expect(
      within(colors).getByRole('radio', { name: 'Custom color (hexadecimal)' })
    ).toBeChecked()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBe(null)
    })
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

  it.each([
    ['a phone', 390],
    ['a tablet', 820]
  ])(
    'opens the menu of a label on %s from the row, which has no ⋮',
    async (_, width) => {
      mockViewport({ width, touch: true })
      setup()

      const link = await screen.findByRole('link', { name: 'Work' })
      expect(screen.queryByRole('button', { name: 'Actions on Work' })).toBe(
        null
      )
      expect(link).toHaveAttribute('aria-haspopup', 'menu')
      expect(link).toHaveAccessibleDescription('Long press for actions')
      link.focus()
      await userEvent.keyboard('{Shift>}{F10}{/Shift}')

      expect(
        await screen.findByRole('menu', { name: 'Actions on Work' })
      ).toBeVisible()
    }
  )

  it('is hidden when the user turned labels off', async () => {
    window.localStorage.setItem('twake-mail.preferences.labels', 'false')
    setup()

    await waitFor(() => {
      expect(screen.queryByTestId('labels-section')).toBe(null)
    })
  })
})
