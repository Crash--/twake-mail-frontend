import { Icon, Pen, Trash } from '@linagora/twake-icons'
import {
  Box,
  Chip,
  IconButton,
  ListItem,
  Radio,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { formatIdentityAddresses, signaturePreview } from './identityForm'
import type { IdentitySummary } from './queries'

export interface IdentityListItemProps {
  identity: IdentitySummary
  isDefault: boolean
  /** Shows the radio choosing the default identity (`sortOrder` extension) */
  withDefaultRadio: boolean
  onEdit: (identity: IdentitySummary) => void
  onDelete: (identity: IdentitySummary) => void
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
    <ListItem
      divider
      className="u-flex-items-start"
      data-testid="identity-item"
      data-identity-name={identity.name}
      data-default={isDefault || undefined}
    >
      {withDefaultRadio ? (
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
      ) : null}
      <Box className="u-flex-auto u-ov-hidden u-mv-half u-ml-half">
        <Box className="u-flex u-flex-items-center u-flex-wrap">
          <Typography
            component="span"
            className="u-fw-bold u-breakword u-mr-half"
            data-testid="identity-item-name"
          >
            {identity.name}
          </Typography>
          {isDefault ? (
            <Chip
              size="small"
              label={t('identities.defaultBadge')}
              data-testid="identity-default-badge"
            />
          ) : null}
        </Box>
        <SecondaryText variant="body2" component="p" className="u-breakword">
          {identity.email}
        </SecondaryText>
        {replyTo === '' ? null : (
          <SecondaryText variant="body2" component="p" className="u-breakword">
            {`${t('identities.form.replyTo')}: ${replyTo}`}
          </SecondaryText>
        )}
        {bcc === '' ? null : (
          <SecondaryText variant="body2" component="p" className="u-breakword">
            {`${t('email.bcc')}: ${bcc}`}
          </SecondaryText>
        )}
        {signature === '' ? null : (
          <SecondaryText variant="body2" component="p" className="u-ellipsis">
            {`-- ${signature}`}
          </SecondaryText>
        )}
        {identity.mayDelete ? null : (
          <SecondaryText variant="caption" component="p">
            {t('identities.cannotDelete')}
          </SecondaryText>
        )}
      </Box>
      <Tooltip title={editLabel}>
        <IconButton
          aria-label={editLabel}
          onClick={() => {
            onEdit(identity)
          }}
          data-testid="identity-edit-button"
        >
          <Icon icon={Pen} />
        </IconButton>
      </Tooltip>
      {identity.mayDelete ? (
        <Tooltip title={deleteLabel}>
          <IconButton
            aria-label={deleteLabel}
            onClick={() => {
              onDelete(identity)
            }}
            data-testid="identity-delete-button"
          >
            <Icon icon={Trash} />
          </IconButton>
        </Tooltip>
      ) : null}
    </ListItem>
  )
}
