import { screen } from '@testing-library/react'

import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import {
  bridge,
  octetsQuota,
  renderWithPaywall,
  type PaywallScenario
} from '@common/testing/renderWithPaywall'

import { QuotaBanner } from './QuotaBanner'
import { QuotaIndicator } from './QuotaIndicator'
import { StorageSettings } from './StorageSettings'

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({
    isInIframe: () => bridge.isInIframe()
  }))
}))

const PAYWALL = 'https://acme.twake.example.com/settings/premium'
const NEARLY_FULL = [octetsQuota(9_500_000, 10_000_000, 9_000_000)]
const FULL = [octetsQuota(10_000_000, 10_000_000, 9_000_000)]
const ROOMY = [octetsQuota(1_000_000, 10_000_000, 9_000_000)]

function storageSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'storage')
  if (!section) throw new Error('No Storage section')
  return section
}

const NOT_UPGRADABLE: [string, PaywallScenario][] = [
  ['outside of the Workplace', { isInsideWorkplace: false }],
  ['without the SaaS capability', { saas: null }],
  ['on the highest subscription', { saas: { isPaying: true } }]
]

describe('the quota banner', () => {
  it('links to the paywall when the storage can be upgraded', async () => {
    renderWithPaywall(<QuotaBanner />, { quotas: NEARLY_FULL })

    const banner = await screen.findByTestId('quota-banner')
    expect(banner).toHaveTextContent('You are running low on storage (90%)')
    expect(banner).toHaveTextContent('cleaning up or upgrading your storage')
    expect(screen.getByTestId('quota-banner-upgrade-link')).toHaveAttribute(
      'href',
      PAYWALL
    )
    expect(screen.getByTestId('quota-banner-upgrade-link')).toHaveTextContent(
      'Manage my storage'
    )
  })

  it('says when the storage is full', async () => {
    renderWithPaywall(<QuotaBanner />, { quotas: FULL })

    expect(await screen.findByTestId('quota-banner')).toHaveTextContent(
      'You have run out of storage space'
    )
    expect(screen.getByTestId('quota-banner-upgrade-link')).toBeInTheDocument()
  })

  it.each(NOT_UPGRADABLE)(
    'only advises to clean up %s',
    async (_n, scenario) => {
      renderWithPaywall(<QuotaBanner />, { quotas: NEARLY_FULL, ...scenario })

      const banner = await screen.findByTestId('quota-banner')
      expect(banner).toHaveTextContent('please consider cleaning up.')
      expect(banner).not.toHaveTextContent('upgrading')
      expect(screen.queryByTestId('quota-banner-upgrade-link')).toBeNull()
    }
  )
})

describe('the storage indicator of the sidebar', () => {
  it('shows what is left and the way to increase the space', async () => {
    renderWithPaywall(<QuotaIndicator />, { quotas: NEARLY_FULL })

    expect(await screen.findByTestId('quota-text')).toHaveTextContent(
      '500 kB available'
    )
    expect(
      screen.getByRole('progressbar', { name: 'Storage' })
    ).toHaveAttribute('aria-valuetext', '9.5 MB of 10 MB Used')
    expect(screen.getByTestId('quota-upgrade-link')).toHaveAttribute(
      'href',
      PAYWALL
    )
  })

  it('names its refresh after the storage, apart from the list refresh', async () => {
    renderWithPaywall(<QuotaIndicator />, { quotas: NEARLY_FULL })

    const refresh = await screen.findByTestId('quota-refresh-button')
    expect(refresh).toHaveAccessibleName('Refresh storage')
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBe(null)
  })

  it.each(NOT_UPGRADABLE)('has no link %s', async (_n, scenario) => {
    renderWithPaywall(<QuotaIndicator />, { quotas: NEARLY_FULL, ...scenario })

    await screen.findByTestId('quota-text')
    expect(screen.queryByTestId('quota-upgrade-link')).toBeNull()
  })
})

describe('Settings > Storage', () => {
  it('offers the upgrade, with a warning when the storage is almost full', async () => {
    renderWithPaywall(<StorageSettings section={storageSection()} />, {
      quotas: NEARLY_FULL
    })

    const storage = await screen.findByTestId('storage-settings')
    expect(storage).toHaveTextContent('The storage is almost full')
    expect(screen.getByTestId('storage-upgrade-button')).toHaveAttribute(
      'href',
      PAYWALL
    )
    expect(screen.getByTestId('storage-upgrade-button')).toHaveTextContent(
      'Upgrade storage'
    )
  })

  it('offers the upgrade without a warning while there is room', async () => {
    renderWithPaywall(<StorageSettings section={storageSection()} />, {
      quotas: ROOMY
    })

    const storage = await screen.findByTestId('storage-settings')
    expect(storage).not.toHaveTextContent('almost full')
    expect(screen.getByTestId('storage-upgrade-button')).toBeInTheDocument()
  })

  it.each(NOT_UPGRADABLE)('has no button %s', async (_n, scenario) => {
    renderWithPaywall(<StorageSettings section={storageSection()} />, {
      quotas: NEARLY_FULL,
      ...scenario
    })

    expect(await screen.findByTestId('storage-settings')).toHaveTextContent(
      'The storage is almost full'
    )
    expect(screen.queryByTestId('storage-upgrade-button')).toBeNull()
  })
})
