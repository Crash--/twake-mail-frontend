import { useQuery } from '@tanstack/react-query'

import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { assistantInstalledQueryOptions } from './queries'

const NO_PLATFORM = { getAppURL: (): Promise<null> => Promise.resolve(null) }

export function useIsAssistantInstalled(): boolean {
  const sdk = usePlatformSdk()
  const isPlatformReady = usePlatformStatus() === 'ready'
  const { accountId } = useJmapSession()
  const { data } = useQuery({
    ...assistantInstalledQueryOptions(sdk ?? NO_PLATFORM, accountId),
    enabled: sdk !== null && isPlatformReady
  })
  return data === true
}
