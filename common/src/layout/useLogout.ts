import { useCallback } from 'react'

import { useAuthService } from '@common/features/auth/AuthProvider'
import { useComposer } from '@common/features/composer/ComposerProvider'

/**
 * Signs out, from the account menu of the app or of the platform bar.
 * Signing out forgets the composers kept in the browser: the changes the
 * server does not have are saved first (one draft each).
 */
export function useLogout(): () => void {
  const service = useAuthService()
  const { saveUnsaved } = useComposer()

  return useCallback(() => {
    saveUnsaved()
      .then(() => service.logout())
      .catch((error: unknown) => {
        console.error('[auth] Logout failed', error)
      })
  }, [saveUnsaved, service])
}
