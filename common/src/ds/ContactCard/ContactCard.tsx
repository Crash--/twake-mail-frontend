// Upstream to twake-ui: yes. The card of a person or an address (avatar,
// name, address with a copy button, a few actions): a centred dialog on a
// wide screen and a bottom sheet on a phone. twake-mui's `ContactPopover`
// opens on hover, has fixed actions and no bottom sheet (see
// docs/twake-mui-gaps.md).
import { Icon, Cross, Copy } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Dialog,
  Drawer,
  IconButton,
  radius,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  type ReactElement,
  type ReactNode,
  type MouseEvent
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const CARD_WIDTH = 383

const CONTENT_SX = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  px: 4,
  py: 3
} as const

const CLOSE_SX = {
  position: 'absolute',
  top: 0,
  right: 0,
  p: '10px',
  color: 'text.secondary'
} as const

const NAME_SX = { mt: 3, mb: 1 } as const

export interface ContactCardAction {
  id: string
  /** On one line, without an icon */
  label: string
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

/** A 48 px pill as wide as the card: filled for the main action */
function ActionButton({ action }: { action: ContactCardAction }): ReactElement {
  return (
    <Button
      size="large"
      fullWidth
      variant={action.isPrimary === true ? 'contained' : 'outlined'}
      {...(action.href === undefined
        ? {}
        : { href: action.href, target: '_blank', rel: 'noopener noreferrer' })}
      onClick={action.onClick}
      data-testid={action['data-testid']}
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
          <Icon icon={Cross} size={24} aria-hidden="true" />
        </IconButton>
      </Tooltip>
      {avatar}
      {hasName ? (
        <Typography
          variant="h3"
          component="h2"
          id={titleId}
          className="u-breakword u-ta-center"
          sx={NAME_SX}
          data-testid="contact-card-name"
        >
          {name}
        </Typography>
      ) : null}
      <Box
        className="u-flex u-flex-items-center u-flex-justify-center"
        sx={{ maxWidth: '100%', ...(hasName ? {} : { mt: 3 }) }}
      >
        <Typography
          variant="body2"
          component={hasName ? 'p' : 'h2'}
          id={hasName ? undefined : titleId}
          className="u-breakword"
          color="text.secondary"
          data-testid="contact-card-address"
        >
          {address}
        </Typography>
        <Tooltip title={copyLabel} placement="top" disableInteractive>
          <IconButton
            aria-label={copyLabel}
            onClick={onCopy}
            sx={{ p: '5px', color: 'text.secondary' }}
            data-testid="contact-card-copy"
          >
            <Icon icon={Copy} size={20} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </Box>
      {actions.length > 0 ? (
        <Box
          className="u-flex u-flex-column u-w-100"
          sx={{ gap: '14px', mt: 3 }}
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
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
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
              maxWidth: 'calc(100% - 32px)'
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
