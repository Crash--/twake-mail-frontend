import { Typography } from '@linagora/twake-mui'
import { useMemo, type ReactElement } from 'react'

import { SidePanel } from '@/ds/SidePanel/SidePanel'
import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { useI18n } from '@common/i18n/useI18n'

import type { CapabilityCall } from './assistant'
import { useAssistantPanel } from './AssistantProvider'
import { toCapabilities } from './assistantTools'
import { useAssistantIntent } from './useAssistantIntent'
import { useAssistantTools } from './useAssistantTools'

function logCall(call: CapabilityCall): void {
  console.info('[assistant] capability call', call)
}

/**
 * The Twake Assistant beside the mail, through the Assistant intent of the
 * platform
 */
export function AssistantPanel(): ReactElement {
  const { t } = useI18n()
  const { close } = useAssistantPanel()
  const sdk = usePlatformSdk()
  const isPlatformReady = usePlatformStatus() === 'ready'
  const tools = useAssistantTools()
  const capabilities = useMemo(
    () => (tools.isPending ? null : toCapabilities(tools.data ?? [])),
    [tools.isPending, tools.data]
  )
  const { state, frameRef } = useAssistantIntent(
    isPlatformReady ? sdk : null,
    true,
    capabilities,
    { onCall: logCall, onCancel: close }
  )

  const hasFailed = state.status === 'failed' || state.status === 'closed'
  return (
    <SidePanel
      label={t('assistant.panel')}
      src={state.status === 'open' ? state.service.href : null}
      frameTitle={t('assistant.frameTitle')}
      isReady={state.status === 'open' && state.isReady}
      loadingLabel={t('assistant.loading')}
      onClose={close}
      closeLabel={t('common.close')}
      message={
        hasFailed ? <Typography>{t('assistant.error')}</Typography> : undefined
      }
      frameRef={frameRef}
      allow="clipboard-write"
      data-testid="assistant-panel"
      frameTestId="assistant-frame"
    />
  )
}
