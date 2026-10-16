import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ComposerProvider } from '@common/features/composer/ComposerProvider'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { LinkifiedText } from './LinkifiedText'

describe('LinkifiedText (tf#2072)', () => {
  it('links web addresses, www. hosts and email addresses as an email body does', async () => {
    renderWithProviders(
      <ComposerProvider>
        <p data-testid="text">
          <LinkifiedText
            text={
              'Room 42, see www.example.org\nAgenda: https://docs.example.com/sync\nQuestions: bob@example.com'
            }
          />
        </p>
      </ComposerProvider>,
      { withJmapSession: true }
    )
    const text = await screen.findByTestId('text')

    expect(text).toHaveTextContent(
      'Room 42, see www.example.orgAgenda: https://docs.example.com/syncQuestions: bob@example.com'
    )
    const site = within(text).getByRole('link', { name: 'www.example.org' })
    expect(site).toHaveAttribute('href', 'https://www.example.org/')
    expect(site).toHaveAttribute('target', '_blank')
    expect(
      within(text).getByRole('link', { name: 'https://docs.example.com/sync' })
    ).toHaveAttribute('rel', 'noopener noreferrer')

    const address = within(text).getByRole('link', { name: 'bob@example.com' })
    expect(address).toHaveAttribute('href', 'mailto:bob@example.com')
    await userEvent.click(address)
    const composer = await screen.findByRole('dialog', { name: 'New message' })
    expect(
      await within(composer).findByRole('button', { name: /bob@example.com/ })
    ).toBeVisible()
  })
})
