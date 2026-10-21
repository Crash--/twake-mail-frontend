import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'

import {
  MailboxSwitcher,
  type MailboxSwitcherGroup,
  type MailboxSwitcherItem
} from '@/ds/MailboxSwitcher/MailboxSwitcher'
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
import {
  delegatedMailboxes,
  OWN_VIEW,
  type MailboxView
} from '@common/jmap/mailboxView'

import { useContactNames } from './useContactNames'

const OWN_ID = 'own'

function viewId(view: MailboxView): string {
  switch (view.kind) {
    case 'own':
      return OWN_ID
    case 'delegated':
      return `delegated:${view.accountId}`
    case 'team':
      return `team:${view.rootId}`
  }
}

function parseViewId(id: string): MailboxView {
  if (id.startsWith('delegated:')) {
    return { kind: 'delegated', accountId: id.slice('delegated:'.length) }
  }
  if (id.startsWith('team:')) {
    return { kind: 'team', rootId: id.slice('team:'.length) }
  }
  return OWN_VIEW
}

/**
 * "Viewing <name>" (tmail-flutter#4977): switches the mail screens between
 * the user's mailbox, the mailboxes delegated to them and their team
 * mailboxes (then bound to that one). Changing mailbox goes to its Inbox,
 * with a cache emptied. Nothing when the user has none but their own.
 */
export function MailboxSwitcherButton(): ReactElement | null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const client = useJmapClient()
  const { session, ownAccountId } = useJmapSession()
  const { view, switchView } = useMailboxView()
  // The team mailboxes of the user, even while a delegated one is shown
  const ownMailboxes = useQuery(mailboxesQueryOptions(client, ownAccountId))
  const delegated = delegatedMailboxes(session)
  const teamRoots = (ownMailboxes.data?.list ?? []).filter(isTeamRoot)
  const names = useContactNames([
    session.username,
    ...delegated.map(mailbox => mailbox.address)
  ])

  if (delegated.length === 0 && teamRoots.length === 0) return null

  const nameOf = (address: string): string => names[address] ?? address
  const own: MailboxSwitcherItem = {
    id: OWN_ID,
    name: nameOf(session.username),
    address: session.username,
    avatarKey: session.username
  }
  const groups: MailboxSwitcherGroup[] = [
    { id: 'own', title: t('delegation.switcher.own'), items: [own] },
    {
      id: 'delegated',
      title: t('delegation.switcher.delegated'),
      items: delegated.map(mailbox => ({
        id: viewId({ kind: 'delegated', accountId: mailbox.accountId }),
        name: nameOf(mailbox.address),
        address: mailbox.address,
        avatarKey: mailbox.address
      }))
    },
    {
      id: 'team',
      title: t('delegation.switcher.team'),
      items: teamRoots.map(root => {
        const address = teamMailboxAddress(root) ?? root.name
        return {
          id: viewId({ kind: 'team', rootId: root.id }),
          name: root.name,
          address,
          avatarKey: address
        }
      })
    }
  ]
  const selectedId = viewId(view)
  const selected =
    groups.flatMap(group => group.items).find(item => item.id === selectedId) ??
    own
  const shownName =
    selectedId === OWN_ID ? t('delegation.switcher.me') : selected.name

  return (
    <MailboxSwitcher
      groups={groups}
      selectedId={selectedId}
      ownId={OWN_ID}
      labels={{
        pill: t('delegation.switcher.viewing', { name: shownName }),
        open: t('delegation.switcher.open', { name: shownName }),
        back: t('delegation.switcher.back')
      }}
      onSelect={id => {
        // The Inbox of the mailbox picked: the page shown belongs to the
        // previous one
        void navigate('/')
        switchView(parseViewId(id))
      }}
      data-testid="mailbox-switcher-button"
      itemTestId="mailbox-switcher-item"
      backTestId="mailbox-switcher-back-button"
    />
  )
}
