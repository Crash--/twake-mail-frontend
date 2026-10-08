// Upstream to twake-ui: yes. The card of a person or an address (avatar,
// name, address with a copy button, a few actions): a centred dialog on a
// wide screen and a bottom sheet on a phone, as the address dialog of
// tmail-flutter. twake-mui has neither a contact card nor a bottom sheet
// (see docs/twake-mui-gaps.md).
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
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

import { CloseCardIcon, CopyIcon } from '@/ds/RecipientIcons/RecipientIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** tmail-flutter `EmailAddressDialogBuilder` */
const CARD_WIDTH = 383
const CARD_RADIUS = 16

const PRIMARY = '#0A84FF'
/** `textSecondary` at 48 %, the address and its copy button */
const MUTED = 'rgba(28, 27, 31, 0.48)'

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
  color: '#8C9CAF'
} as const

/** tmail-flutter's `textStyleM3HeadlineSmall` in `textPrimary` */
const NAME_SX = {
  mt: 3,
  mb: 1,
  fontSize: 24,
  lineHeight: '32px',
  fontWeight: 600,
  letterSpacing: 0,
  color: '#424244'
} as const

/** tmail-flutter's `textStyleM3BodyMedium` */
const ADDRESS_SX = {
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: '0.25px',
  color: MUTED
} as const

function actionSx(isPrimary: boolean): Record<string, unknown> {
  return {
    width: '100%',
    height: 48,
    boxSizing: 'border-box',
    px: '10px',
    borderRadius: '100px',
    border: `1px solid ${PRIMARY}`,
    bgcolor: isPrimary ? PRIMARY : '#FFFFFF',
    color: isPrimary ? '#FFFFFF' : PRIMARY,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 500,
    letterSpacing: '0.1px',
    textAlign: 'center',
    textDecoration: 'none',
    '&:hover': { bgcolor: isPrimary ? '#0067D6' : 'rgba(10, 132, 255, 0.06)' }
  }
}

export interface ContactCardAction {
  id: string
  /** On one line, without an icon, as tmail-flutter */
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
  const sx = actionSx(action.isPrimary === true)
  return action.href === undefined ? (
    <ButtonBase
      onClick={action.onClick}
      sx={sx}
      data-testid={action['data-testid']}
    >
      {action.label}
    </ButtonBase>
  ) : (
    <ButtonBase
      component="a"
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={action.onClick}
      sx={sx}
      data-testid={action['data-testid']}
    >
      {action.label}
    </ButtonBase>
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
          <Icon icon={CloseCardIcon} size={24} aria-hidden="true" />
        </IconButton>
      </Tooltip>
      {avatar}
      {hasName ? (
        <Typography
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
          component={hasName ? 'p' : 'h2'}
          id={hasName ? undefined : titleId}
          className="u-breakword"
          sx={ADDRESS_SX}
          data-testid="contact-card-address"
        >
          {address}
        </Typography>
        <Tooltip title={copyLabel}>
          <IconButton
            aria-label={copyLabel}
            onClick={onCopy}
            sx={{ p: '5px', color: MUTED }}
            data-testid="contact-card-copy"
          >
            <Icon icon={CopyIcon} size={20} aria-hidden="true" />
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
