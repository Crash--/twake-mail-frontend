import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { makeEmail, makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeLabels
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailLabels } from './EmailLabels'
import { LabelActionsProvider } from './LabelActionsProvider'
import { LabelList } from './LabelList'

const WORK = {
  id: 'l1',
  displayName: 'Work',
  keyword: 'work',
  color: null
}

describe('LabelList', () => {
  it('drops an email once the label is taken off it', async () => {
    const tagged = makeEmail({
      id: 'a',
      subject: 'Tagged',
      keywords: { work: true }
    })
    const server = makeFakeJmapServer({
      emails: [tagged],
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeLabels(server, [WORK])
    renderWithProviders(
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 10_000, itemHeight: 56 }}
      >
        <LabelActionsProvider>
          <LabelList label={WORK} />
          <EmailLabels emails={[tagged]} mailboxId={null} />
        </LabelActionsProvider>
      </VirtuosoMockContext.Provider>,
      {
        route: '/label/l1',
        path: '/label/:labelId/*',
        withJmapSession: true,
        jmapServer: server
      }
    )
    expect(await screen.findByText('Tagged')).toBeVisible()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove the label Work' })
    )

    await waitFor(() => {
      expect(screen.queryByText('Tagged')).toBe(null)
    })
    expect(server.emails[0]?.keywords).toEqual({})
  })
})
