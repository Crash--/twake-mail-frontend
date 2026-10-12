import { Icon } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { Bottom, Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { FieldTextButton } from '@/ds/FieldTextButton/FieldTextButton'
import type {
  RecipientFieldActions,
  RecipientFieldDnd
} from '@/ds/RecipientField/RecipientField'
import { RecipientSummary } from '@/ds/RecipientField/RecipientSummary'
import { fetchEmailSenders } from '@common/features/thread/emailSenders'
import {
  DRAGGED_EMAILS_TYPE,
  readDraggedEmails
} from '@common/features/thread/useEmailListActions'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { RecipientInput } from './RecipientInput'
import { recipientChips } from './recipientChips'
import { hasRecipient, mergeRecipients, type Recipient } from './recipients'

export type RecipientKind = 'to' | 'cc' | 'bcc' | 'replyTo'

export type RecipientLists = Record<RecipientKind, Recipient[]>

const OPTIONAL_KINDS = ['cc', 'bcc', 'replyTo'] as const

const KINDS: readonly RecipientKind[] = ['to', ...OPTIONAL_KINDS]

function isRecipientKind(value: string): value is RecipientKind {
  return KINDS.some(kind => kind === value)
}

/** Kebab case, for the `data-testid` of a field */
const FIELD_IDS: Record<RecipientKind, string> = {
  to: 'to',
  cc: 'cc',
  bcc: 'bcc',
  replyTo: 'reply-to'
}

const LABEL_KEYS = {
  to: 'composer.fields.to',
  cc: 'composer.fields.cc',
  bcc: 'composer.fields.bcc',
  replyTo: 'composer.fields.replyTo'
} as const

export interface RecipientsEditorProps {
  recipients: RecipientLists
  onChange: (kind: RecipientKind, recipients: Recipient[]) => void
  inputs: Record<RecipientKind, string>
  onInputChange: (kind: RecipientKind, value: string) => void
  /** The optional fields shown (Cc, Bcc, Reply to) */
  shown: ReadonlySet<RecipientKind>
  onShow: (kind: RecipientKind) => void
  /** Takes Cc, Bcc or Reply to off again; the field is emptied by the caller */
  onHide: (kind: RecipientKind) => void
  /**
   * The line of the identity selector, shown above To once opened; null
   * while hidden or when the user has one identity only
   */
  fromLine: ReactNode
  /** Opens the line above; null when there is nothing to open */
  onShowFrom: (() => void) | null
  /** The fields folded into a one line summary */
  isCollapsed: boolean
  onExpand: () => void
  /** To takes the focus once shown (a new message) */
  autoFocusTo?: boolean
}

/**
 * The recipient fields of the composer: To, with buttons showing Cc, Bcc
 * and Reply to; once the focus moved on (subject, body) they fold into
 * a one line summary, as in tmail-flutter, which unfolds them on click and
 * gives the focus to To.
 *
 * As in tmail-flutter, a recipient dragged to another field moves there
 * (Alt + ArrowUp or ArrowDown from the keyboard), and emails dragged from
 * the list add their senders to the field they are dropped on.
 */
export function RecipientsEditor({
  recipients,
  onChange,
  inputs,
  onInputChange,
  shown,
  onShow,
  onHide,
  fromLine,
  onShowFrom,
  isCollapsed,
  onExpand,
  autoFocusTo = false
}: RecipientsEditorProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  /** Fields of this composer only exchange recipients */
  const dragGroup = useId()
  /** The recipients now, for the senders of dropped emails, read later */
  const latest = useRef(recipients)
  useEffect(() => {
    latest.current = recipients
  }, [recipients])
  /** The field to focus when it shows */
  const [focused, setFocused] = useState<RecipientKind | null>(
    autoFocusTo ? 'to' : null
  )

  const handleShow = (kind: RecipientKind): void => {
    setFocused(kind)
    onShow(kind)
  }

  const toRef = useRef<RecipientFieldActions>(null)

  const handleHide = (kind: RecipientKind): void => {
    onHide(kind)
    // The button that had the focus goes with the field
    toRef.current?.focus()
  }

  const handleShowFrom = (): void => {
    onShowFrom?.()
  }

  /** On a phone, one chevron shows From, Cc, Bcc and Reply to together */
  const handleShowAll = (): void => {
    setFocused('cc')
    onShowFrom?.()
    OPTIONAL_KINDS.filter(kind => !shown.has(kind)).forEach(onShow)
  }

  const handleExpand = (): void => {
    setFocused('to')
    onExpand()
  }

  if (isCollapsed) {
    return (
      <>
        {fromLine}
        <RecipientSummary
          chips={recipientChips([
            ...recipients.to,
            ...recipients.cc,
            ...recipients.bcc
          ])}
          label={t('composer.recipients.summary')}
          moreLabel={count =>
            t('composer.recipients.others', { smart_count: count })
          }
          onExpand={handleExpand}
          data-testid="composer-recipients-summary"
        />
      </>
    )
  }

  /**
   * tmail-flutter's move: the recipient joins `to` unless already there,
   * and leaves `from` anyway
   */
  const moveRecipient = (
    from: RecipientKind,
    to: RecipientKind,
    email: string
  ): boolean => {
    const recipient = recipients[from].find(other => other.email === email)
    if (from === to || recipient === undefined) return false
    if (!hasRecipient(recipients[to], email)) {
      onChange(to, [...recipients[to], recipient])
    }
    onChange(
      from,
      recipients[from].filter(other => other !== recipient)
    )
    return true
  }

  const dropEmails = (
    kind: RecipientKind,
    dataTransfer: DataTransfer
  ): void => {
    const dragged = readDraggedEmails(dataTransfer)
    if (dragged === null) return
    fetchEmailSenders(client, accountId, dragged.emailIds)
      .then(senders => {
        // The field as it is once the senders arrived
        onChange(kind, mergeRecipients(latest.current[kind], senders))
      })
      .catch((error: unknown) => {
        console.warn('[composer] Cannot read the senders of the emails', error)
      })
  }

  const dndOf = (
    kind: RecipientKind,
    kinds: RecipientKind[]
  ): RecipientFieldDnd => ({
    group: dragGroup,
    field: kind,
    onMoveIn: (from, email) => {
      if (isRecipientKind(from)) moveRecipient(from, kind, email)
    },
    // Said in the help of the tags only when there is another field
    ...(kinds.length < 2
      ? {}
      : {
          onMoveBy: (email: string, delta: -1 | 1): string | null => {
            const target = kinds[kinds.indexOf(kind) + delta]
            const recipient = recipients[kind].find(
              other => other.email === email
            )
            if (target === undefined || recipient === undefined) return null
            moveRecipient(kind, target, email)
            return t('composer.recipients.moved', {
              address: recipient.name ?? recipient.email,
              field: t(LABEL_KEYS[target])
            })
          }
        }),
    accepts: types => types.includes(DRAGGED_EMAILS_TYPE),
    onDrop: dataTransfer => {
      dropEmails(kind, dataTransfer)
    }
  })

  const hideLabel = (kind: RecipientKind): string =>
    t('composer.fields.hide', { field: t(LABEL_KEYS[kind]) })

  const hidden = OPTIONAL_KINDS.filter(kind => !shown.has(kind))
  const kinds: RecipientKind[] = [
    'to',
    ...OPTIONAL_KINDS.filter(kind => shown.has(kind))
  ]

  return (
    <Box>
      {fromLine}
      {kinds.map(kind => (
        <RecipientInput
          key={kind}
          field={FIELD_IDS[kind]}
          label={t(LABEL_KEYS[kind])}
          recipients={recipients[kind]}
          onChange={list => {
            onChange(kind, list)
          }}
          inputValue={inputs[kind]}
          onInputChange={value => {
            onInputChange(kind, value)
          }}
          autoFocus={focused === kind}
          actions={kind === 'to' ? toRef : undefined}
          dnd={dndOf(kind, kinds)}
          endActions={
            kind === 'to' ? (
              isPhone ? (
                onShowFrom === null && hidden.length === 0 ? null : (
                  <Tooltip title={t('composer.fields.more')}>
                    <IconButton
                      size="small"
                      aria-label={t('composer.fields.more')}
                      onClick={handleShowAll}
                      data-testid="composer-show-more-fields-button"
                    >
                      <Icon icon={Bottom} aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                )
              ) : (
                <>
                  {onShowFrom === null ? null : (
                    <FieldTextButton
                      onClick={handleShowFrom}
                      data-testid="composer-show-from-button"
                    >
                      {t('composer.fields.from')}
                    </FieldTextButton>
                  )}
                  {hidden.map(other => (
                    <FieldTextButton
                      key={other}
                      onClick={() => {
                        handleShow(other)
                      }}
                      data-testid={`composer-show-${FIELD_IDS[other]}-button`}
                    >
                      {t(LABEL_KEYS[other])}
                    </FieldTextButton>
                  ))}
                </>
              )
            ) : (
              <Tooltip title={hideLabel(kind)}>
                <IconButton
                  size="xsmall"
                  aria-label={hideLabel(kind)}
                  onClick={() => {
                    handleHide(kind)
                  }}
                  data-testid={`composer-hide-${FIELD_IDS[kind]}-button`}
                >
                  <Icon icon={Cross} size={16} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            )
          }
        />
      ))}
    </Box>
  )
}
