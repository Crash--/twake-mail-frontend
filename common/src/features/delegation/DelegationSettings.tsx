import { Alert, Box, Button, Tab, Tabs, Typography } from '@linagora/twake-mui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type ReactElement } from 'react'

import { Plus, Trash } from '@/ds/FlutterIcons/FlutterIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import {
  PeopleColumn,
  PeopleEmptyCard,
  PeopleList,
  type Person
} from '@/ds/PeopleList/PeopleList'
import { SettingsPrimaryButton } from '@/ds/SettingsButtons/SettingsButtons'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import {
  isTeamRoot,
  teamMailboxAddress
} from '@common/features/mailbox/mailboxTree'
import {
  mailboxesQueryOptions,
  mailboxKeys
} from '@common/features/mailbox/queries'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { TEAM_MAILBOXES_CAPABILITY } from '@common/jmap/methodCapabilities'
import { reloadSession } from '@common/jmap/queries'

import { AddDelegatesDialog } from './AddDelegatesDialog'
import {
  addDelegates,
  delegatedAccountsQueryOptions,
  delegatesQueryOptions,
  delegationKeys,
  leaveTeamMailbox,
  removeDelegate,
  removeDelegatedAccount,
  type Delegation
} from './queries'
import { RemoveAccessDialog } from './RemoveAccessDialog'
import { useContactNames } from './useContactNames'

type DelegationTab = 'delegates' | 'delegated'

/** The buttons of the panel taking an access back, in their order */
const REMOVE_BUTTONS =
  '[data-testid="delegation-remove-button"], [data-testid="delegation-leave-team-button"]'

/**
 * Where the focus goes once a dialog has closed on a change: "+ Add"
 * after an addition; after a removal, the button that took the place of
 * the one which opened the dialog, else the one before, else "+ Add" or
 * the tab
 */
type FocusRequest = { kind: 'add' } | { kind: 'remove'; index: number }

/** An access the user takes back, or gives up */
interface Removal {
  of: DelegationTab | 'team'
  /** The id of the delegation, or of the root of the team mailbox */
  id: string
  address: string
}

export interface DelegationSettingsProps {
  section: SettingsSection
}

/**
 * Settings > Delegation (tmail-flutter#4977, James delegation extension):
 * "My delegates", the people of the domain the user gave full access to
 * their mailbox (added, removed), and "Delegated to me", the mailboxes the
 * user may open from the mailbox switcher, delegated ones then their team
 * mailboxes, each of which they may leave (`TeamMailbox/revokeAccess`).
 */
