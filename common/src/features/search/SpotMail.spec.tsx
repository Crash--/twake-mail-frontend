import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { useLocation } from 'react-router'

import {
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { SpotMail } from './SpotMail'

function Location(): ReactElement {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{`${pathname}${search}`}</p>
}

async function renderSpotMail(
  extra: ReactElement | null = null
): Promise<void> {
  renderWithProviders(
    <>
      <button type="button">Elsewhere</button>
      <SpotMail />
      <Location />
      {extra}
    </>,
    {
      route: '/mailbox/mailbox-inbox',
      path: '*',
      withJmapSession: true,
      jmapServer: makeFakeJmapServer({
        mailboxes: [
          ...makeDefaultMailboxes(),
          ...makeTeamMailboxes({ id: 'sales', address: 'sales@example.com' })
        ],
        emails: [makeEmail({ id: 'report', subject: 'Quarterly report' })]
      })
    }
  )
  // Past the loading of the JMAP session
  await screen.findByRole('button', { name: 'Elsewhere' })
}

async function openSpotMail(): Promise<HTMLElement> {
  await userEvent.keyboard('{Control>}k{/Control}')
  const dialog = await screen.findByRole('dialog', { name: 'SpotMail' })
  await waitFor(() => {
    expect(
      within(dialog).getByRole('combobox', { name: 'Search emails' })
    ).toHaveFocus()
  })
  return dialog
}

function location(): string {
  return screen.getByTestId('location').textContent
}

describe('SpotMail', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('goes to a team mailbox found by its name, shown with its address', async () => {
    await renderSpotMail()
    const dialog = await openSpotMail()

    await userEvent.keyboard('sales')
    const folders = await within(dialog).findByRole('group', {
      name: 'Folders'
    })
    await userEvent.click(
      await within(folders).findByRole('option', {
        name: 'sales sales@example.com'
      })
    )

    await waitFor(() => {
      expect(location()).toBe('/mailbox/sales')
    })
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('opens an email the search finds, among its results', async () => {
    await renderSpotMail()
    const dialog = await openSpotMail()

    await userEvent.keyboard('quarterly')
    const emails = await within(dialog).findByRole('group', {
      name: 'Messages'
    })
    await userEvent.click(await within(emails).findByRole('option'))

    await waitFor(() => {
      expect(location()).toMatch(/^\/search\/email\/report\?/)
    })
  })

  it('shows every result of the text on Enter', async () => {
    await renderSpotMail()
    await openSpotMail()

    await userEvent.keyboard('quarterly{Enter}')

    await waitFor(() => {
      expect(location()).toMatch(/^\/search\?.*quarterly/)
    })
  })

  it('closes on Ctrl+K again and on Escape, the focus back where it was', async () => {
    await renderSpotMail()
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()

    await openSpotMail()
    await userEvent.keyboard('{Control>}k{/Control}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(elsewhere).toHaveFocus()

    await openSpotMail()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
  })

  it('leaves Ctrl+K to what already handled it, as the editor of a message', async () => {
    await renderSpotMail(
      <input
        aria-label="Message"
        onKeyDown={event => {
          event.preventDefault()
        }}
      />
    )
    screen.getByRole('textbox', { name: 'Message' }).focus()

    await userEvent.keyboard('{Control>}k{/Control}')

    expect(screen.queryByRole('dialog', { name: 'SpotMail' })).toBe(null)
  })

  it('does not open over another modal dialog', async () => {
    await renderSpotMail(
      <div role="dialog" aria-modal="true" aria-label="Move to" />
    )

    await userEvent.keyboard('{Control>}k{/Control}')

    expect(screen.queryByRole('dialog', { name: 'SpotMail' })).toBe(null)
  })

  it('does not open from an open menu', async () => {
    await renderSpotMail(
      <ul role="menu" aria-label="Folder actions">
        <li role="menuitem" tabIndex={-1}>
          Rename
        </li>
      </ul>
    )
    screen.getByRole('menuitem', { name: 'Rename' }).focus()

    await userEvent.keyboard('{Control>}k{/Control}')

    expect(screen.queryByRole('dialog', { name: 'SpotMail' })).toBe(null)
  })

  it('opens with ⌘K on a Mac, where Ctrl+K belongs to the text', async () => {
    jest
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
    await renderSpotMail()

    await userEvent.keyboard('{Control>}k{/Control}')
    expect(screen.queryByRole('dialog', { name: 'SpotMail' })).toBe(null)

    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(
      await screen.findByRole('dialog', { name: 'SpotMail' })
    ).toBeInTheDocument()
  })
})
