import { useQueryClient } from '@tanstack/react-query'
import { Icon, Bottom, Cross } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { FieldTextButton } from '@/ds/FieldTextButton/FieldTextButton'
import type {
  RecipientFieldActions,
  RecipientFieldDnd
} from '@/ds/RecipientField/RecipientField'
import { RecipientSummary } from '@/ds/RecipientField/RecipientSummary'
import {
  IDENTITY_SORT_ORDER_CAPABILITY,
  identitiesQueryOptions
} from '@common/features/identities/queries'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { fetchEmailSenders } from '@common/features/thread/emailSenders'
import {
  DRAGGED_EMAILS_TYPE,
  readDraggedEmails
} from '@common/features/thread/useEmailListActions'
import {
  ADDRESS_DRAG_TYPE,
  readAddressDrag
} from '@common/features/email/addressDrag'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { isAddressFile, parseAddressFile } from './addressFile'
import { RecipientInput } from './RecipientInput'
import { recipientChips } from './recipientChips'
import { hasRecipient, mergeRecipients, type Recipient } from './recipients'
import { makeIsSelf } from './replyRecipients'
import { readText } from './textCharset'

export type RecipientKind = 'to' | 'cc' | 'bcc' | 'replyTo'

export type RecipientLists = Record<RecipientKind, Recipient[]>

const OPTIONAL_KINDS = ['cc', 'bcc', 'replyTo'] as const

const KINDS: readonly RecipientKind[] = ['to', ...OPTIONAL_KINDS]

/** The invalid lines of a dropped file listed in its notification */
const MAX_INVALID_LINES_SHOWN = 10

function listLines(lines: readonly number[]): string {
  const shown = lines.slice(0, MAX_INVALID_LINES_SHOWN).join(', ')
  return lines.length > MAX_INVALID_LINES_SHOWN ? `${shown}…` : shown
}

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
  /** The addresses the server refused to send to, flagged as invalid */
  refused?: readonly string[]
}

/**
 * The recipient fields of the composer: To, with buttons showing Cc, Bcc
 * and Reply to; once the focus moved on (subject, body) they fold into
 * a one line summary, as in tmail-flutter, which unfolds them on click and
 * gives the focus to To.
 *
 * As in tmail-flutter, a recipient dragged to another field moves there
 * (Alt + ArrowUp or ArrowDown from the keyboard), and emails dragged from
 * the list add their senders to the field they are dropped on, except the
 * user's own addresses, as when replying. An address of an open email (its
 * sender, a recipient) dropped on a field is added there. A text file dropped on a field
 * adds its addresses, one per line (`tf#3268`), and says which lines are
 * not addresses.
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
  autoFocusTo = false,
  refused = []
}: RecipientsEditorProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const queryClient = useQueryClient()
  const { notify } = useNotify()
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
          chips={recipientChips(
            [...recipients.to, ...recipients.cc, ...recipients.bcc],
            refused
          )}
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
   * and leaves `from` anyway. Says what to announce, null when it did not
   * move
   */
  const moveRecipient = (
    from: RecipientKind,
    to: RecipientKind,
    email: string
  ): string | null => {
    const recipient = recipients[from].find(other => other.email === email)
    if (from === to || recipient === undefined) return null
    if (!hasRecipient(recipients[to], email)) {
      onChange(to, [...recipients[to], recipient])
    }
    onChange(
      from,
      recipients[from].filter(other => other !== recipient)
    )
    return t('composer.recipients.moved', {
      address: recipient.name ?? recipient.email,
      field: t(LABEL_KEYS[to])
    })
  }

  const dropEmails = (
    kind: RecipientKind,
    dataTransfer: DataTransfer
  ): void => {
    const dragged = readDraggedEmails(dataTransfer)
    if (dragged === null) return
    Promise.all([
      fetchEmailSenders(client, accountId, dragged.emailIds),
      queryClient.query({
        ...identitiesQueryOptions(
          client,
          accountId,
          IDENTITY_SORT_ORDER_CAPABILITY in session.capabilities,
          session.username
        ),
        staleTime: Infinity
      })
    ])
      .then(([senders, identities]) => {
        // The user's own addresses are left out, as when replying
        const isSelf = makeIsSelf([
          session.username,
          ...identities.map(identity => identity.email)
        ])
        const others = senders.filter(sender => !isSelf(sender.email))
        // The field as it is once the senders arrived
        onChange(kind, mergeRecipients(latest.current[kind], others))
      })
      .catch((error: unknown) => {
        console.warn('[composer] Cannot read the senders of the emails', error)
      })
  }

  const dropAddressFiles = (kind: RecipientKind, dropped: File[]): void => {
    const notes = dropped
      .filter(file => !isAddressFile(file))
      .map(file => t('composer.recipients.notAddressFile', { file: file.name }))
    Promise.all(
      dropped.filter(isAddressFile).map(async file => ({
        name: file.name,
        ...parseAddressFile(await readText(file))
      }))
    )
      .then(files => {
        const added = files.flatMap(file => file.recipients)
        // The field as it is once the files are read
        if (added.length > 0) {
          onChange(kind, mergeRecipients(latest.current[kind], added))
        }
        const said = [
          ...notes,
          ...files
            .filter(file => file.invalidLines.length > 0)
            .map(file =>
              t('composer.recipients.invalidLines', {
                smart_count: file.invalidLines.length,
                file: file.name,
                lines: listLines(file.invalidLines)
              })
            )
        ]
        if (said.length > 0) {
          notify({ message: said.join(' '), severity: 'error' })
        }
      })
      .catch((error: unknown) => {
        console.warn('[composer] Cannot read the dropped files', error)
        notify({
          message: t('composer.recipients.fileUnreadable'),
          severity: 'error'
        })
      })
  }

  const dropAddress = (
    kind: RecipientKind,
    dataTransfer: DataTransfer
  ): void => {
    const address = readAddressDrag(dataTransfer)
    if (address === null) return
    onChange(kind, mergeRecipients(recipients[kind], [address]))
  }

  const dropOn = (kind: RecipientKind, dataTransfer: DataTransfer): void => {
    const dropped = Array.from(dataTransfer.files)
    if (dropped.length > 0) {
      dropAddressFiles(kind, dropped)
    } else if (dataTransfer.types.includes(ADDRESS_DRAG_TYPE)) {
      dropAddress(kind, dataTransfer)
    } else {
      dropEmails(kind, dataTransfer)
    }
  }

  const dndOf = (
    kind: RecipientKind,
    kinds: RecipientKind[]
  ): RecipientFieldDnd => ({
    group: dragGroup,
    field: kind,
    onMoveIn: (from, email) =>
      isRecipientKind(from) ? moveRecipient(from, kind, email) : null,
    // Said in the help of the tags only when there is another field
    ...(kinds.length < 2
      ? {}
      : {
          onMoveBy: (email: string, delta: -1 | 1): string | null => {
            const target = kinds[kinds.indexOf(kind) + delta]
            return target === undefined
              ? null
              : moveRecipient(kind, target, email)
          }
        }),
    accepts: types =>
      types.includes(DRAGGED_EMAILS_TYPE) ||
      types.includes(ADDRESS_DRAG_TYPE) ||
      types.includes('Files'),
    onDrop: dataTransfer => {
      dropOn(kind, dataTransfer)
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
          refused={refused}
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
