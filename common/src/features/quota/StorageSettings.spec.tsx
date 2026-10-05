import { screen } from '@testing-library/react'

import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { StorageSettings } from './StorageSettings'

function storageSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'storage')
  if (!section) throw new Error('No Storage section')
  return section
}

function renderWithQuotas(list: unknown[]): void {
  const server = makeFakeJmapServer({
    capabilities: { 'urn:ietf:params:jmap:quota': {} }
  })
  server.handlers.set('Quota/get', () => ({
    accountId: 'account-alice',
    state: 'q1',
    list,
    notFound: []
  }))
  renderWithProviders(<StorageSettings section={storageSection()} />, {
    jmapServer: server,
    withJmapSession: true
  })
}

describe('StorageSettings', () => {
  it('shows the space used and left', async () => {
    renderWithQuotas([
      {
        id: 'q',
        resourceType: 'octets',
        scope: 'account',
        name: 'alice',
        types: ['Mail'],
        used: 2_000_000,
        hardLimit: 10_000_000
      }
    ])

    const storage = await screen.findByTestId('storage-settings')
    expect(storage).toHaveTextContent('2 MB of 10 MB used')
    expect(storage).toHaveTextContent('Available: 8 MB')
  })

  it('says when the account has no limit', async () => {
    renderWithQuotas([])

    expect(await screen.findByTestId('storage-unlimited')).toHaveTextContent(
      'No storage limit for this account'
    )
  })
})
