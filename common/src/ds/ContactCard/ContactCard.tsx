// Upstream to twake-ui: yes. The card of a person or an address (avatar,
// name, address with a copy button, a few actions): twake-mui's small
// `ConfirmDialog` on a wide screen and its `BottomSheet` on a phone, their
// content laid out here. twake-mui's `ContactPopover` opens on hover and has
// fixed actions (see docs/twake-mui-gaps.md).
import { Copy } from '@linagora/twake-icons'
import {
  BottomSheet,
  BottomSheetItem,
  Button,
  ConfirmDialog,
  DialogCloseButton,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery
} from '@linagora/twake-mui'
import {
  useId,
  type ReactElement,
  type ReactNode,
  type MouseEvent
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { Icon } from '@/ds/Icon/Icon'
import { REDUCED_MOTION_QUERY } from '@/ds/ViewTransition/viewTransition'

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
  actions: readonly ContactCardAction[]
  'data-testid'?: string
}

/** A pill as wide as the card: filled for the main action */
function ActionButton({
  action,
  className
}: {
  action: ContactCardAction
  className?: string
}): ReactElement {
  return (
    <Button
      size="large"
      fullWidth
      className={className}
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
  actions
}: Omit<ContactCardProps, 'open' | 'onClose' | 'data-testid'> & {
  titleId: string
}): ReactElement {
  const hasName = name.trim() !== ''
  return (
    <div className="u-flex u-flex-column u-flex-items-center">
      {avatar}
      {hasName ? (
        <Typography
          variant="h3"
          component="h2"
          id={titleId}
          className="u-breakword u-ta-center u-mt-1"
          data-testid="contact-card-name"
        >
          {name}
        </Typography>
      ) : null}
      <div className="u-flex u-flex-items-center u-flex-justify-center u-maw-100 u-mt-half">
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
            size="small"
            onClick={onCopy}
            data-testid="contact-card-copy"
          >
            <Icon icon={Copy} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </div>
      {actions.length > 0 ? (
        <div
          className="u-flex u-flex-column u-w-100 u-mt-1-half"
          data-testid="contact-card-actions"
        >
          {actions.map((action, index) => (
            <ActionButton
              key={action.id}
              action={action}
              className={index === 0 ? undefined : 'u-mt-1'}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The card of a contact: a small dialog on tablets and desktops, a sheet
 * rising from the bottom on phones. It is named by the name of the person
 * (their address when there is none), traps the focus, closes on Escape,
 * the close button and a click outside, and gives the focus back to what
 * opened it.
 */
export function ContactCard({
  open,
  onClose,
  'data-testid': testId,
  ...content
}: ContactCardProps): ReactElement | null {
  const titleId = useId()
  const isPhone = useScreenSize() === 'mobile'
  // The sheet animates whatever the preference: twake-mui reads none
  const isMotionReduced = useMediaQuery(REDUCED_MOTION_QUERY)
  const body = <Content titleId={titleId} {...content} />
  if (isPhone) {
    if (!open) return null
    return (
      <BottomSheet
        backdrop
        onClose={onClose}
        skipAnimation={isMotionReduced}
        aria-labelledby={titleId}
      >
        <BottomSheetItem
          className="u-pos-relative"
          disableElevation
          data-testid={testId}
        >
          <DialogCloseButton onClick={onClose} />
          {body}
        </BottomSheetItem>
      </BottomSheet>
    )
  }
  return (
    <ConfirmDialog
      size="small"
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      content={body}
      data-testid={testId}
    />
  )
}
