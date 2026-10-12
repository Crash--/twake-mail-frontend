// Upstream to twake-ui: yes, with `EventCard`. The answer pills and the
// text actions of the Twake event card (linagora-design-flutter
// `LinagoraEventCard`, `LinagoraEventAction`).
import { Icon } from '@linagora/twake-icons'
import { ButtonBase, Link } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { Check } from '@/ds/FlutterIcons/FlutterIcons'

type IconSource = ComponentProps<typeof Icon>['icon']

const PILL_SX = {
  height: 40,
  px: 3,
  borderRadius: 100,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  // The design's #0A84FF reads 3.6:1 with white; #0067D6 reads 5.6:1
  bgcolor: '#0067D6',
  color: '#FFFFFF',
  gap: 1,
  '&:hover': { bgcolor: '#0058B8' },
  '--focus-ring-color': '#0067D6',
  // The chosen answer: grey as in the design, its text readable, a check
  '&[aria-pressed="true"]': {
    bgcolor: 'rgba(29, 25, 43, 0.12)',
    color: 'rgba(66, 66, 68, 0.9)'
  },
  '&.Mui-disabled': {
    bgcolor: 'rgba(29, 25, 43, 0.12)',
    color: 'rgba(66, 66, 68, 0.6)'
  }
} as const

// The greys of the chosen and disabled answers, in white over the dark card
const PILL_DARK_SX = {
  '&[aria-pressed="true"]': {
    bgcolor: 'rgba(255, 255, 255, 0.16)',
    color: 'rgba(255, 255, 255, 0.9)'
  },
  '&.Mui-disabled': {
    bgcolor: 'rgba(255, 255, 255, 0.12)',
    color: 'rgba(255, 255, 255, 0.5)'
  }
} as const

const TEXT_ACTION_SX = {
  height: 40,
  px: 1.25,
  borderRadius: 1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  fontSize: 14,
  fontWeight: 500,
  // The design's #0C8CE9 reads 3.3:1 on the card; primary.dark 4.7:1
  color: 'primary.dark',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
  '& svg': { color: 'rgba(66, 66, 68, 0.8)' }
} as const

const TEXT_ACTION_DARK_SX = {
  '& svg': { color: 'rgba(255, 255, 255, 0.8)' }
} as const

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
    <ButtonBase
      sx={theme => ({ ...PILL_SX, ...theme.applyStyles('dark', PILL_DARK_SX) })}
      aria-pressed={isPressed}
      aria-busy={isBusy || undefined}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      {isPressed ? <Icon icon={Check} size={14} aria-hidden="true" /> : null}
      {children}
    </ButtonBase>
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
  const content = (
    <>
      {icon ? <Icon icon={icon} size={18} aria-hidden="true" /> : null}
      {children}
    </>
  )
  return href ? (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={theme => ({
        ...TEXT_ACTION_SX,
        ...theme.applyStyles('dark', TEXT_ACTION_DARK_SX)
      })}
      data-testid={testId}
    >
      {content}
    </Link>
  ) : (
    <ButtonBase
      sx={theme => ({
        ...TEXT_ACTION_SX,
        ...theme.applyStyles('dark', TEXT_ACTION_DARK_SX)
      })}
      onClick={onClick}
      data-testid={testId}
    >
      {content}
    </ButtonBase>
  )
}
