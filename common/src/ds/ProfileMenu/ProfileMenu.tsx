// Upstream to twake-ui: no. The account menu without the platform: an avatar
// with the first letter of the name or address, opening a 260 px card: the
// display name when known, the address with a copy button, a close cross,
// then its entries (manage account, sign out).
import { Icon } from '@linagora/twake-icons'
import {
  Avatar,
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

const BUTTON_SX = { ml: '16px', borderRadius: '50%' } as const

const PAPER_SX = { width: 260, mt: '8px' } as const

const NAME_SX = {
  px: '16px',
  pt: '32px',
  typography: 'subtitle1',
  color: 'text.primary',
  textAlign: 'center',
  overflowWrap: 'anywhere'
} as const

const ADDRESS_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  px: '16px',
  pt: '32px',
  pb: '4px',
  typography: 'body2',
  color: 'text.secondary',
  wordBreak: 'break-all'
} as const

/** Under the name, the address comes closer to it */
const ADDRESS_UNDER_NAME_SX = { ...ADDRESS_SX, pt: '4px' } as const

const CLOSE_SX = { position: 'absolute', top: 6, right: 6 } as const

const LIST_SX = { pt: 0, pb: '8px' } as const

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
  /** The display name of the user, above the address; null when unknown */
  name?: string | null
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
 * initial, opening a card with the name, the address and the entries. The
 * focus goes to the first entry, Escape or the cross close it and give the
 * focus back to the button.
 */
export function ProfileMenu({
  initial,
  name = null,
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
          <Avatar size={32}>{initial}</Avatar>
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
        {name === null ? null : <Box sx={NAME_SX}>{name}</Box>}
        <Box sx={name === null ? ADDRESS_SX : ADDRESS_UNDER_NAME_SX}>
          <span>{address}</span>
          <Tooltip title={labels.copy} placement="top" disableInteractive>
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
