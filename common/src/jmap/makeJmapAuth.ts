import type { AuthOptions } from 'jmap-client-ts'

import type { AuthServiceBase } from '@common/features/auth/types'

export class NotAuthenticatedError extends Error {
  constructor() {
    super('No credentials to authenticate the JMAP request')
    this.name = 'NotAuthenticatedError'
  }
}

/**
 * Adapts the authentication service of the app to the `auth` option of the
 * JMAP client: Bearer or Basic header, and renewal on 401.
 */
export function makeJmapAuth(
  service: Pick<AuthServiceBase, 'getAuthorizationHeader' | 'onUnauthorized'>
): Required<AuthOptions> {
  return {
    getAuthorizationHeader: async () => {
      const header = await service.getAuthorizationHeader()
      if (header === null) throw new NotAuthenticatedError()
      return header
    },
    onUnauthorized: () => service.onUnauthorized()
  }
}