export function DelegationSettings({
  section
}: DelegationSettingsProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { ownAccountId, session } = useJmapSession()
  const { notify } = useNotify()
  const tabsId = useId()
  const [tab, setTab] = useState<DelegationTab>('delegates')
  const delegates = useQuery(delegatesQueryOptions(client, ownAccountId))
  const delegated = useQuery(
    delegatedAccountsQueryOptions(client, ownAccountId)
  )
  const isTeamOffered = TEAM_MAILBOXES_CAPABILITY in session.capabilities
  const ownMailboxes = useQuery({
    ...mailboxesQueryOptions(client, ownAccountId),
    enabled: isTeamOffered
  })
  const teams = (ownMailboxes.data?.list ?? [])
    .filter(isTeamRoot)
    .map(root => ({
      id: root.id,
      name: root.name,
      address: teamMailboxAddress(root) ?? root.name
    }))
  const names = useContactNames([
    ...(delegates.data ?? []).map(delegation => delegation.username),
    ...(delegated.data ?? []).map(delegation => delegation.username)
  ])
  const nameOf = (address: string): string => names[address] ?? address
  const personOf = (delegation: Delegation): Person => {
    const name = nameOf(delegation.username)
    return {
      id: delegation.id,
      name,
      address: name === delegation.username ? null : delegation.username,
      avatarKey: delegation.username
    }
  }
  const [isAdding, setIsAdding] = useState(false)
  const [removing, setRemoving] = useState<Removal | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /**
   * The dialogs leave the page on closing: the focus they give back would
   * go to the element that opened them, gone with the change
   */
  const focusRequest = useRef<FocusRequest | null>(null)

  useEffect(() => {
    const request = focusRequest.current
    const panel = panelRef.current
    if (request === null || panel === null || isAdding || removing !== null) {
      return undefined
    }
    focusRequest.current = null
    // After the focus trap of the dialog gave the focus back; not undone
    // by the renders that follow (the toast)
    setTimeout(() => {
      if (!panel.isConnected) return
      const removeButtons = Array.from(
        panel.querySelectorAll<HTMLElement>(REMOVE_BUTTONS)
      )
      const addButton = panel.querySelector<HTMLElement>(
        '[data-testid="delegation-add-button"]'
      )
      const target =
        request.kind === 'add'
          ? addButton
          : (removeButtons[Math.min(request.index, removeButtons.length - 1)] ??
            addButton ??
            panel.ownerDocument.getElementById(`${tabsId}-${tab}-tab`))
      target?.focus()
    }, 0)
    return undefined
  })

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: delegationKeys.all(ownAccountId)
    })
  }

  const handleAdd = async (
    addresses: readonly string[],
    addedNames: Readonly<Record<string, string>>
  ): Promise<void> => {
    try {
      const refused = await addDelegates(client, ownAccountId, addresses)
      await refresh()
      const added = addresses.filter(address => !refused.includes(address))
      if (added.length > 0) {
        notify({
          message:
            added.length === 1
              ? t('delegation.toasts.added', {
                  name: addedNames[added[0] ?? ''] ?? added[0] ?? ''
                })
              : t('delegation.toasts.addedMany', {
                  smart_count: added.length
                }),
          severity: 'success'
        })
      }
      if (refused.length > 0) {
        notify({
          message: t('delegation.errors.add', {
            addresses: refused.join(', ')
          }),
          severity: 'error'
        })
      }
      // Kept open only when no one was added, to correct the addresses
      if (added.length > 0) {
        focusRequest.current = { kind: 'add' }
        setIsAdding(false)
      }
    } catch (error: unknown) {
      console.error('[delegation] Cannot add the delegates', error)
      notify({
        message: t('delegation.errors.add', {
          addresses: addresses.join(', ')
        }),
        severity: 'error'
      })
    }
  }

  const teamNameOf = (id: string): string =>
    teams.find(team => team.id === id)?.name ?? id
  const removalName = (removal: Removal): string =>
    removal.of === 'team' ? teamNameOf(removal.id) : nameOf(removal.address)

  const remove = async (removal: Removal): Promise<boolean> => {
    switch (removal.of) {
      case 'delegates':
        return removeDelegate(client, ownAccountId, removal.id)
      case 'delegated':
        return removeDelegatedAccount(client, ownAccountId, removal.id)
      case 'team':
        return leaveTeamMailbox(client, ownAccountId, removal.address)
    }
  }

  /** The place of the button that opened the removal, among them */
  const removingIndex = useRef(0)

  const handleRemove = async (): Promise<void> => {
    if (removing === null) return
    const name = removalName(removing)
    try {
      const isRemoved = await remove(removing)
      await (removing.of === 'team'
        ? // Its folders leave the tree, the switcher, and its view if shown
          queryClient.invalidateQueries({
            queryKey: mailboxKeys.all(ownAccountId)
          })
        : refresh())
      if (!isRemoved) throw new Error('Access not removed')
      // A mailbox delegated to the user leaves the session, and the switcher
      if (removing.of === 'delegated') await reloadSession(client, queryClient)
      notify({
        message:
          removing.of === 'delegates'
            ? t('delegation.toasts.removed', { name })
            : removing.of === 'delegated'
              ? t('delegation.toasts.left', { name })
              : t('delegation.toasts.leftTeam', { name }),
        severity: 'success'
      })
      focusRequest.current = { kind: 'remove', index: removingIndex.current }
      setRemoving(null)
    } catch (error: unknown) {
      console.error('[delegation] Cannot remove the delegation', error)
      notify({ message: t('delegation.errors.remove'), severity: 'error' })
    }
  }

  const removeLabel = (removal: Removal): string => {
    const name = removalName(removal)
    switch (removal.of) {
      case 'delegates':
        return t('delegation.remove.delegateOf', { name })
      case 'delegated':
        return t('delegation.remove.ownOf', { name })
      case 'team':
        return t('delegation.remove.teamOf', { name })
    }
  }

  const removeButton = (removal: Removal): ReactElement => (
    <IconAction
      label={removeLabel(removal)}
      icon={Trash}
      tone="steel"
      size={36}
      onClick={event => {
        const buttons = Array.from(
          panelRef.current?.querySelectorAll(REMOVE_BUTTONS) ?? []
        )
        removingIndex.current = Math.max(
          0,
          buttons.indexOf(event.currentTarget)
        )
        setRemoving(removal)
      }}
      data-testid={
        removal.of === 'team'
          ? 'delegation-leave-team-button'
          : 'delegation-remove-button'
      }
    />
  )
  const delegationRemoval = (
    delegation: Delegation,
    of: DelegationTab
  ): Removal => ({ of, id: delegation.id, address: delegation.username })

  const addButton = (
    <SettingsPrimaryButton
      label={t('delegation.add.open')}
      icon={Plus}
      onClick={() => {
        setIsAdding(true)
      }}
      data-testid="delegation-add-button"
    />
  )

  const renderError = (retry: () => void): ReactElement => (
    <Alert
      severity="error"
      action={
        <Button color="inherit" onClick={retry}>
          {t('common.retry')}
        </Button>
      }
    >
      {t('delegation.errors.load')}
    </Alert>
  )

  const delegatesPanel = delegates.isPending ? (
    <LoadingListSkeleton count={2} />
  ) : delegates.isError ? (
    renderError(() => {
      void delegates.refetch()
    })
  ) : delegates.data.length === 0 ? (
    <PeopleEmptyCard
      title={t('delegation.delegates.emptyTitle')}
      text={t('delegation.delegates.emptyText')}
      action={addButton}
      data-testid="delegation-delegates-empty"
    />
  ) : (
    <>
      <Typography component="h2" variant="subtitle1" className="u-mb-half">
        {t('delegation.delegates.listTitle')}
      </Typography>
      <PeopleList
        label={t('delegation.delegates.listTitle')}
        people={delegates.data.map(personOf)}
        renderAction={person => {
          const delegation = delegates.data.find(one => one.id === person.id)
          return delegation === undefined
            ? null
            : removeButton(delegationRemoval(delegation, 'delegates'))
        }}
        data-testid="delegation-delegates-list"
        itemTestId="delegation-delegate-item"
      />
      <Box className="u-mt-1">{addButton}</Box>
    </>
  )

  const delegatedList =
    delegated.data === undefined || delegated.data.length === 0 ? null : (
      <>
        <Typography component="h2" variant="subtitle1" className="u-mb-half">
          {t('delegation.delegated.listTitle', {
            smart_count: delegated.data.length
          })}
        </Typography>
        <PeopleList
          label={t('delegation.delegated.listTitle', {
            smart_count: delegated.data.length
          })}
          people={delegated.data.map(personOf)}
          renderAction={person => {
            const delegation = delegated.data.find(one => one.id === person.id)
            return delegation === undefined
              ? null
              : removeButton(delegationRemoval(delegation, 'delegated'))
          }}
          data-testid="delegation-delegated-list"
          itemTestId="delegation-delegated-item"
        />
      </>
    )

  const teamList =
    teams.length === 0 ? null : (
      <Box className={delegatedList === null ? undefined : 'u-mt-1-half'}>
        <Typography component="h2" variant="subtitle1" className="u-mb-half">
          {t('delegation.teams.listTitle', { smart_count: teams.length })}
        </Typography>
        <PeopleList
          label={t('delegation.teams.listTitle', {
            smart_count: teams.length
          })}
          people={teams.map(team => ({
            id: team.id,
            name: team.name,
            address: team.address,
            avatarKey: team.address
          }))}
          renderAction={person => {
            const team = teams.find(one => one.id === person.id)
            return team === undefined
              ? null
              : removeButton({ of: 'team', id: team.id, address: team.address })
          }}
          data-testid="delegation-team-list"
          itemTestId="delegation-team-item"
        />
      </Box>
    )

  const delegatedPanel =
    delegated.isPending || (isTeamOffered && ownMailboxes.isPending) ? (
      <LoadingListSkeleton count={2} />
    ) : delegated.isError ? (
      renderError(() => {
        void delegated.refetch()
      })
    ) : delegatedList === null && teamList === null ? (
      <PeopleEmptyCard
        title={t('delegation.delegated.emptyTitle')}
        text={t('delegation.delegated.emptyText')}
        data-testid="delegation-delegated-empty"
      />
    ) : (
      <>
        {delegatedList}
        {teamList}
      </>
    )

  return (
    <SettingsSectionLayout section={section}>
      <PeopleColumn>
        {/* Its tabs as wide as their labels, as the maquette */}
        <Box className="u-flex u-mb-1">
          <Tabs
            segmented
            value={tab}
            onChange={(_, value: DelegationTab) => {
              setTab(value)
            }}
            aria-label={t('settings.sections.delegation.title')}
          >
            <Tab
              value="delegates"
              label={t('delegation.tabs.delegates')}
              id={`${tabsId}-delegates-tab`}
              aria-controls={`${tabsId}-delegates-panel`}
              data-testid="delegation-delegates-tab"
            />
            <Tab
              value="delegated"
              label={t('delegation.tabs.delegated')}
              id={`${tabsId}-delegated-tab`}
              aria-controls={`${tabsId}-delegated-panel`}
              data-testid="delegation-delegated-tab"
            />
          </Tabs>
        </Box>
        <Box
          ref={panelRef}
          role="tabpanel"
          id={`${tabsId}-${tab}-panel`}
          aria-labelledby={`${tabsId}-${tab}-tab`}
          data-testid={`delegation-${tab}-panel`}
        >
          <Typography component="p" className="u-mb-1-half">
            {tab === 'delegates'
              ? t('delegation.delegates.intro')
              : t('delegation.delegated.intro')}
          </Typography>
          {tab === 'delegates' ? delegatesPanel : delegatedPanel}
        </Box>
      </PeopleColumn>
      {isAdding ? (
        <AddDelegatesDialog
          ownAddress={session.username}
          delegates={(delegates.data ?? []).map(one => one.username)}
          teamMailboxes={teams.map(team => team.address)}
          onAdd={handleAdd}
          onClose={() => {
            setIsAdding(false)
          }}
        />
      ) : null}
      {removing === null ? null : (
        <RemoveAccessDialog
          title={
            removing.of === 'delegates'
              ? t('delegation.remove.delegateTitle')
              : removing.of === 'delegated'
                ? t('delegation.remove.ownTitle')
                : t('delegation.remove.teamTitle')
          }
          text={
            removing.of === 'delegates'
              ? t('delegation.remove.delegateText', {
                  email: removing.address
                })
              : removing.of === 'delegated'
                ? t('delegation.remove.ownText', { email: removing.address })
                : t('delegation.remove.teamText', { email: removing.address })
          }
          person={{
            id: removing.id,
            name: removalName(removing),
            address: removing.address,
            avatarKey: removing.address
          }}
          onRemove={handleRemove}
          onClose={() => {
            setRemoving(null)
          }}
        />
      )}
    </SettingsSectionLayout>
  )
}
