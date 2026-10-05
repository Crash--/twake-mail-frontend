import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useParams } from 'react-router'

import { FolderActionsProvider } from '@common/features/mailboxActions/FolderActionsProvider'
import type { SupportedLanguage } from '@common/i18n/languages'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { MailboxPickerProvider } from './MailboxPickerProvider'
import { MailboxTree } from './MailboxTree'

const TEAM = 'TeamMailbox[team@example.com]'

function Screen(): ReactElement {
  return (
    <MailboxPickerProvider>
      <FolderActionsProvider>
        <MailboxTree />
        <Outlet />
      </FolderActionsProvider>
    </MailboxPickerProvider>
  )
}

function OpenFolder(): ReactElement {
  const { mailboxId } = useParams()
  return <p>Open folder {mailboxId}</p>
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'work', name: 'Work' }),
      makeMailbox({ id: 'clients', name: 'Clients', parentId: 'work' }),
      makeMailbox({ id: 'acme', name: 'ACME', parentId: 'clients' }),
      makeMailbox({ id: 'taxes', name: 'Impôts', isSubscribed: false }),
      makeMailbox({
        id: 'old',
        name: 'Old clients',
        parentId: 'taxes',
        isSubscribed: false
      }),
      makeMailbox({ id: 'team', name: 'Clients team', namespace: TEAM }),
      makeMailbox({
        id: 'team-inbox',
        name: 'Clients INBOX',
        parentId: 'team',
        namespace: TEAM
      })
    ]
  })
}

async function renderSidebar(
  server = makeServer(),
  lang: SupportedLanguage = 'en'
): Promise<FakeJmapServer> {
  renderWithProviders(<Screen />, {
    route: '/mailbox/mailbox-inbox',
    path: '/',
    withJmapSession: true,
    jmapServer: server,
    lang,
    childRoutes: <Route path="mailbox/:mailboxId" element={<OpenFolder />} />
  })
  await screen.findAllByTestId('mailbox-item')
  return server
}

function magnifier(): HTMLElement {
  return screen.getByRole('button', { name: 'Search for folders' })
}

function field(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Search for folders' })
}

function status(): HTMLElement {
  return screen.getByTestId('mailbox-search-status')
}

function results(): string[] {
  return screen
    .queryAllByTestId('mailbox-item-name')
    .map(name => name.textContent)
}

function result(name: string): HTMLElement {
  const found = screen
    .getAllByTestId('mailbox-item')
    .find(
      item => within(item).getByTestId('mailbox-item-name').textContent === name
    )
  if (!found) throw new Error(`No result ${name}`)
  return found
}

