import {
  CheckCircle,
  Icon,
  Trash,
  PenOutlined,
  RadioUnchecked
} from '@linagora/twake-icons'
import { Radio } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { ActionIconButton } from '@/ds/ActionIconButton/ActionIconButton'
import {
  SettingsListHtml,
  SettingsListItem,
  SettingsListText
} from '@/ds/SettingsList/SettingsList'
import { useI18n } from '@common/i18n/useI18n'

import { formatIdentityAddresses, signatureHtml } from './identityForm'
import { identityDisplayName } from './identityName'
import type { IdentitySummary } from './queries'

export interface IdentityListItemProps {
  identity: IdentitySummary
  isDefault: boolean
  /** Shows the radio choosing the default identity (`sortOrder` extension) */
  withDefaultRadio: boolean
  onEdit: (identity: IdentitySummary) => void
  /** `opener`: the delete button, where the focus is */
  onDelete: (identity: IdentitySummary, opener: HTMLElement) => void
}

/**
 * An identity in Settings > Profiles, as the Figma lists it: the radio
 * making it the default one, name, address, Reply-To, Bcc, then "Edit" and
 * "Delete" (no delete for the identity of the account, which the server
 * keeps), and the signature as it is written under the row.
 */
export function IdentityListItem({
  identity,
  isDefault,
  withDefaultRadio,
  onEdit,
  onDelete
}: IdentityListItemProps): ReactElement {
  const { t } = useI18n()
  const displayName = identityDisplayName(identity)
  const label = displayName ?? identity.email
  const editLabel = t('identities.editOf', { name: label })
  const deleteLabel = t('identities.deleteOf', { name: label })
  const replyTo = formatIdentityAddresses(identity.replyTo)
  const bcc = formatIdentityAddresses(identity.bcc)
  const signature = signatureHtml(identity)

  return (
    <SettingsListItem
      data-testid="identity-item"
      dataAttributes={{
        'data-identity-name': identity.name,
        'data-default': isDefault || undefined
      }}
      leading={
        withDefaultRadio ? (
          <Radio
            value={identity.id}
            // The Figma's ring, a check in a disc once it is the default one
            icon={<Icon icon={RadioUnchecked} size={18} />}
            checkedIcon={<Icon icon={CheckCircle} size={18} />}
            slotProps={{
              input: {
                'aria-label': t('identities.setDefaultOf', { name: label })
              }
            }}
            data-testid="identity-default-radio"
          />
        ) : null
      }
      actions={
        <>
          <ActionIconButton
            label={editLabel}
            onClick={() => {
              onEdit(identity)
            }}
            data-testid="identity-edit-button"
          >
            <Icon icon={PenOutlined} size={18} aria-hidden="true" />
          </ActionIconButton>
          {identity.mayDelete ? (
            <ActionIconButton
              label={deleteLabel}
              onClick={event => {
                onDelete(identity, event.currentTarget)
              }}
              data-testid="identity-delete-button"
            >
              <Icon icon={Trash} size={18} aria-hidden="true" />
            </ActionIconButton>
          ) : null}
        </>
      }
      footer={
        signature === '' ? undefined : (
          <SettingsListHtml
            html={signature}
            data-testid="identity-item-signature"
          />
        )
      }
    >
      <SettingsListText variant="name" data-testid="identity-item-name">
        {label}
      </SettingsListText>
      {/* Without a name, the address is already the title */}
      {displayName === null ? null : (
        <SettingsListText variant="detail">{identity.email}</SettingsListText>
      )}
      {replyTo === '' ? null : (
        <SettingsListText variant="detail">
          <span className="u-uppercase">{t('identities.form.replyTo')}</span>
          {`: ${replyTo}`}
        </SettingsListText>
      )}
      {bcc === '' ? null : (
        <SettingsListText variant="detail">
          <span className="u-uppercase">{t('email.bcc')}</span>
          {`: ${bcc}`}
        </SettingsListText>
      )}
    </SettingsListItem>
  )
}
