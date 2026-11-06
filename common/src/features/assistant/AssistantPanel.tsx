import { Typography, useColorScheme } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SidePanel } from '@/ds/SidePanel/SidePanel'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { useI18n } from '@common/i18n/useI18n'

import type {
  AssistantConfig,
  CapabilityCall,
  CapabilityResult
} from './assistant'
import { createdDraftId, toCapabilityResult } from './assistantTools'
import { toCapability } from './capabilities'
import { useAssistantPanel } from './AssistantProvider'
import { useAssistantIntent } from './useAssistantIntent'
import { useAssistantTools } from './useAssistantTools'
import { useRunAssistantTool } from './useRunAssistantTool'

export function AssistantPanel(): ReactElement {
  const { t } = useI18n()
  const { close } = useAssistantPanel()
  const sdk = usePlatformSdk()
  const isPlatformReady = usePlatformStatus() === 'ready'
  const tools = useAssistantTools()
  const { colorScheme = 'light' } = useColorScheme()
  const config: AssistantConfig | null = tools.isPending
    ? null
    : {
        capabilities: (tools.data ?? []).map(tool => toCapability(tool, t)),
        capabilityResults: true,
        theme: { type: colorScheme }
      }
  const runTool = useRunAssistantTool()
  const { openComposer } = useComposer()
  const { notify } = useNotify()

  // The result goes back to the LLM, which tells the user when the tool
  // failed: a call without an id has no result, the app tells it then
  const handleCall = async (
    call: CapabilityCall
  ): Promise<CapabilityResult | null> => {
    const outcome = await runTool(call).catch(() => ({
      ok: false as const,
      status: null
    }))
    if (!outcome.ok && call.callId === null) {
      notify({ message: t('assistant.toolFailed'), severity: 'error' })
    }
    const draftId =
      outcome.ok && call.capability === 'create_draft'
        ? createdDraftId(outcome.content)
        : null
    if (draftId !== null) openComposer({ draftId })
    return call.callId === null
      ? null
      : toCapabilityResult(call.callId, outcome)
  }
  const { state, frameRef } = useAssistantIntent(
    isPlatformReady ? sdk : null,
    config,
    { onCall: handleCall, onCancel: close }
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
