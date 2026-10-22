import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { useComposer } from '@common/features/composer/ComposerProvider'
import type { EmailActionId } from '@common/features/emailActions/emailActionItems'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'
import type { NewRuleLocationState } from '@common/features/rules/EmailRulesSettings'
import { settingsSectionPath } from '@common/features/settings/sections'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { EmailDetail } from './queries'
import { useDownloadEml } from './useDownloadEml'
import { usePrintEmail } from './usePrintEmail'
import { useUnsubscribe } from './useUnsubscribe'

/**
 * The actions that need the whole email, which an open email has (Print,
 * Download as EML, Unsubscribe), the ones that open it in a composer
 * (Edit as new) or the rules (Create a rule), then the common ones. Resolves to whether the email
 * changed.
 */
export function useRunViewedEmailAction(): (
  id: EmailActionId,
  email: EmailDetail,
  mailboxId: string | null
) => Promise<boolean> {
  const runAction = useRunEmailAction()
  const { openComposer } = useComposer()
  const printEmail = usePrintEmail()
  const downloadEml = useDownloadEml()
  const { unsubscribe } = useUnsubscribe()
  const navigate = useNavigate()

  return useCallback(
    async (id, email, mailboxId) => {
      switch (id) {
        case 'create-rule': {
          // As tmail-flutter: the rule creator, filled with the sender
          const sender = email.from?.[0]?.email
          if (sender !== undefined) {
            await navigate(settingsSectionPath('email-rules'), {
              state: { newRuleFrom: sender } satisfies NewRuleLocationState
            })
          }
          return false
        }
        case 'print':
          await printEmail(email)
          return false
        case 'download-eml':
          await downloadEml(email)
          return false
        case 'unsubscribe':
          await unsubscribe(email, mailboxId)
          return false
        case 'edit-as-new':
          openComposer({ editAsNewEmailId: email.id })
          return false
        default:
          return runAction(id, [email], mailboxId)
      }
    },
    [runAction, openComposer, printEmail, downloadEml, unsubscribe, navigate]
  )
}

/**
 * The actions of `SINGLE_EMAIL_ACTIONS` an open email can offer: "Create a
 * rule with this email" when it has a sender and the server has rules
 */
export function useViewedEmailExtras(): (
  email: EmailDetail
) => EmailActionId[] {
  const { canUnsubscribe } = useUnsubscribe()
  const { session } = useJmapSession()
  const hasRules = LINAGORA_CAPABILITIES.filter in session.capabilities
  return email =>
    viewedEmailExtras(email, {
      canUnsubscribe: canUnsubscribe(email),
      canCreateRule: hasRules && (email.from?.length ?? 0) > 0
    })
}

export function viewedEmailExtras(
  email: Pick<EmailDetail, 'blobId'>,
  {
    canUnsubscribe,
    canCreateRule
  }: { canUnsubscribe: boolean; canCreateRule: boolean }
): EmailActionId[] {
  return [
    ...(canCreateRule ? (['create-rule'] as const) : []),
    ...(canUnsubscribe ? (['unsubscribe'] as const) : []),
    'print',
    ...(email.blobId ? (['download-eml'] as const) : []),
    'edit-as-new'
  ]
}
