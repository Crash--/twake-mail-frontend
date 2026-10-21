// Upstream to twake-ui: yes, the switcher of the mailbox shown (Figma
// "Teammail 1.1", Delegation): a 32 px grey pill holding the avatar of the
// mailbox shown, "Viewing <name>" in Medium 13 and a chevron, opening a card
// of the mailboxes by group ("Your mailbox", "Delegated to you"…), each one
// a 56 px row (a 32 px avatar, the name, the address under it), the one
// shown on a blue tint with a tick at its end. While another mailbox than
// the user's is shown, a cross beside the pill goes back to theirs.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography
} from '@mui/material'
import { Fragment, useId, useState, type ReactElement } from 'react'

import {
  Check,
  ChevronDownOutline,
  CrossSmall
} from '@/ds/FlutterIcons/FlutterIcons'
import {
  GradientAvatar,
  firstLetterOf
} from '@/ds/GradientAvatar/GradientAvatar'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const PILL_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  height: 32,
  maxWidth: 260,
  pl: '4px',
  pr: 1,
  borderRadius: '100px',
  bgcolor: TMAIL.fillChip,
  color: TMAIL.textGrey,
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: TMAIL.fillSelected }
} as const

const PILL_LABEL_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

const PAPER_SX = {
  width: 260,
  borderRadius: '12px',
  py: 1
} as const

const GROUP_SX = {
  position: 'static',
  px: 2,
  pt: 1,
  pb: '4px',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  color: TMAIL.textGrey64,
  bgcolor: 'transparent'
} as const

const ITEM_SX = {
  gap: 1.5,
  minHeight: 56,
  mx: 1,
  px: 1,
  borderRadius: '10px',
  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: TMAIL.blueSelected }
} as const

const NAME_SX = {
  fontSize: 15,
  lineHeight: '20px',
  color: TMAIL.textGrey,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

const ADDRESS_SX = {
  fontSize: 12,
  lineHeight: '16px',
  color: TMAIL.textGrey64,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

export interface MailboxSwitcherItem {
  id: string
  name: string
  /** Under the name */
  address: string
  /** Picks the colour of the avatar */
  avatarKey: string
}

export interface MailboxSwitcherGroup {
  id: string
  title: string
  items: readonly MailboxSwitcherItem[]
}

export interface MailboxSwitcherLabels {
  /** The text of the pill, e.g. "Viewing Alice" */
  pill: string
  /** Name and tooltip of the pill, e.g. "Switch mailbox, viewing Alice" */
  open: string
  /** Name and tooltip of the cross back to the user's mailbox */
  back: string
}

export interface MailboxSwitcherProps {
  groups: readonly MailboxSwitcherGroup[]
  /** The item shown */
  selectedId: string
  /** The item of the user's own mailbox: the cross goes back to it */
  ownId: string
  labels: MailboxSwitcherLabels
  onSelect: (id: string) => void
  'data-testid'?: string
  itemTestId?: string
  backTestId?: string
}

/**
 * Picks the mailbox shown among the user's own one and the others they may
 * see: a menu button, the choices as `menuitemradio`. The focus goes to
 * the one shown when it opens, and back to the pill when it closes.
 */
export function MailboxSwitcher({
  groups,
  selectedId,
  ownId,
  labels,
  onSelect,
  'data-testid': testId,
  itemTestId,
  backTestId
}: MailboxSwitcherProps): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  // A new menu at each opening: one reopened while it closes would keep
  // the focus where it was instead of the mailbox shown
  const [openings, setOpenings] = useState(0)
  const menuId = useId()
  const selected =
    groups.flatMap(group => group.items).find(item => item.id === selectedId) ??
    null
  const close = (): void => {
    setAnchor(null)
  }

  return (
    <Box
      className="u-flex u-flex-items-center"
      sx={{ gap: '4px', minWidth: 0 }}
    >
      <Tooltip title={labels.open}>
        <ButtonBase
          aria-label={labels.open}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          aria-controls={anchor === null ? undefined : menuId}
          onClick={event => {
            setAnchor(event.currentTarget)
            setOpenings(count => count + 1)
          }}
          sx={PILL_SX}
          data-testid={testId}
        >
          {selected === null ? null : (
            <GradientAvatar
              text={firstLetterOf(selected.name)}
              colorKey={selected.avatarKey}
              size={24}
              fontSize={11}
            />
          )}
          <Box component="span" sx={PILL_LABEL_SX}>
            {labels.pill}
          </Box>
          <Icon icon={ChevronDownOutline} size={16} aria-hidden="true" />
        </ButtonBase>
      </Tooltip>
      {selectedId === ownId ? null : (
        <Tooltip title={labels.back}>
          <IconButton
            size="small"
            aria-label={labels.back}
            onClick={() => {
              onSelect(ownId)
            }}
            data-testid={backTestId}
          >
            <Icon icon={CrossSmall} size={20} />
          </IconButton>
        </Tooltip>
      )}
      <Menu
        key={openings}
        id={menuId}
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: PAPER_SX },
          list: { 'aria-label': labels.open }
        }}
      >
        {groups
          .filter(group => group.items.length > 0)
          .map(group => (
            <Fragment key={group.id}>
              <ListSubheader role="presentation" disableSticky sx={GROUP_SX}>
                {group.title}
              </ListSubheader>
              {group.items.map(item => {
                const isSelected = item.id === selectedId
                return (
                  <MenuItem
                    key={item.id}
                    role="menuitemradio"
                    aria-checked={isSelected}
                    selected={isSelected}
                    onClick={() => {
                      close()
                      if (!isSelected) onSelect(item.id)
                    }}
                    sx={ITEM_SX}
                    data-testid={itemTestId}
                    data-mailbox={item.address}
                  >
                    <GradientAvatar
                      text={firstLetterOf(item.name)}
                      colorKey={item.avatarKey}
                      size={32}
                      fontSize={14}
                    />
                    <Box
                      className="u-flex u-flex-column"
                      sx={{ minWidth: 0, flex: 1 }}
                    >
                      <Typography component="span" sx={NAME_SX}>
                        {item.name}
                      </Typography>
                      <Typography component="span" sx={ADDRESS_SX}>
                        {item.address}
                      </Typography>
                    </Box>
                    {isSelected ? (
                      <Box
                        component="span"
                        sx={{ display: 'flex', color: 'primary.main' }}
                      >
                        <Icon icon={Check} size={20} aria-hidden="true" />
                      </Box>
                    ) : null}
                  </MenuItem>
                )
              })}
            </Fragment>
          ))}
      </Menu>
    </Box>
  )
}
