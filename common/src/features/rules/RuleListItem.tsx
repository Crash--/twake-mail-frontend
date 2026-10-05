import { Icon, Pen, Trash } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  ListItem,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { Rule } from 'jmap-client-ts/linagora'
import type { ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { ruleComparatorLabel, ruleConditions, ruleFieldLabel } from './rules'

export interface RuleListItemProps {
  rule: Rule
  onEdit: () => void
  onDelete: () => void
}

/**
 * A rule in Settings > Email rules: its name and its first condition, as
 * tmail-flutter shows them ("From, contains: alice@example.com"), then
 * edit and delete
 */
export function RuleListItem({
  rule,
  onEdit,
  onDelete
}: RuleListItemProps): ReactElement {
  const { t } = useI18n()
  const [first] = ruleConditions(rule)
  const field = first ? ruleFieldLabel(first.field) : null
  const comparator = first ? ruleComparatorLabel(first.comparator) : null
  const summary = first
    ? `${field === null ? first.field : t(field)}, ${(comparator === null ? first.comparator : t(comparator)).toLowerCase()}: ${first.value}`
    : null
  const editLabel = t('rules.editOf', { name: rule.name })
  const deleteLabel = t('rules.deleteOf', { name: rule.name })

  return (
    <ListItem divider data-testid="email-rule-item" data-rule-name={rule.name}>
      <Box className="u-flex-auto u-ov-hidden u-mv-half">
        <Typography
          className="u-fw-bold u-breakword"
          data-testid="email-rule-name"
        >
          {rule.name}
        </Typography>
        {summary === null ? null : (
          <SecondaryText variant="body2" className="u-breakword">
            {summary}
          </SecondaryText>
        )}
      </Box>
      <Tooltip title={editLabel}>
        <IconButton
          aria-label={editLabel}
          onClick={onEdit}
          data-testid="email-rule-edit-button"
        >
          <Icon icon={Pen} />
        </IconButton>
      </Tooltip>
      <Tooltip title={deleteLabel}>
        <IconButton
          aria-label={deleteLabel}
          onClick={onDelete}
          data-testid="email-rule-delete-button"
        >
          <Icon icon={Trash} />
        </IconButton>
      </Tooltip>
    </ListItem>
  )
}
