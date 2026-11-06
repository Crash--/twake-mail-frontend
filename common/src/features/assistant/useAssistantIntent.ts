import type { Sdk } from '@linagora/twake-sdk'
import { useEffect, useRef, useState, type RefObject } from 'react'

import {
  ASSISTANT_INTENT,
  assistantService,
  parseAssistantMessage,
  type AssistantConfig,
  type AssistantService,
  type CapabilityCall,
  type CapabilityResult
} from './assistant'

export type AssistantIntentState =
  | { status: 'closed' }
  | { status: 'opening' }
  | { status: 'open'; service: AssistantService; isReady: boolean }
  | { status: 'failed' }

export interface AssistantIntentHandlers {
  onCall: (call: CapabilityCall) => Promise<CapabilityResult | null>
  onCancel: () => void
}

export interface AssistantIntent {
  state: AssistantIntentState
  frameRef: RefObject<HTMLIFrameElement | null>
}

type Created = { ok: true; service: AssistantService } | { ok: false }

export function useAssistantIntent(
  sdk: Pick<Sdk, 'createIntent'> | null,
  config: AssistantConfig | null,
  handlers: AssistantIntentHandlers
): AssistantIntent {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [isReady, setIsReady] = useState(false)
  const configRef = useRef(config)
  const handlersRef = useRef(handlers)
  useEffect(() => {
    configRef.current = config
    handlersRef.current = handlers
  })

  const canStart = sdk !== null && config !== null

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
          frame.postMessage(configRef.current ?? {}, service.origin)
          return
        }
        case 'readyToUse':
          setIsReady(true)
          return
        case 'capabilityCall':
          handlersRef.current
            .onCall(message.call)
            .then(result => {
              if (result === null) return
              frameRef.current?.contentWindow?.postMessage(
                {
                  type: `intent-${service.intentId}:data`,
                  data: { ...configRef.current, capabilityResult: result }
                },
                service.origin
              )
            })
            .catch((error: unknown) => {
              console.warn('[assistant] The call could not run', error)
            })
          return
        case 'cancel':
          handlersRef.current.onCancel()
          return
      }
    }
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [service])

  const state: AssistantIntentState =
    sdk === null
      ? { status: 'closed' }
      : !canStart || created === null
        ? { status: 'opening' }
        : created.ok
          ? { status: 'open', service: created.service, isReady }
          : { status: 'failed' }
  return { state, frameRef }
}
