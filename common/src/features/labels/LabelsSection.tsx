import { Dots, Icon, Plus } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Nav,
  NavItem,
  NavLink,
  NavText,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { Label } from 'jmap-client-ts/linagora'
import { useId, useState, type ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import { useI18n } from '@common/i18n/useI18n'

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
    <NavItem data-testid="label-item" data-label-name={label.displayName}>
      <NavLink
        component={Link}
        to={labelPath(label.id)}
        selected={isSelected}
        aria-current={isSelected ? 'page' : undefined}
        className="u-ov-hidden"
      >
        <Box className="u-mr-1 u-flex">
          <LabelIcon color={label.color} />
        </Box>
        <NavText className="u-flex-auto u-ellipsis">
          {label.displayName}
        </NavText>
      </NavLink>
      {canChange ? (
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
                setAnchor(null)
                remove(label)
              }}
              data-testid="label-delete-item"
            >
              <ListItemText slotProps={{ primary: { color: 'error.dark' } }}>
                {t('common.delete')}
              </ListItemText>
            </MenuItem>
          </Menu>
        </>
      ) : null}
    </NavItem>
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
    <Box
      component="nav"
      aria-labelledby={titleId}
      className="u-mt-1"
      data-testid="labels-section"
    >
      <Box className="u-flex u-flex-items-center u-mh-1">
        <Typography
          id={titleId}
          variant="subtitle2"
          component="h2"
          color="textPrimary"
          className="u-flex-auto"
        >
          {t('labels.title')}
        </Typography>
        <Tooltip title={newLabel}>
          <IconButton
            size="small"
            aria-label={newLabel}
            onClick={create}
            data-testid="add-new-label-button"
          >
            <Icon icon={Plus} />
          </IconButton>
        </Tooltip>
      </Box>
      <Nav>
        {(data?.list ?? []).map(label => (
          <LabelItem key={label.id} label={label} />
        ))}
      </Nav>
    </Box>
  )
}
