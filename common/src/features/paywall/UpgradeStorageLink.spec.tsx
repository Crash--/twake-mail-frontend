import { act, screen } from '@testing-library/react'

import { bridge, renderWithPaywall } from '@common/testing/renderWithPaywall'

import { UpgradeStorageLink } from './UpgradeStorageLink'

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({
    isInIframe: () => bridge.isInIframe()
  }))
}))

const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('Not found', { status: 404 }))
  globalThis.fetch = fetchMock
})

/** Lets the queries answer, to check that nothing came out of them */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 100))
  })
}

function renderLink(
  scenario: Parameters<typeof renderWithPaywall>[1] = {}
): void {
  renderWithPaywall(
    <UpgradeStorageLink label="Upgrade storage" data-testid="upgrade" />,
    scenario
  )
}

describe('UpgradeStorageLink', () => {
  it('opens the paywall of the Workplace in a new tab, cut from the page', async () => {
    renderLink()

    const link = await screen.findByTestId('upgrade')
    expect(link).toHaveAttribute(
      'href',
      'https://acme.twake.example.com/settings/premium'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(link).toHaveAccessibleName('Upgrade storage (opens in a new tab)')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('takes the Workplace of the configuration for a user without claim', async () => {
    renderLink({
      workplaceFqdn: null,
      workplaceFqdnFallback: '{localpart}.twake.example.com'
    })

    expect(await screen.findByTestId('upgrade')).toHaveAttribute(
      'href',
      'https://alice.twake.example.com/settings/premium'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('takes the paywall template of the ecosystem when no Workplace is known', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          paywallUrlTemplate: 'https://pay.example.com/{localPart}/{domainName}'
        })
      )
    )
    renderLink({ workplaceFqdn: null })

    expect(await screen.findByTestId('upgrade')).toHaveAttribute(
      'href',
      'https://pay.example.com/alice/localhost'
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://jmap.example.com/.well-known/linagora-ecosystem',
      expect.objectContaining({ credentials: 'omit' })
    )
  })

  it('takes the Workplace fallback of the ecosystem', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ workplaceFqdnFallback: '{localPart}.twake.test.org' })
      )
    )
    renderLink({ workplaceFqdn: null })

    expect(await screen.findByTestId('upgrade')).toHaveAttribute(
      'href',
      'https://alice.twake.test.org/settings/premium'
    )
  })

  it.each([
    ['an HTTP template', 'http://pay.example.com/'],
    ['a JavaScript template', 'javascript:alert(1)'],
    ['credentials', 'https://user:pw@pay.example.com/']
  ])('shows nothing for a template with %s', async (_name, template) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ paywallUrlTemplate: template }))
    )
    renderLink({ workplaceFqdn: null })

    await settle()
    expect(fetchMock).toHaveBeenCalled()
    expect(screen.queryByTestId('upgrade')).toBeNull()
  })

  it('shows nothing when the ecosystem is unavailable', async () => {
    renderLink({ workplaceFqdn: null })

    await settle()
    expect(fetchMock).toHaveBeenCalled()
    expect(screen.queryByTestId('upgrade')).toBeNull()
  })

  it.each([
    ['outside of the Workplace', { isInsideWorkplace: false }],
    ['without the SaaS capability', { saas: null }],
    ['without the possibility to upgrade', { saas: { canUpgrade: false } }],
    [
      'on the highest subscription',
      { saas: { isPaying: true, canUpgrade: false } }
    ]
  ])('shows nothing %s, and asks nothing', async (_name, scenario) => {
    renderLink({ workplaceFqdn: null, ...scenario })

    await settle()
    expect(screen.queryByTestId('upgrade')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
