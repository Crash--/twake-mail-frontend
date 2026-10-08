import { Alert, Button, RadioGroup } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent, type ReactElement } from 'react'

import { Plus } from '@/ds/FlutterIcons/FlutterIcons'
import { SettingsPrimaryButton } from '@/ds/SettingsButtons/SettingsButtons'
import { SettingsList } from '@/ds/SettingsList/SettingsList'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import {
  focusTargetsAround,
  keepFocusInPage
} from '@common/utils/keepFocusInPage'

import { defaultIdentityId, publicAssetIdsIn } from './identityForm'
import { IdentityFormDialog } from './IdentityFormDialog'
import { IdentityListItem } from './IdentityListItem'
import { deleteIdentity, setDefaultIdentity } from './identityMutations'
import {
  IDENTITY_SORT_ORDER_CAPABILITY,
  identityKeys,
  type IdentitySummary
} from './queries'
import { applySignatureAssetChanges } from './signatureAssets'
import { useIdentities } from './useIdentities'

export interface IdentitiesSettingsProps {
  section: SettingsSection
}

/** The identity form, closed, or open on an identity (null: a new one) */
type FormState = { identity: IdentitySummary | null } | null

/**
 * Settings > Profiles: the identities the user sends from (`Identity/set`),
 * created, edited, deleted, and the default one chosen when the server
 * sorts identities (`select_identity_as_default`).
 */
export function IdentitiesSettings({
  section
}: IdentitiesSettingsProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, session } = useJmapSession()
  const { notify } = useNotify()
  const confirm = useConfirm()
  const query = useIdentities()
  const [form, setForm] = useState<FormState>(null)
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null)
  const hasSortOrder = IDENTITY_SORT_ORDER_CAPABILITY in session.capabilities
  const identities = query.data ?? []
  const defaultId = pendingDefaultId ?? defaultIdentityId(identities)

  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: identityKeys.all(accountId) })

  const handleDefaultChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const id = event.target.value
    if (id === defaultId) return
    setPendingDefaultId(id)
    setDefaultIdentity(client, accountId, id, identities)
      .then(async result => {
        await refresh()
        notify(
          result.ok
            ? {
                message: t('identities.toasts.defaultSet'),
                severity: 'success'
              }
            : { message: t('identities.errors.save'), severity: 'error' }
        )
      })
      .catch((error: unknown) => {
        console.error('[identities] Cannot change the default one', error)
        notify({ message: t('identities.errors.save'), severity: 'error' })
      })
      .finally(() => {
        setPendingDefaultId(null)
      })
  }

  const handleDelete = (
    identity: IdentitySummary,
    opener: HTMLElement
  ): void => {
    const focusTargets = focusTargetsAround(opener)
    const run = async (): Promise<void> => {
      const isConfirmed = await confirm({
        title: t('identities.delete.title'),
        message: t('identities.delete.message'),
        confirmLabel: t('common.delete'),
        isDestructive: true
      })
      if (!isConfirmed) return
      // Its signature images are not its own anymore (tmail-flutter)
      const assets = publicAssetIdsIn(identity.htmlSignature)
      if (assets.length > 0) {
        await applySignatureAssetChanges(client, accountId, identity.id, {
          destroy: [],
          release: assets,
          tie: []
        }).catch((error: unknown) => {
          console.warn('[identities] Signature images not released', error)
        })
      }
      const result = await deleteIdentity(client, accountId, identity.id)
      await refresh()
      notify(
        result.ok
          ? { message: t('identities.toasts.deleted'), severity: 'success' }
          : { message: t('identities.errors.delete'), severity: 'error' }
      )
      if (result.ok) keepFocusInPage(focusTargets)
    }
    run().catch((error: unknown) => {
      console.error('[identities] Cannot delete the identity', error)
      notify({ message: t('identities.errors.delete'), severity: 'error' })
    })
  }

  const list = (
    <SettingsList label={t('identities.listLabel')} data-testid="identity-list">
      {identities.map(identity => (
        <IdentityListItem
          key={identity.id}
          identity={identity}
          isDefault={hasSortOrder && identity.id === defaultId}
          withDefaultRadio={hasSortOrder}
          onEdit={edited => {
            setForm({ identity: edited })
          }}
          onDelete={handleDelete}
        />
      ))}
    </SettingsList>
  )

  return (
    <SettingsSectionLayout
      section={section}
      actions={
        <SettingsPrimaryButton
          label={t('identities.create')}
          icon={Plus}
          onClick={() => {
            setForm({ identity: null })
          }}
          data-testid="create-new-identity-button"
        />
      }
    >
      {query.isPending ? (
        <LoadingListSkeleton count={3} />
      ) : query.isError ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => {
                void query.refetch()
              }}
            >
              {t('common.retry')}
            </Button>
          }
        >
          {t('identities.errors.load')}
        </Alert>
      ) : hasSortOrder ? (
        <RadioGroup
          aria-label={t('identities.defaultGroup')}
          value={defaultId ?? ''}
          onChange={handleDefaultChange}
        >
          {list}
        </RadioGroup>
      ) : (
        list
      )}
      {form === null ? null : (
        <IdentityFormDialog
          identity={form.identity}
          identities={identities}
          hasSortOrder={hasSortOrder}
          onClose={() => {
            setForm(null)
          }}
        />
      )}
    </SettingsSectionLayout>
  )
}
