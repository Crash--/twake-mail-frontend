import { Icon } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'

import { Bottom, Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { FieldTextButton } from '@/ds/FieldTextButton/FieldTextButton'
import type { RecipientFieldActions } from '@/ds/RecipientField/RecipientField'
import { RecipientSummary } from '@/ds/RecipientField/RecipientSummary'
import { useI18n } from '@common/i18n/useI18n'

import { RecipientInput } from './RecipientInput'
import { recipientChips } from './recipientChips'
import type { Recipient } from './recipients'

export type RecipientKind = 'to' | 'cc' | 'bcc' | 'replyTo'

export type RecipientLists = Record<RecipientKind, Recipient[]>

const OPTIONAL_KINDS = ['cc', 'bcc', 'replyTo'] as const

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
