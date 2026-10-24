// Upstream to twake-ui: yes, with `EventCard`. The answer buttons and the
// text actions of the Twake event card (linagora-design-flutter
// `LinagoraEventCard`, `LinagoraEventAction`).
import { Icon, Check } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

type IconSource = ComponentProps<typeof Icon>['icon']

export interface EventAnswerButtonProps {
  children: ReactNode
  /** A toggle (`aria-pressed`) for the answers, a plain button otherwise */
  isPressed?: boolean
  disabled?: boolean
  isBusy?: boolean
  onClick: () => void
  'data-testid'?: string
}

/** A pill of the answers row: Yes, Maybe, No */
export function EventAnswerButton({
  children,
  isPressed,
  disabled = false,
  isBusy = false,
  onClick,
  'data-testid': testId
}: EventAnswerButtonProps): ReactElement {
  return (
    <Button
      variant={isPressed ? 'ghost' : 'contained'}
      startIcon={
        isPressed ? <Icon icon={Check} size={14} aria-hidden="true" /> : null
      }
      aria-pressed={isPressed}
      aria-busy={isBusy || undefined}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}

export interface EventTextActionProps {
  children: ReactNode
  icon?: IconSource
  /** A link opening in a new tab; a button without it */
  href?: string
  onClick?: () => void
  'data-testid'?: string
}

/** A text action of the card: "Mail to attendees", "See in your Calendar" */
export function EventTextAction({
  children,
  icon,
  href,
  onClick,
  'data-testid': testId
}: EventTextActionProps): ReactElement {
  const startIcon = icon ? (
    <Icon icon={icon} size={18} aria-hidden="true" />
  ) : null
  return href ? (
    <Button
      variant="text"
      startIcon={startIcon}
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
    >
      {children}
    </Button>
  ) : (
    <Button
      variant="text"
      startIcon={startIcon}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
