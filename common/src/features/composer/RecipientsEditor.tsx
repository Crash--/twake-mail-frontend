import { Box, Button } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { RecipientSummary } from '@/ds/RecipientField/RecipientSummary'
import { useI18n } from '@common/i18n/useI18n'

import { RecipientInput } from './RecipientInput'
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

/** Names shown in the summary of the collapsed fields */
const SUMMARY_NAMES = 3

export interface RecipientsEditorProps {
  recipients: RecipientLists
  onChange: (kind: RecipientKind, recipients: Recipient[]) => void
  inputs: Record<RecipientKind, string>
  onInputChange: (kind: RecipientKind, value: string) => void
  /** The optional fields shown (Cc, Bcc, Reply to) */
  shown: ReadonlySet<RecipientKind>
  onShow: (kind: RecipientKind) => void
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
  isCollapsed,
  onExpand,
  autoFocusTo = false
}: RecipientsEditorProps): ReactElement {
  const { t } = useI18n()
  /** The field to focus when it shows */
  const [focused, setFocused] = useState<RecipientKind | null>(
    autoFocusTo ? 'to' : null
  )

  const handleShow = (kind: RecipientKind): void => {
    setFocused(kind)
    onShow(kind)
  }

  const handleExpand = (): void => {
    setFocused('to')
    onExpand()
  }

  if (isCollapsed) {
    const all = [...recipients.to, ...recipients.cc, ...recipients.bcc]
    const names = all
      .slice(0, SUMMARY_NAMES)
      .map(recipient => recipient.name ?? recipient.email)
      .join(', ')
    const others = all.length - SUMMARY_NAMES
    return (
      <RecipientSummary
        summary={
          others > 0
            ? `${names} ${t('composer.recipients.others', { smart_count: others })}`
            : names
        }
        label={t('composer.recipients.summary')}
        onExpand={handleExpand}
        data-testid="composer-recipients-summary"
      />
    )
  }

  const hidden = OPTIONAL_KINDS.filter(kind => !shown.has(kind))
  const kinds: RecipientKind[] = [
    'to',
    ...OPTIONAL_KINDS.filter(kind => shown.has(kind))
  ]

  return (
    <Box>
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
          endActions={
            kind === 'to' && hidden.length > 0 ? (
              <Box className="u-flex">
                {hidden.map(other => (
                  <Button
                    key={other}
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={() => {
                      handleShow(other)
                    }}
                    data-testid={`composer-show-${FIELD_IDS[other]}-button`}
                  >
                    {t(LABEL_KEYS[other])}
                  </Button>
                ))}
              </Box>
            ) : undefined
          }
        />
      ))}
    </Box>
  )
}
