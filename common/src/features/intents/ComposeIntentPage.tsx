import { Icon } from '@linagora/twake-icons'
import { Typography } from '@linagora/twake-mui'
import type { IntentService } from 'cozy-interapp'
import {
  Suspense,
  useCallback,
  useRef,
  useState,
  type ReactElement
} from 'react'

import { Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { ActionIconButton } from '@/ds/ActionIconButton/ActionIconButton'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import {
  ComposerForm,
  type ComposerFormHandle,
  type ComposerInit,
  type ComposerOutcome
} from '@common/features/composer/ComposerForm'
import type { MailtoFields } from '@common/features/composer/mailto'
import { useI18n } from '@common/i18n/useI18n'

import type { ComposeIntentResult } from './composeIntent'

export interface ComposeIntentPageProps {
  service: IntentService
  fields: MailtoFields
}

/**
 * The composer alone, filling the frame of the intent: the app that asked
 * for it (Twake Chat…) draws the dialog around. Sent, the client gets
 * `{ status: 'sent' }`; closed with a draft, `{ status: 'draft', draftId }`;
 * closed without one or its draft deleted, the intent is cancelled (null).
 */
export function ComposeIntentPage({
  service,
  fields
}: ComposeIntentPageProps): ReactElement | null {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const [composerId] = useState(() => crypto.randomUUID())
  const [init] = useState<ComposerInit>(() => ({ mailto: fields }))
  const [title, setTitle] = useState('')
  const [isSettled, setIsSettled] = useState(false)
  const formRef = useRef<ComposerFormHandle | null>(null)
  const draftIdRef = useRef<string | null>(null)
  const settledRef = useRef(false)
  const shownRef = useRef(false)
  useDocumentTitle(title === '' ? t('composer.newMessage') : title)

  // cozy-interapp answers the client once only
  const settle = useCallback(
    (result: ComposeIntentResult | null): void => {
      if (settledRef.current) return
      settledRef.current = true
      setIsSettled(true)
      if (result === null) service.cancel()
      else service.terminate(result)
    },
    [service]
  )

  const handleReady = useCallback(
    (handle: ComposerFormHandle): void => {
      formRef.current = handle
      if (shownRef.current) return
      shownRef.current = true
      service.notifyReadyToUse()
      // Its own close button saves the draft: the client hides its own
      service.hideCross()
    },
    [service]
  )

  const handleDraftChange = useCallback((draftId: string | null): void => {
    draftIdRef.current = draftId
  }, [])

  const handleDone = useCallback(
    (outcome: ComposerOutcome): void => {
      settle(outcome === 'sent' ? { status: 'sent' } : null)
    },
    [settle]
  )

  const handleClose = useCallback((): void => {
    const close = async (): Promise<void> => {
      const form = formRef.current
      // Saved, or the user chose not to keep it; false: stays open
      if (form !== null && !(await form.requestClose())) return
      const draftId = draftIdRef.current
      settle(draftId === null ? null : { status: 'draft', draftId })
    }
    close().catch((error: unknown) => {
      console.error('[intents] Cannot close the composer', error)
    })
  }, [settle])

  if (isSettled) return null

  return (
    <div
      className="u-flex u-flex-column u-h-100 u-ov-hidden"
      data-testid="compose-intent"
    >
      {isPhone ? null : (
        <div className="u-flex u-flex-items-center u-pl-1 u-pr-half u-pv-half">
          <Typography variant="h6" component="h1" className="u-flex-auto">
            {title === '' ? t('composer.newMessage') : title}
          </Typography>
          <ActionIconButton
            label={t('composer.window.close')}
            onClick={handleClose}
            data-testid="composer-close-button"
          >
            <Icon icon={Cross} size={16} aria-hidden="true" />
          </ActionIconButton>
        </div>
      )}
      <Suspense fallback={null}>
        <ComposerForm
          composerId={composerId}
          init={init}
          autoFocus
          onTitleChange={setTitle}
          onReady={handleReady}
          onDraftChange={handleDraftChange}
          onDone={handleDone}
          onRequestClose={handleClose}
          // The draft goes to the client: deleting it here would lie
          isDiscardOfferedOnClose={false}
        />
      </Suspense>
    </div>
  )
}
