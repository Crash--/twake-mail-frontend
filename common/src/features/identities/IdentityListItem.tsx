import { Icon } from '@linagora/twake-icons'
import { Radio } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import {
  DeleteFilled,
  EditPen,
  RadioOff,
  RadioOn
} from '@/ds/FlutterIcons/FlutterIcons'
import { SettingsRowButton } from '@/ds/SettingsButtons/SettingsButtons'
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
 * An identity in Settings > Profiles, as tmail-flutter lists it: the radio
 * making it the default one, name, address, Reply-To, Bcc, "--" and the
 * signature as it is written, then "Edit" and "Delete" (no delete for the
 * identity of the account, which the server keeps).
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
            // tmail-flutter's ring, filled once it is the default one
            icon={<Icon icon={RadioOff} size={18} />}
            checkedIcon={<Icon icon={RadioOn} size={18} />}
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
          <SettingsRowButton
            label={t('common.edit')}
            name={editLabel}
            icon={EditPen}
            onClick={() => {
              onEdit(identity)
            }}
            data-testid="identity-edit-button"
          />
          {identity.mayDelete ? (
            <SettingsRowButton
              label={t('common.delete')}
              name={deleteLabel}
              icon={DeleteFilled}
              onClick={event => {
                onDelete(identity, event.currentTarget)
              }}
              data-testid="identity-delete-button"
            />
          ) : null}
        </>
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
      {signature === '' ? null : (
        <>
          <SettingsListText variant="mark">--</SettingsListText>
          <SettingsListHtml
            html={signature}
            data-testid="identity-item-signature"
          />
        </>
      )}
    </SettingsListItem>
  )
}
