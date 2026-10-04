import type { AppConfig } from '@common/config/config'

import { createBasicAuthService } from './basicAuth'
import { createOidcAuthService } from './oidcAuth'
import type { AuthService } from './types'

/**
 * The authentication service of the configured mode.
 */
export function createAuthService(config: AppConfig): AuthService {
  if (config.authMode === 'basic') {
    return createBasicAuthService({ jmapSessionUrl: config.jmapSessionUrl })
  }
  if (!config.oidc) {
    throw new Error('OIDC mode without OIDC configuration')
  }
  return createOidcAuthService(config.oidc)
}
