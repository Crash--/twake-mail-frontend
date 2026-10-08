// Upstream to twake-ui: yes. The card of a person or an address (avatar,
// name, address with a copy button, a few actions): a centred dialog on a
// wide screen and a bottom sheet on a phone, as the address dialog of
// tmail-flutter. twake-mui has neither a contact card nor a bottom sheet
// (see docs/twake-mui-gaps.md).
import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Dialog,
  Drawer,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  type ReactElement,
  type ReactNode,
  type MouseEvent
} from 'react'

import { Copy, Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** tmail-flutter `EmailAddressDialogBuilder` */
const CARD_WIDTH = 383
const CARD_RADIUS = 16

const CONTENT_SX = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
  px: 4,
  py: 3
} as const

const CLOSE_SX = { position: 'absolute', top: 8, right: 8 } as const

export interface ContactCardAction {
  id: string
  label: string
  icon: IconProps['icon']
  /** Runs when the button is pressed; the card does not close by itself */
  onClick?: () => void
  /** Makes it a link, opened in a new tab */
  href?: string
  /** The main action of the card: a filled button instead of an outlined one */
  isPrimary?: boolean
  'data-testid'?: string
}

export interface ContactCardProps {
  open: boolean
  onClose: () => void
  /** What the avatar of the person shows (the caller draws it) */
  avatar: ReactNode
  /** Empty when the address has no name */
  name: string
  address: string
  copyLabel: string
  /** The click's event tells which document the card is rendered in */
  onCopy: (event: MouseEvent<HTMLElement>) => void
  closeLabel: string
  actions: readonly ContactCardAction[]
  'data-testid'?: string
}

function ActionButton({ action }: { action: ContactCardAction }): ReactElement {
  const content = {
    variant: action.isPrimary === true ? 'contained' : 'outlined',
    fullWidth: true,
    startIcon: <Icon icon={action.icon} size={20} aria-hidden="true" />,
    sx: { minHeight: 48 },
    'data-testid': action['data-testid']
  } as const
  return action.href === undefined ? (
    <Button {...content} onClick={action.onClick}>
      {action.label}
    </Button>
  ) : (
    <Button
      {...content}
      component="a"
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  )
}

function Content({
  titleId,
  avatar,
  name,
  address,
  copyLabel,
  onCopy,
  closeLabel,
  onClose,
  actions
}: Omit<ContactCardProps, 'open' | 'data-testid'> & {
  titleId: string
}): ReactElement {
  const hasName = name.trim() !== ''
  return (
    <Box sx={CONTENT_SX}>
      <Tooltip title={closeLabel}>
        <IconButton
          aria-label={closeLabel}
          onClick={onClose}
          sx={CLOSE_SX}
          data-testid="contact-card-close"
        >
          <Icon icon={Cross} aria-hidden="true" />
        </IconButton>
      </Tooltip>
      {avatar}
      {hasName ? (
        <Typography
          variant="h5"
          component="h2"
          id={titleId}
          className="u-breakword u-ta-center"
          data-testid="contact-card-name"
        >
          {name}
        </Typography>
      ) : null}
      <Box
        className="u-flex u-flex-items-center u-flex-justify-center"
        sx={{ gap: 0.5, maxWidth: '100%' }}
      >
        <Typography
          variant="body1"
          component={hasName ? 'p' : 'h2'}
          id={hasName ? undefined : titleId}
          color="text.secondary"
          className="u-breakword"
          data-testid="contact-card-address"
        >
          {address}
        </Typography>
        <IconAction
          label={copyLabel}
          icon={Copy}
          onClick={onCopy}
          data-testid="contact-card-copy"
        />
      </Box>
      {actions.length > 0 ? (
        <Box
          className="u-flex u-flex-column u-w-100"
          sx={{ gap: 1.5, mt: 2 }}
          data-testid="contact-card-actions"
        >
          {actions.map(action => (
            <ActionButton key={action.id} action={action} />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

/**
 * The card of a contact: a modal dialog (centred, 383 px wide) on tablets
 * and desktops, a bottom sheet on phones. It is named by the name of the
 * person (their address when there is none), traps the focus, closes on
 * Escape, the close button and a click outside, and gives the focus back to
 * what opened it.
 */
export function ContactCard({
  open,
  onClose,
  'data-testid': testId,
  ...content
}: ContactCardProps): ReactElement {
  const titleId = useId()
  const isPhone = useScreenSize() === 'mobile'
  const body = <Content titleId={titleId} onClose={onClose} {...content} />
  if (isPhone) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': titleId,
            sx: {
              borderTopLeftRadius: CARD_RADIUS,
              borderTopRightRadius: CARD_RADIUS,
              maxHeight: '90%',
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none !important'
              }
            }
          }
        }}
        data-testid={testId}
      >
        {body}
      </Drawer>
    )
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            '&&': {
              width: CARD_WIDTH,
              maxWidth: 'calc(100% - 32px)',
              borderRadius: `${CARD_RADIUS}px`
            }
          }
        }
      }}
      data-testid={testId}
    >
      {body}
    </Dialog>
  )
}
