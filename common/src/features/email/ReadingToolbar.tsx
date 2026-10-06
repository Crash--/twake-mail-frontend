import { Icon, Left, Right } from '@linagora/twake-icons'
import { Box, Button } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { IconAction } from '@/ds/IconAction/IconAction'
import { StickyBar } from '@/ds/StickyBar/StickyBar'
import { useCurrentMailboxName } from '@common/features/mailbox/useCurrentMailboxName'
import { useI18n } from '@common/i18n/useI18n'

import type { EmailViewNavigation } from './useEmailViewShortcuts'

export interface ReadingToolbarProps {
  onBack: () => void
  navigation: EmailViewNavigation
  /** Accessible name of the toolbar */
  label?: string
  /** What goes after "previous" and "next", e.g. the "More" menu */
  children?: ReactNode
  'data-testid'?: string
}

/**
 * The bar over an open email or conversation, as in the mocks: "‹ Inbox"
 * (the folder it returns to) and the previous / next email of the folder
 */
export function ReadingToolbar({
  onBack,
  navigation,
  label,
  children,
  'data-testid': testId
}: ReadingToolbarProps): ReactElement {
  const { t } = useI18n()
  const mailboxName = useCurrentMailboxName()
  const backLabel =
    mailboxName === null
      ? t('common.back')
      : t('email.backTo', { name: mailboxName })
  const previousLabel = t('email.previousEmail')
  const nextLabel = t('email.nextEmail')
  return (
    <StickyBar
      role={label === undefined ? undefined : 'toolbar'}
      label={label}
      hasDivider
      className="u-flex u-flex-items-center u-ph-half u-pv-half"
      data-testid={testId}
    >
      <Button
        variant="text"
        color="inherit"
        size="small"
        startIcon={<Icon icon={Left} aria-hidden="true" />}
        onClick={onBack}
        aria-label={backLabel}
        data-testid="email-view-back-button"
      >
        {mailboxName ?? t('common.back')}
      </Button>
      <Box className="u-flex u-flex-items-center u-flex-auto u-flex-justify-end">
        <IconAction
          label={previousLabel}
          icon={Left}
          disabled={navigation.openPrevious === null}
          onClick={navigation.openPrevious ?? undefined}
          data-testid="email-view-previous-button"
        />
        <IconAction
          label={nextLabel}
          icon={Right}
          disabled={navigation.openNext === null}
          onClick={navigation.openNext ?? undefined}
          data-testid="email-view-next-button"
        />
        {children}
      </Box>
    </StickyBar>
  )
}
