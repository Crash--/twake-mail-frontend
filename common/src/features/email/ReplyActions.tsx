import { Icon } from '@linagora/twake-icons'
import type { ReactElement, ReactNode } from 'react'

import { Reply } from '@/ds/FlutterIcons/FlutterIcons'
import { ActionBar, ActionBarButton } from '@/ds/ActionBar/ActionBar'
import { ForwardIcon, ReplyAllIcon } from '@/ds/ReplyIcons/ReplyIcons'
import { useI18n } from '@common/i18n/useI18n'
import type { ReplyAction } from '@common/features/composer/replyRecipients'

import type { EmailDetail } from './queries'
import {
  REPLY_LABELS,
  REPLY_TEST_IDS,
  useReplyOptions
} from './useReplyOptions'

export interface ReplyActionsProps {
  email: EmailDetail
}

const ICONS: Record<ReplyAction, ReactNode> = {
  reply: <Icon icon={Reply} size={20} aria-hidden="true" />,
  replyAll: <ReplyAllIcon />,
  replyToList: <Icon icon={Reply} size={20} aria-hidden="true" />,
  forward: <ForwardIcon />
}

/** The order of the mock: Reply all, Reply, Reply to list, Forward */
const ORDER: readonly ReplyAction[] = [
  'replyAll',
  'reply',
  'replyToList',
  'forward'
]

/**
 * The answers to an email, in the bar at the bottom of it, as the mocks and
 * tmail-flutter: Reply all, Reply, Reply to list and Forward, on every
 * screen size.
 */
export function ReplyActions({ email }: ReplyActionsProps): ReactElement {
  const { t } = useI18n()
  const { actions, open } = useReplyOptions(email)
  return (
    <ActionBar
      label={t('emailActions.reply.label')}
      data-testid="email-reply-actions"
    >
      {ORDER.filter(action => actions.includes(action)).map(action => (
        <ActionBarButton
          key={action}
          icon={ICONS[action]}
          onClick={() => {
            open(action)
          }}
          data-testid={REPLY_TEST_IDS[action]}
        >
          {t(REPLY_LABELS[action])}
        </ActionBarButton>
      ))}
    </ActionBar>
  )
}
