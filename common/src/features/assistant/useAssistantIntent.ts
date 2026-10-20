import type { Sdk } from '@linagora/twake-sdk'
import { useEffect, useRef, useState, type RefObject } from 'react'

import {
  ASSISTANT_INTENT,
  assistantService,
  parseAssistantMessage,
  type AssistantConfig,
  type AssistantService,
  type CapabilityCall
} from './assistant'
import type { AssistantCapability } from './assistantTools'

export type AssistantIntentState =
  | { status: 'closed' }
  | { status: 'opening' }
  | { status: 'open'; service: AssistantService; isReady: boolean }
  | { status: 'failed' }

export interface AssistantIntentHandlers {
  onCall: (call: CapabilityCall) => void
  onCancel: () => void
}

export interface AssistantIntent {
  state: AssistantIntentState
  frameRef: RefObject<HTMLIFrameElement | null>
}

/**Platform answer for the intent */
type Created = { ok: true; service: AssistantService } | { ok: false }

/**
 * The Assistant intent of the platform (`sdk.createIntent`), while
 * `isOpen` and once the capabilities are known (null while they load): its
 * frame says `ready`, gets the capabilities, then hands back the calls the
 * LLM picks. Only the messages of its frame are read: from the origin of
 * the intent, from its window, with its id. Closing drops the intent; a
 * late answer of the platform is ignored.
 */
export function useAssistantIntent(
  sdk: Pick<Sdk, 'createIntent'> | null,
  isOpen: boolean,
  capabilities: AssistantCapability[] | null,
  handlers: AssistantIntentHandlers
): AssistantIntent {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [isReady, setIsReady] = useState(false)
  // The latest capabilities and handlers, read by the message handler
  const capabilitiesRef = useRef(capabilities)
  const handlersRef = useRef(handlers)
  useEffect(() => {
    capabilitiesRef.current = capabilities
    handlersRef.current = handlers
  })

  const canStart = isOpen && sdk !== null && capabilities !== null

  useEffect(() => {
    if (!canStart) return undefined
    let isCurrent = true
    sdk.createIntent(ASSISTANT_INTENT).then(
      intent => {
        if (!isCurrent) return
        const service = assistantService(intent)
        setCreated(service === null ? { ok: false } : { ok: true, service })
      },
      (error: unknown) => {
        console.warn('[assistant] The intent could not be created', error)
        if (isCurrent) setCreated({ ok: false })
      }
    )
    return () => {
      isCurrent = false
      setCreated(null)
      setIsReady(false)
    }
  }, [canStart, sdk])

  const service = created?.ok === true ? created.service : null

  useEffect(() => {
    if (service === null) return undefined
    const handleMessage = (event: MessageEvent): void => {
      const frame = frameRef.current?.contentWindow ?? null
      if (
        frame === null ||
        event.source !== frame ||
        event.origin !== service.origin
      ) {
        return
      }
      const message = parseAssistantMessage(event.data, service.intentId)
      if (message === null) return
      switch (message.kind) {
        case 'ready': {
          const config: AssistantConfig = {
            capabilities: capabilitiesRef.current ?? []
          }
          frame.postMessage(config, service.origin)
          return
        }
        case 'readyToUse':
          setIsReady(true)
          return
        case 'capabilityCall':
          handlersRef.current.onCall(message.call)
          return
        case 'cancel':
          handlersRef.current.onCancel()
          return
        case 'result':
          return
      }
    }
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [service])

  const state: AssistantIntentState =
    !isOpen || sdk === null
      ? { status: 'closed' }
      : !canStart || created === null
        ? { status: 'opening' }
        : created.ok
          ? { status: 'open', service: created.service, isReady }
          : { status: 'failed' }
  return { state, frameRef }
}
