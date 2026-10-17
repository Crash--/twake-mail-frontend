import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import {
  MailboxPickerProvider,
  PICKED_ROOT,
  usePickMailbox
} from './MailboxPickerProvider'

function Picker(): ReactElement {
  const pickMailbox = usePickMailbox()
  const [picked, setPicked] = useState('nothing')
  return (
    <>
      <button
        type="button"
        onClick={() => {
          pickMailbox({ canCreateFolder: true, requireAddItems: true })
            .then(mailbox => {
              setPicked(
                mailbox === null || mailbox === PICKED_ROOT
                  ? 'none'
                  : mailbox.id
              )
            })
            .catch(() => undefined)
        }}
      >
        Pick
      </button>
      <p>Picked {picked}</p>
    </>
  )
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'work', name: 'Work' })
    ]
  })
}

async function openPicker(server: FakeJmapServer): Promise<HTMLElement> {
  renderWithProviders(
    <MailboxPickerProvider>
      <Picker />
    </MailboxPickerProvider>,
    { withJmapSession: true, jmapServer: server }
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Pick' }))
  const picker = screen.getByRole('dialog', { name: 'Move To' })
  await within(picker).findByRole('option', { name: 'Work' })
  return picker
}

describe('MailboxPickerProvider', () => {
  it('picks the folder created from its "New folder" button', async () => {
    const server = makeServer()
    const picker = await openPicker(server)

    await userEvent.click(
      within(picker).getByRole('button', { name: 'New folder' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Create a New Folder' })
    const field = within(dialog).getByRole('textbox', { name: 'Folder Name' })
    await userEvent.type(field, 'work')
    expect(field).toHaveAccessibleDescription(
      'This folder name is already taken'
    )
    await userEvent.clear(field)
    await userEvent.type(field, 'Projects{Enter}')

    expect(await screen.findByText('Picked mailbox-created-1')).toBeVisible()
    expect(
      server.mailboxes.find(mailbox => mailbox.id === 'mailbox-created-1')
    ).toMatchObject({ name: 'Projects', parentId: null, isSubscribed: true })
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('creates it where the location says, keeping the name typed', async () => {
    const server = makeServer()
    const picker = await openPicker(server)

    await userEvent.click(
      within(picker).getByRole('button', { name: 'New folder' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Create a New Folder' })
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Folder Name' }),
      'Clients'
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'All folders' })
    )
    await userEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Select parent folder' })
      ).getByRole('option', { name: 'Work' })
    )
    // Once the picker went
    expect(
      await within(dialog).findByRole('button', { name: 'Work' })
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Create folder' })
    )

    expect(await screen.findByText('Picked mailbox-created-1')).toBeVisible()
    expect(
      server.mailboxes.find(mailbox => mailbox.id === 'mailbox-created-1')
    ).toMatchObject({ name: 'Clients', parentId: 'work' })
  })

  it('goes back to the folders when the creation is cancelled', async () => {
    const server = makeServer()
    const picker = await openPicker(server)

    await userEvent.click(
      within(picker).getByRole('button', { name: 'New folder' })
    )
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Create a New Folder' })
      ).getByRole('button', { name: 'Cancel' })
    )

    const back = await screen.findByRole('dialog', { name: 'Move To' })
    await userEvent.click(within(back).getByRole('option', { name: 'Work' }))
    expect(await screen.findByText('Picked work')).toBeVisible()
    await waitFor(() => {
      expect(server.mailboxes).toHaveLength(makeServer().mailboxes.length)
    })
  })
})
