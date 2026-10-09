// Upstream to twake-ui: no, the look of tmail-flutter's account menu without
// the platform (`ProfileSettingIcon`, `ProfileSettingMenuOverlay`): a 48 px
// white disc holding the first letter of the address, opening a 260 px card
// rounded by 14 px: the address with a copy button, a close cross, then its
// entries (manage account, sign out).
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  Divider,
  IconButton,
  MenuList,
  Popover,
  Tooltip
} from '@linagora/twake-mui'
import {
  useId,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

import { Copy, CrossSmall } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const BUTTON_SX = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  bgcolor: TMAIL.surface,
  color: TMAIL.textBlack,
  fontSize: 20,
  fontWeight: 500,
  boxShadow: '0 0.5px 1px 1px rgba(0, 0, 0, 0.04)'
} as const

const PAPER_SX = {
  width: 260,
  mt: '8px',
  borderRadius: '14px',
  boxShadow: '0 0 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)'
} as const

const ADDRESS_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  px: '16px',
  pt: '32px',
  pb: '4px',
  fontSize: 14,
  fontWeight: 400,
  color: TMAIL.grey,
  wordBreak: 'break-all'
} as const

const CLOSE_SX = { position: 'absolute', top: 6, right: 6 } as const

/** tmail-flutter's grey icons of the entries */
const LIST_SX = {
  pt: 0,
  pb: '8px',
  '&& .MuiListItemIcon-root': { color: TMAIL.greyDark }
} as const

export interface ProfileMenuLabels {
  /** Name and tooltip of the button, e.g. "Account" */
  open: string
  close: string
  copy: string
  /** Name of the list of entries */
  menu: string
}

export interface ProfileMenuProps {
  /** The letter shown in the button */
  initial: string
  /** The address of the user, at the top of the card */
  address: string
  labels: ProfileMenuLabels
  onCopy: () => void
  /** The entries, `MenuItem`s, given the function closing the card */
  children: (close: () => void) => ReactNode
  /** Reaches the button, e.g. to give it the focus back */
  buttonRef?: Ref<HTMLButtonElement>
  'data-testid'?: string
}

/**
 * The account of the user at the end of the bar: a button with its
 * initial, opening a card with the address and the entries. The focus goes
 * to the first entry, Escape or the cross close it and give the focus back
 * to the button.
 */
export function ProfileMenu({
  initial,
  address,
  labels,
  onCopy,
  children,
  buttonRef,
  'data-testid': testId
}: ProfileMenuProps): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const listId = useId()
  const close = (): void => {
    setAnchor(null)
  }

  return (
    <>
      <Tooltip title={labels.open}>
        <ButtonBase
          ref={buttonRef}
          aria-label={labels.open}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          aria-controls={anchor === null ? undefined : listId}
          onClick={event => {
            setAnchor(event.currentTarget)
          }}
          sx={BUTTON_SX}
          data-testid={testId}
        >
          {initial}
        </ButtonBase>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: PAPER_SX } }}
      >
        <Box sx={ADDRESS_SX}>
          <span>{address}</span>
          <Tooltip title={labels.copy}>
            <IconButton size="small" aria-label={labels.copy} onClick={onCopy}>
              <Icon icon={Copy} size={16} />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider />
        <MenuList
          id={listId}
          autoFocusItem={anchor !== null}
          aria-label={labels.menu}
          sx={LIST_SX}
        >
          {children(close)}
        </MenuList>
        <Box sx={CLOSE_SX}>
          <Tooltip title={labels.close}>
            <IconButton size="small" aria-label={labels.close} onClick={close}>
              <Icon icon={CrossSmall} size={22} />
            </IconButton>
          </Tooltip>
        </Box>
      </Popover>
    </>
  )
}
