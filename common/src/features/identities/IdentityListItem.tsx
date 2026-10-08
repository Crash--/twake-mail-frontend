import { Pen, Trash } from '@linagora/twake-icons'
import { Box, Chip, Radio } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SettingsRowButton } from '@/ds/SettingsButtons/SettingsButtons'
import {
  SettingsListItem,
  SettingsListText
} from '@/ds/SettingsList/SettingsList'
import { useI18n } from '@common/i18n/useI18n'

import { formatIdentityAddresses, signaturePreview } from './identityForm'
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
 * An identity in Settings > Profiles, as tmail-flutter lists it: name,
 * address, Reply-To, Bcc and the start of the signature, the radio making
 * it the default one, edit and delete (not for the identity of the account).
 */
export function IdentityListItem({
  identity,
  isDefault,
  withDefaultRadio,
  onEdit,
  onDelete
}: IdentityListItemProps): ReactElement {
  const { t } = useI18n()
  const editLabel = t('identities.editOf', { name: identity.name })
  const deleteLabel = t('identities.deleteOf', { name: identity.name })
  const replyTo = formatIdentityAddresses(identity.replyTo)
  const bcc = formatIdentityAddresses(identity.bcc)
  const signature = signaturePreview(identity)

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
            slotProps={{
              input: {
                'aria-label': t('identities.setDefaultOf', {
                  name: identity.name
                })
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
            icon={Pen}
            onClick={() => {
              onEdit(identity)
            }}
            data-testid="identity-edit-button"
          />
          {identity.mayDelete ? (
            <SettingsRowButton
              label={t('common.delete')}
              name={deleteLabel}
              icon={Trash}
              onClick={event => {
                onDelete(identity, event.currentTarget)
              }}
              data-testid="identity-delete-button"
            />
          ) : null}
        </>
      }
    >
      <Box className="u-flex u-flex-items-center u-flex-wrap">
        <SettingsListText
          variant="name"
          className="u-mr-half"
          data-testid="identity-item-name"
        >
          {identity.name}
        </SettingsListText>
        {isDefault ? (
          <Chip
            size="small"
            label={t('identities.defaultBadge')}
            className="u-mb-half"
            data-testid="identity-default-badge"
          />
        ) : null}
      </Box>
      <SettingsListText variant="detail">{identity.email}</SettingsListText>
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
        <SettingsListText variant="detail">{`-- ${signature}`}</SettingsListText>
      )}
      {identity.mayDelete ? null : (
        <SettingsListText variant="detail">
          {t('identities.cannotDelete')}
        </SettingsListText>
      )}
    </SettingsListItem>
  )
}
