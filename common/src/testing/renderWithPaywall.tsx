import type { ReactElement } from 'react'

import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig } from '@common/config/config'
import { SAAS_CAPABILITY } from '@common/features/paywall/saasCapability'

import { makeFakeJmapServer } from './fakeJmapServer'
import { makeFakeOidcAuthService } from './makeFakeAuthService'
import {
  renderWithProviders,
  type RenderWithProvidersResult
} from './renderWithProviders'

/**
 * `cozy-external-bridge` answers `isInIframe` with this: specs that render
 * the paywall mock the module with it
 * (`jest.mock('cozy-external-bridge', () => ({ CozyBridge: ... }))`)
 */
export const bridge = { isInIframe: jest.fn<boolean, []>() }

export interface PaywallScenario {
  /** The SaaS capability of the account; none when null */
  saas?: { isPaying?: boolean; canUpgrade?: boolean } | null
  /** Inside an iframe of Twake Workplace (`WORKPLACE_EMBEDDING`) */
  isInsideWorkplace?: boolean
  /** The `workplaceFqdn` claim of the SSO */
  workplaceFqdn?: string | null
  /** `WORKPLACE_FQDN_FALLBACK` */
  workplaceFqdnFallback?: string
  /** Quotas answered by `Quota/get` */
  quotas?: unknown[]
}

/**
 * Renders a component of the mail screens as a user of the Twake platform
 * would see it, with the quota and the paywall inputs of the scenario
 */
export function renderWithPaywall(
  ui: ReactElement,
  {
    saas = { canUpgrade: true },
    isInsideWorkplace = true,
    workplaceFqdn = 'acme.twake.example.com',
    workplaceFqdnFallback,
    quotas = []
  }: PaywallScenario = {}
): RenderWithProvidersResult {
  bridge.isInIframe.mockReturnValue(isInsideWorkplace)
  const server = makeFakeJmapServer({
    capabilities: {
      'urn:ietf:params:jmap:quota': {},
      ...(saas === null ? {} : { [SAAS_CAPABILITY]: saas })
    }
  })
  server.handlers.set('Quota/get', () => ({
    accountId: 'account-alice',
    state: 'q1',
    list: quotas,
    notFound: []
  }))
  const config = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      WORKPLACE_EMBEDDING: true,
      ...(workplaceFqdnFallback === undefined
        ? {}
        : { WORKPLACE_FQDN_FALLBACK: workplaceFqdnFallback })
    },
    'https://mail.example.com'
  )
  if (!config.ok) throw new Error('Invalid configuration')
  return renderWithProviders(
    <AppConfigProvider config={config.value}>{ui}</AppConfigProvider>,
    {
      jmapServer: server,
      withJmapSession: true,
      authService: makeFakeOidcAuthService({
        status: 'authenticated',
        user: { email: 'alice@example.com', name: 'Alice', workplaceFqdn }
      })
    }
  )
}

/** A storage quota of the account, in octets */
export function octetsQuota(
  used: number,
  hardLimit: number,
  warnLimit?: number
): unknown {
  return {
    id: 'q',
    resourceType: 'octets',
    scope: 'account',
    name: 'alice',
    types: ['Mail'],
    used,
    hardLimit,
    ...(warnLimit === undefined ? {} : { warnLimit })
  }
}
