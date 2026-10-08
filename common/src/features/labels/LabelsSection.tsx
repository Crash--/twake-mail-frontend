import { Icon } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@linagora/twake-mui'
import type { Label } from 'jmap-client-ts/linagora'
import { useId, useState, type ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import { Dots, Plus } from '@/ds/FlutterIcons/FlutterIcons'
import { NavSectionAction } from '@/ds/NavSectionAction/NavSectionAction'
import { NavSectionHeader } from '@/ds/NavSectionHeader/NavSectionHeader'
import { NavTree } from '@/ds/NavTree/NavTree'
import { NavTreeItem } from '@/ds/NavTreeItem/NavTreeItem'
import { useI18n } from '@common/i18n/useI18n'
import {
  focusTargetsAround,
  keepFocusInPage
} from '@common/utils/keepFocusInPage'

import { LabelIcon } from './LabelIcon'
import { useLabelActions } from './LabelActionsProvider'
import { LABEL_PATH, labelPath } from './labelPaths'
import { useLabels, useLabelsAvailable } from './queries'

function LabelItem({ label }: { label: Label }): ReactElement {
  const { t } = useI18n()
  const { edit, remove } = useLabelActions()
  const isSelected =
    useMatch(`${LABEL_PATH}/:labelId/*`)?.params.labelId === label.id
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menuLabel = t('labels.menuOf', { name: label.displayName })
  const canChange = label.readOnly !== true

  return (
    <NavTreeItem
      level={1}
      icon={<LabelIcon color={label.color} />}
      label={label.displayName}
      linkComponent={Link}
      to={labelPath(label.id)}
      isSelected={isSelected}
      data-testid="label-item"
      itemProps={{
        'data-label-name': label.displayName,
        'aria-current': isSelected ? 'page' : undefined
      }}
      actions={
        canChange ? (
          <>
            <Tooltip title={menuLabel}>
              <IconButton
                size="small"
                aria-label={menuLabel}
                aria-haspopup="menu"
                onClick={event => {
                  setAnchor(event.currentTarget)
                }}
                data-testid="label-item-menu-button"
              >
                <Icon icon={Dots} />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchor}
              open={anchor !== null}
              onClose={() => {
                setAnchor(null)
              }}
              slotProps={{ list: { 'aria-label': menuLabel } }}
              data-testid="label-item-menu"
            >
              <MenuItem
                onClick={() => {
                  setAnchor(null)
                  edit(label)
                }}
                data-testid="label-edit-item"
              >
                <ListItemText>{t('labels.edit')}</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  // The row leaves with the button the focus returns to
                  const focusTargets = focusTargetsAround(anchor)
                  setAnchor(null)
                  void remove(label).then(isDeleted => {
                    if (isDeleted) keepFocusInPage(focusTargets)
                  })
                }}
                data-testid="label-delete-item"
              >
                <ListItemText slotProps={{ primary: { color: 'error.dark' } }}>
                  {t('common.delete')}
                </ListItemText>
              </MenuItem>
            </Menu>
          </>
        ) : undefined
      }
    />
  )
}

/**
 * The labels under the folders of the sidebar, as tmail-flutter: each
 * opens its emails, and has its menu (edit, delete); "+" creates one
 */
export function LabelsSection(): ReactElement | null {
  const { t } = useI18n()
  const titleId = useId()
  const isAvailable = useLabelsAvailable()
  const { data } = useLabels()
  const { create } = useLabelActions()
  if (!isAvailable) return null
  const newLabel = t('labels.new')

  return (
    <Box component="nav" aria-labelledby={titleId} data-testid="labels-section">
      <NavSectionHeader
        title={t('labels.title')}
        titleId={titleId}
        actions={
          <NavSectionAction
            label={newLabel}
            icon={Plus}
            onClick={() => {
              create()
            }}
            data-testid="add-new-label-button"
          />
        }
      />
      {/* As tmail-flutter: the labels do not fold */}
      <NavTree>
        {(data?.list ?? []).map(label => (
          <LabelItem key={label.id} label={label} />
        ))}
      </NavTree>
    </Box>
  )
}
