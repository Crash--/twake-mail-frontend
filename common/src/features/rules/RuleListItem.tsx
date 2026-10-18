import { Icon } from '@linagora/twake-icons'
import { ListItemIcon, ListItemText, MenuItem } from '@linagora/twake-mui'
import type { Rule } from 'jmap-client-ts/linagora'
import { useRef, useState, type ReactElement } from 'react'

import { ActionSheet } from '@/ds/ActionSheet/ActionSheet'
import { Bottom, Edit, Top, Trash } from '@/ds/FlutterIcons/FlutterIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import { MoreVerticalIcon } from '@/ds/ListIcons/ListIcons'
import { SettingsCard } from '@/ds/SettingsCards/SettingsCards'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useI18n } from '@common/i18n/useI18n'

import { ruleComparatorLabel, ruleConditions, ruleFieldText } from './rules'

export interface RuleListItemProps {
  rule: Rule
  onEdit: () => void
  /** `opener`: the button the deletion came from, where the focus is */
  onDelete: (opener: HTMLElement) => void
  /**
   * Moves it one place up or down (the first matching rule wins); `opener`:
   * the button the move came from. Null when it cannot move that way.
   */
  onMoveUp: ((opener: HTMLElement) => void) | null
  onMoveDown: ((opener: HTMLElement) => void) | null
}

/**
 * A rule in Settings > Email rules, as tmail-flutter's card: its name, its
 * first condition in a grey pill ("From, contains: alice@example.com"),
 * then move up and down, edit and delete; on a phone the name alone and
 * "More", opening them in a sheet from the bottom edge
 */
export function RuleListItem({
  rule,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown
}: RuleListItemProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const moreRef = useRef<HTMLButtonElement>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [first] = ruleConditions(rule)
  const comparator = first ? ruleComparatorLabel(first.comparator) : null
  const summary = first
    ? `${ruleFieldText(first.field, t)}, ${(comparator === null ? first.comparator : t(comparator)).toLowerCase()}: ${first.value}`
    : null
  const editLabel = t('rules.editOf', { name: rule.name })
  const deleteLabel = t('rules.deleteOf', { name: rule.name })
  const moveUpLabel = t('rules.moveUpOf', { name: rule.name })
  const moveDownLabel = t('rules.moveDownOf', { name: rule.name })

  const moveFromSheet = (move: (opener: HTMLElement) => void): void => {
    setIsSheetOpen(false)
    const opener = moreRef.current?.querySelector('button')
    if (opener) move(opener)
  }

  const actions = isPhone ? (
    <>
      <span ref={moreRef}>
        <IconAction
          label={t('rules.moreOf', { name: rule.name })}
          icon={MoreVerticalIcon}
          tone="steel"
          size={36}
          aria-haspopup="menu"
          aria-expanded={isSheetOpen}
          onClick={() => {
            setIsSheetOpen(true)
          }}
          data-testid="email-rule-more-button"
        />
      </span>
      <ActionSheet
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false)
        }}
        label={rule.name}
        data-testid="email-rule-menu"
      >
        {[
          ...(onMoveUp === null
            ? []
            : [
                <MenuItem
                  key="move-up"
                  onClick={() => {
                    moveFromSheet(onMoveUp)
                  }}
                  data-testid="email-rule-move-up-button"
                >
                  <ListItemIcon>
                    <Icon icon={Top} />
                  </ListItemIcon>
                  <ListItemText primary={t('rules.moveUp')} />
                </MenuItem>
              ]),
          ...(onMoveDown === null
            ? []
            : [
                <MenuItem
                  key="move-down"
                  onClick={() => {
                    moveFromSheet(onMoveDown)
                  }}
                  data-testid="email-rule-move-down-button"
                >
                  <ListItemIcon>
                    <Icon icon={Bottom} />
                  </ListItemIcon>
                  <ListItemText primary={t('rules.moveDown')} />
                </MenuItem>
              ]),
          <MenuItem
            key="edit"
            onClick={() => {
              setIsSheetOpen(false)
              onEdit()
            }}
            data-testid="email-rule-edit-button"
          >
            <ListItemIcon>
              <Icon icon={Edit} />
            </ListItemIcon>
            <ListItemText primary={t('common.edit')} />
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => {
              setIsSheetOpen(false)
              const opener = moreRef.current?.querySelector('button')
              if (opener) onDelete(opener)
            }}
            data-testid="email-rule-delete-button"
          >
            <ListItemIcon>
              <Icon icon={Trash} />
            </ListItemIcon>
            <ListItemText primary={t('common.delete')} />
          </MenuItem>
        ]}
      </ActionSheet>
    </>
  ) : (
    <>
      <IconAction
        label={moveUpLabel}
        icon={Top}
        tone="steel"
        size={36}
        disabled={onMoveUp === null}
        onClick={event => {
          onMoveUp?.(event.currentTarget)
        }}
        data-testid="email-rule-move-up-button"
      />
      <IconAction
        label={moveDownLabel}
        icon={Bottom}
        tone="steel"
        size={36}
        disabled={onMoveDown === null}
        onClick={event => {
          onMoveDown?.(event.currentTarget)
        }}
        data-testid="email-rule-move-down-button"
      />
      <IconAction
        label={editLabel}
        icon={Edit}
        tone="steel"
        size={36}
        onClick={onEdit}
        data-testid="email-rule-edit-button"
      />
      <IconAction
        label={deleteLabel}
        icon={Trash}
        tone="steel"
        size={36}
        onClick={event => {
          onDelete(event.currentTarget)
        }}
        data-testid="email-rule-delete-button"
      />
    </>
  )

  return (
    <SettingsCard
      title={rule.name}
      pill={isPhone ? null : summary}
      actions={actions}
      titleTestId="email-rule-name"
      data-testid="email-rule-item"
      dataAttributes={{ 'data-rule-name': rule.name }}
    />
  )
}
