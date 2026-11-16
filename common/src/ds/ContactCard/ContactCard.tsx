// Upstream to twake-ui: no. twake-mui's `ContactCard` (the card of
// `ContactPopover`, opened by the app), holding the actions of Mail as full
// width buttons, the main one filled.
import {
  Button,
  ContactCard as TwakeContactCard,
  ContactPopoverActions
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface ContactCardAction {
  id: string
  /** On one line, without an icon */
  label: string
  /** Runs when the button is pressed; the card does not close by itself */
  onClick: () => void
  /** The main action of the card: a filled button instead of an outlined one */
  isPrimary?: boolean
  'data-testid'?: string
}

export interface ContactCardProps {
  /** What the card is attached to; closed when `null` */
  anchorEl: HTMLElement | null
  onClose: () => void
  /** Empty when the address has no name */
  name: string
  address: string
  /** Called once the address is in the clipboard */
  onCopy: () => void
  actions: readonly ContactCardAction[]
  'data-testid'?: string
}

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
      onClick={action.onClick}
      data-testid={action['data-testid']}
    >
      {action.label}
    </Button>
  )
}

/**
 * The card of a contact, next to what opened it: a dialog named by the name
 * of the person (their address when there is none), closed on Escape, the
 * close button and a click outside, the focus given back to what opened it
 */
export function ContactCard({
  anchorEl,
  onClose,
  name,
  address,
  onCopy,
  actions,
  'data-testid': testId
}: ContactCardProps): ReactElement {
  return (
    <TwakeContactCard
      open={anchorEl !== null}
      anchorEl={anchorEl}
      onClose={onClose}
      name={name}
      email={address}
      // The colour of the avatars of the address elsewhere in Mail
      avatarColorKey={address}
      onEmailCopy={onCopy}
      data-testid={testId}
    >
      {actions.length > 0 ? (
        <ContactPopoverActions>
          <div
            className="u-flex u-flex-column u-w-100"
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
        </ContactPopoverActions>
      ) : null}
    </TwakeContactCard>
  )
}
