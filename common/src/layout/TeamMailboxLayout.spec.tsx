import { fireEvent, screen, within } from '@testing-library/react'
import { Route } from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { TeamMailboxEmbedProvider } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { TeamMailboxLayout } from './TeamMailboxLayout'

describe('TeamMailboxLayout on a phone', () => {
  beforeEach(() => {
    mockViewport({ width: 390, touch: true })
  })
  afterEach(resetViewport)

  it('folds the floating button while the user scrolls the main content, not the page', async () => {
    renderWithProviders(
      <TeamMailboxEmbedProvider rootId="team">
        <TeamMailboxLayout />
      </TeamMailboxEmbedProvider>,
      {
        path: '/',
        withJmapSession: true,
        jmapServer: makeFakeJmapServer({
          mailboxes: [
            ...makeDefaultMailboxes(),
            ...makeTeamMailboxes({ id: 'team' })
          ]
        }),
        childRoutes: <Route index element={<p>Folder content</p>} />
      }
    )
    const content = await screen.findByText('Folder content')
    const button = await screen.findByTestId('compose-email-button')
    const label = within(button).getByText(
      button.getAttribute('aria-label') ?? ''
    ).parentElement

    fireEvent.wheel(document)
    fireEvent.scroll(document)
    expect(label).toHaveStyle({ gridTemplateColumns: '1fr' })

    fireEvent.wheel(content)
    fireEvent.scroll(content)
    expect(label).toHaveStyle({ gridTemplateColumns: '0fr' })
  })
})
