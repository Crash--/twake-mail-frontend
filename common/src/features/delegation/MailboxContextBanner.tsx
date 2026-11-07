import { Alert, Button } from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'

import {
  isTeamRoot,
  teamMailboxAddress
} from '@common/features/mailbox/mailboxTree'
import { mailboxesQueryOptions } from '@common/features/mailbox/queries'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import {
  useJmapSession,
  useMailboxView
} from '@common/jmap/JmapSessionProvider'
import { OWN_VIEW } from '@common/jmap/mailboxView'

import { useContactName } from './useContactNames'

interface ShownMailbox {
  name: string
  address: string
}

/**
 * The team mailbox picked in the switcher, named as the switcher does;
 * null until its folders are known
 */
function useTeamMailbox(rootId: string | null): ShownMailbox | null {
  const client = useJmapClient()
  const { ownAccountId } = useJmapSession()
  const mailboxes = useQuery({
    ...mailboxesQueryOptions(client, ownAccountId),
    enabled: rootId !== null
  })
  const root = (mailboxes.data?.list ?? []).find(
    mailbox => mailbox.id === rootId && isTeamRoot(mailbox)
  )
  if (root === undefined) return null
  return { name: root.name, address: teamMailboxAddress(root) ?? root.name }
}

/**
 * Says, above the mail screens, that the mailbox shown is someone else's
 * (one delegated to the user) or a team mailbox picked in the switcher, and
 * whose name what is sent from here goes out in; "Back to your mailbox"
 * does what the cross of the switcher does. Not a live region: switching
 * already moves the focus to the new view.
 */
export function MailboxContextBanner(): ReactElement | null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { mailAddress } = useJmapSession()
  const { view, switchView } = useMailboxView()
  const ownerName = useContactName(
    view.kind === 'delegated' ? mailAddress : null
  )
  const team = useTeamMailbox(view.kind === 'team' ? view.rootId : null)

  const message =
    view.kind === 'delegated'
      ? t('delegation.banner.delegated', {
          name: ownerName ?? mailAddress,
          email: mailAddress
        })
      : view.kind === 'team' && team !== null
        ? t('delegation.banner.team', {
            name: team.name,
            email: team.address
          })
        : null
  if (message === null) return null

  const handleBack = (): void => {
    void navigate('/')
    switchView(OWN_VIEW)
  }

  return (
    <Alert
      severity="info"
      // Read where it stands, not announced (MUI makes an Alert a live one)
      role="note"
      className="u-m-1"
      data-testid="mailbox-context-banner"
      action={
        <Button
          color="inherit"
          onClick={handleBack}
          data-testid="mailbox-context-back-button"
        >
          {t('delegation.switcher.back')}
        </Button>
      }
    >
      {message}
    </Alert>
  )
}