describe('Folder search of the sidebar', () => {
  it('opens a named field with the focus in it, in place of the trees', async () => {
    await renderSidebar()

    expect(magnifier()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(magnifier())

    expect(magnifier()).toHaveAttribute('aria-expanded', 'true')
    expect(field()).toHaveFocus()
    expect(screen.getByRole('search')).toBeVisible()
    expect(magnifier()).toHaveAttribute(
      'aria-controls',
      screen.getByRole('search').id
    )
    expect(screen.queryByTestId('mailbox-tree')).toBe(null)
    expect(results()).toEqual([])
  })

  it('finds nothing without a query', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())

    expect(screen.queryByTestId('mailbox-item')).toBe(null)
    expect(status()).toHaveTextContent('')
  })

  it('lists the folders at any depth, the user first and the team mailboxes after, with their path', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())

    await userEvent.type(field(), 'client')

    expect(results()).toEqual([
      'Old clients',
      'Clients',
      'Clients team',
      'Clients INBOX'
    ])
    expect(within(result('Clients')).getByText('Work/Clients')).toBeVisible()
    // The root of a team mailbox says whose it is, its folders their path
    expect(
      within(result('Clients team')).getByText('team@example.com')
    ).toBeVisible()
    expect(
      within(result('Clients INBOX')).getByText('Clients team/Clients INBOX')
    ).toBeVisible()
  })

  it('ignores case and accents, and wants every word', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())

    await userEvent.type(field(), 'IMPOTS')
    expect(results()).toEqual(['Impôts'])

    await userEvent.clear(field())
    await userEvent.type(field(), 'old cli')
    expect(results()).toEqual(['Old clients'])

    await userEvent.clear(field())
    await userEvent.type(field(), 'cli old')
    expect(results()).toEqual(['Old clients'])
  })

  it('searches the translated name of the system folders', async () => {
    await renderSidebar(makeServer(), 'fr')
    await userEvent.click(
      screen.getByRole('button', { name: 'Rechercher des dossiers' })
    )

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Rechercher des dossiers' }),
      'corbeille'
    )

    expect(results()).toEqual(['Corbeille'])
  })

  it('announces how many folders were found, and when none was', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())

    await userEvent.type(field(), 'Impôts')
    expect(status()).toHaveTextContent('1 folder found')

    await userEvent.clear(field())
    await userEvent.type(field(), 'client')
    expect(status()).toHaveTextContent('4 folders found')
    expect(screen.getByRole('tree', { name: '4 folders found' })).toBeVisible()

    await userEvent.type(field(), 'zzz')
    expect(status()).toHaveTextContent('No folder matches your search')
    expect(screen.queryByTestId('mailbox-item')).toBe(null)
  })

  it('lists the hidden folders, said hidden, with the menu to show them again', async () => {
    const server = await renderSidebar()
    await userEvent.click(magnifier())
    await userEvent.type(field(), 'Impôts')

    expect(
      within(result('Impôts')).getByTestId('mailbox-item-hidden')
    ).toHaveTextContent('hidden')

    await userEvent.click(
      within(result('Impôts')).getByRole('button', {
        name: 'Actions on Impôts'
      })
    )
    await userEvent.click(
      within(screen.getByRole('menu', { name: 'Folder actions' })).getByRole(
        'menuitem',
        { name: 'Show folder' }
      )
    )

    await waitFor(() => {
      expect(
        server.mailboxes.find(({ id }) => id === 'taxes')?.isSubscribed
      ).toBe(true)
    })
    await waitFor(() => {
      expect(screen.queryByTestId('mailbox-item-hidden')).toBe(null)
    })
    expect(field()).toBeVisible()
  })

  it('opens a folder from its link, and keeps the search open', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())
    await userEvent.type(field(), 'acme')

    await userEvent.click(within(result('ACME')).getByRole('link'))

    expect(screen.getByText('Open folder acme')).toBeVisible()
    expect(result('ACME')).toHaveAttribute('aria-current', 'page')
    expect(field()).toBeVisible()
  })

  it('opens the first folder found with Enter', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())

    await userEvent.type(field(), 'acm{Enter}')

    expect(screen.getByText('Open folder acme')).toBeVisible()
  })

  it('goes down to the results with ArrowDown, and on with Tab', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())
    await userEvent.type(field(), 'client')

    await userEvent.keyboard('{ArrowDown}')

    expect(within(result('Old clients')).getByRole('link')).toHaveFocus()
    await userEvent.tab()
    expect(
      within(result('Old clients')).getByRole('button', {
        name: 'Actions on Old clients'
      })
    ).toHaveFocus()
  })

  it('clears the query with its button, and keeps the focus in the field', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())
    await userEvent.type(field(), 'client')

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(field()).toHaveValue('')
    expect(field()).toHaveFocus()
    expect(results()).toEqual([])
  })

  it('closes with Escape from the field, giving the focus back to the magnifier', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())
    await userEvent.type(field(), 'client')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('search')).toBe(null)
    expect(screen.getByTestId('mailbox-tree')).toBeVisible()
    expect(magnifier()).toHaveAttribute('aria-expanded', 'false')
    expect(magnifier()).toHaveFocus()
  })

  it('closes with Escape from a result too', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())
    await userEvent.type(field(), 'client')
    await userEvent.keyboard('{ArrowDown}')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('search')).toBe(null)
    expect(magnifier()).toHaveFocus()
  })

  it('closes with the magnifier, and starts again from an empty field', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())
    await userEvent.type(field(), 'client')

    await userEvent.click(magnifier())
    expect(screen.queryByRole('search')).toBe(null)

    await userEvent.click(magnifier())
    expect(field()).toHaveValue('')
  })

  it('links to Settings > Folder visibility', async () => {
    await renderSidebar()
    await userEvent.click(magnifier())

    expect(
      screen.getByRole('link', { name: 'Folder visibility' })
    ).toHaveAttribute('href', '/settings/folder-visibility')
  })
})
