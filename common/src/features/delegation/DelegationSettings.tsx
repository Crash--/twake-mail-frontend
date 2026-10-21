import { Alert, Box, Button, Tab, Tabs, Typography } from '@linagora/twake-mui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type ReactElement } from 'react'

import { Plus, Trash } from '@/ds/FlutterIcons/FlutterIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import {
  PeopleColumn,
  PeopleEmptyCard,
  PeopleList,
  type Person
} from '@/ds/PeopleList/PeopleList'
import { SettingsPrimaryButton } from '@/ds/SettingsButtons/SettingsButtons'
import { useFocusFallback } from '@/ds/useFocusFallback/useFocusFallback'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { reloadSession } from '@common/jmap/queries'

import { AddDelegatesDialog } from './AddDelegatesDialog'
import {
  addDelegates,
  delegatedAccountsQueryOptions,
  delegatesQueryOptions,
  delegationKeys,
  removeDelegate,
  removeDelegatedAccount,
  type Delegation
} from './queries'
import { RemoveAccessDialog } from './RemoveAccessDialog'
import { useContactNames } from './useContactNames'

type DelegationTab = 'delegates' | 'delegated'

export interface DelegationSettingsProps {
  section: SettingsSection
}

/**
 * Settings > Delegation (tmail-flutter#4977, James delegation extension):
 * "My delegates", the people of the domain the user gave full access to
 * their mailbox (added, removed), and "Delegated to me", the mailboxes the
 * user may open from the mailbox switcher (their own access removable).
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
  const [removing, setRemoving] = useState<{
    tab: DelegationTab
    delegation: Delegation
  } | null>(null)
  const focusFallbackRef = useFocusFallback<HTMLSpanElement>()

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
      if (added.length > 0) setIsAdding(false)
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

  const handleRemove = async (): Promise<void> => {
    if (removing === null) return
    const { delegation } = removing
    const name = nameOf(delegation.username)
    try {
      const isRemoved =
        removing.tab === 'delegates'
          ? await removeDelegate(client, ownAccountId, delegation.id)
          : await removeDelegatedAccount(client, ownAccountId, delegation.id)
      await refresh()
      if (!isRemoved) throw new Error('Delegation not destroyed')
      // A mailbox delegated to the user leaves the session, and the switcher
      if (removing.tab === 'delegated') await reloadSession(client, queryClient)
      notify({
        message:
          removing.tab === 'delegates'
            ? t('delegation.toasts.removed', { name })
            : t('delegation.toasts.left', { name }),
        severity: 'success'
      })
      setRemoving(null)
    } catch (error: unknown) {
      console.error('[delegation] Cannot remove the delegation', error)
      notify({ message: t('delegation.errors.remove'), severity: 'error' })
    }
  }

  const removeButton = (
    delegation: Delegation,
    of: DelegationTab
  ): ReactElement => (
    <span ref={focusFallbackRef}>
      <IconAction
        label={
          of === 'delegates'
            ? t('delegation.remove.delegateOf', {
                name: nameOf(delegation.username)
              })
            : t('delegation.remove.ownOf', {
                name: nameOf(delegation.username)
              })
        }
        icon={Trash}
        tone="steel"
        size={36}
        onClick={() => {
          setRemoving({ tab: of, delegation })
        }}
        data-testid="delegation-remove-button"
      />
    </span>
  )

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
            : removeButton(delegation, 'delegates')
        }}
        data-testid="delegation-delegates-list"
        itemTestId="delegation-delegate-item"
      />
      <Box className="u-mt-1">{addButton}</Box>
    </>
  )

  const delegatedPanel = delegated.isPending ? (
    <LoadingListSkeleton count={2} />
  ) : delegated.isError ? (
    renderError(() => {
      void delegated.refetch()
    })
  ) : delegated.data.length === 0 ? (
    <PeopleEmptyCard
      title={t('delegation.delegated.emptyTitle')}
      text={t('delegation.delegated.emptyText')}
      data-testid="delegation-delegated-empty"
    />
  ) : (
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
            : removeButton(delegation, 'delegated')
        }}
        data-testid="delegation-delegated-list"
        itemTestId="delegation-delegated-item"
      />
    </>
  )

  const removingName =
    removing === null ? '' : nameOf(removing.delegation.username)

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
          onAdd={handleAdd}
          onClose={() => {
            setIsAdding(false)
          }}
        />
      ) : null}
      {removing === null ? null : (
        <RemoveAccessDialog
          title={
            removing.tab === 'delegates'
              ? t('delegation.remove.delegateTitle')
              : t('delegation.remove.ownTitle')
          }
          text={
            removing.tab === 'delegates'
              ? t('delegation.remove.delegateText', {
                  email: removing.delegation.username
                })
              : t('delegation.remove.ownText', {
                  email: removing.delegation.username
                })
          }
          person={{
            id: removing.delegation.id,
            name: removingName,
            address: removing.delegation.username,
            avatarKey: removing.delegation.username
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
