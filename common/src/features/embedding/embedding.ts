import { CozyBridge } from 'cozy-external-bridge'
import { useMemo } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'

/**
 * The app is shown inside Twake Workplace: `WORKPLACE_EMBEDDING` is on and
 * the app runs in an iframe (cozy-external-bridge, as Twake Calendar's
 * `EmbeddingContext`). The container then holds the logotype and the app
 * grid.
 */
export function useIsEmbedded(): boolean {
  const config = useAppConfig()
  const isEnabled = config?.workplaceEmbedding === true
  return useMemo(() => isEnabled && new CozyBridge().isInIframe(), [isEnabled])
}
