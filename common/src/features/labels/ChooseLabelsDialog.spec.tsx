import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeLabels
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { ChooseLabelsDialog } from './ChooseLabelsDialog'

const EMAIL = {
  id: 'e1',
  mailboxIds: { 'mailbox-inbox': true as const },
  keywords: { work: true as const }
}

describe('ChooseLabelsDialog', () => {
  it('checks the labels of the emails and returns what changed', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeLabels(server, [
      { id: 'work', displayName: 'Work', keyword: 'work', color: null },
      { id: 'home', displayName: 'Home', keyword: 'home', color: null }
    ])
    const onApply = jest.fn()
    renderWithProviders(
      <ChooseLabelsDialog
        emails={[EMAIL]}
        onApply={onApply}
        onClose={jest.fn()}
      />,
      { jmapServer: server, withJmapSession: true }
    )

    const dialog = await screen.findByRole('dialog', { name: 'Choose label' })
    expect(
      await within(dialog).findByRole('checkbox', { name: 'Work' })
    ).toBeChecked()
    expect(
      within(dialog).getByTestId('choose-label-apply-button')
    ).toBeDisabled()
    await userEvent.click(
      within(dialog).getByRole('checkbox', { name: 'Work' })
    )
    await userEvent.click(
      within(dialog).getByRole('checkbox', { name: 'Home' })
    )
    await userEvent.click(
      within(dialog).getByTestId('choose-label-apply-button')
    )

    expect(onApply).toHaveBeenCalledWith({
      added: [expect.objectContaining({ id: 'home' })],
      removed: [expect.objectContaining({ id: 'work' })]
    })
  })

  it('invites to create a first label', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeLabels(server, [])
    renderWithProviders(
      <ChooseLabelsDialog
        emails={[EMAIL]}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
      { jmapServer: server, withJmapSession: true }
    )

    expect(await screen.findByTestId('choose-label-empty')).toHaveTextContent(
      'No Labels yet'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create a label' })
    )
    expect(
      screen.getByRole('dialog', { name: 'Create a new label' })
    ).toBeVisible()
  })
})
