import { Icon, Reply } from '@linagora/twake-icons'
import { Box, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import type { EmailDetail } from './queries'
import {
  REPLY_LABELS,
  REPLY_TEST_IDS,
  useReplyOptions
} from './useReplyOptions'

export interface ReplyActionsProps {
  email: EmailDetail
}

/**
 * The answers to an email, under it, as tmail-flutter's bottom bar: Reply,
 * Reply all, Reply to list and Forward, on every screen size.
 */
export function ReplyActions({ email }: ReplyActionsProps): ReactElement {
  const { t } = useI18n()
  const { actions, open } = useReplyOptions(email)
  return (
    <Box
      role="group"
      aria-label={t('emailActions.reply.label')}
      className="u-flex u-flex-wrap u-mt-1"
      data-testid="email-reply-actions"
    >
      {actions.map(action => (
        <Button
          key={action}
          variant="outlined"
          // The primary blue fails AA on white (docs/twake-mui-gaps.md)
          color="inherit"
          size="small"
          startIcon={
            action === 'forward' ? undefined : (
              <Icon icon={Reply} aria-hidden="true" />
            )
          }
          onClick={() => {
            open(action)
          }}
          className="u-mr-half u-mb-half"
          data-testid={REPLY_TEST_IDS[action]}
        >
          {t(REPLY_LABELS[action])}
        </Button>
      ))}
    </Box>
  )
}
