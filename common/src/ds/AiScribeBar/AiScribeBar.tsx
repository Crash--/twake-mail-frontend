// Upstream to twake-ui: no, the look of tmail-flutter's "Help me write" bar
// (`AIScribeBar`): a 405 px white field in a 2 px gradient frame (blue,
// pink, orange), a 10 px radius, 48 to 100 px high, the prompt in Regular 14,
// and a round send button, light blue until something is written, then blue
// (#208BFF) with a white arrow.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, IconButton, InputBase, Tooltip } from '@linagora/twake-mui'
import {
  useState,
  type KeyboardEvent,
  type ReactElement,
  type SubmitEvent
} from 'react'

const BAR_WIDTH = 405
const GRADIENT =
  'linear-gradient(90deg, rgba(0, 183, 255, 0.9) 0%, rgba(224, 109, 209, 0.9) 75%, rgba(232, 167, 138, 0.9) 100%)'

const FRAME_SX = {
  width: `min(${BAR_WIDTH}px, calc(100vw - 32px))`,
  p: '2px',
  boxSizing: 'border-box',
  borderRadius: '10px',
  backgroundImage: GRADIENT
} as const

const FIELD_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minHeight: 44,
  px: 2,
  borderRadius: '8px',
  bgcolor: '#FFFFFF'
} as const

const INPUT_SX = {
  flex: 1,
  py: 1,
  fontSize: 14,
  lineHeight: '24px',
  letterSpacing: '0.4px',
  color: 'rgba(0, 0, 0, 0.85)',
  '& textarea': { maxHeight: 76, overflowY: 'auto' },
  '& textarea::placeholder': {
    fontWeight: 500,
    color: 'rgba(155, 155, 155, 0.85)',
    opacity: 1
  }
} as const

function sendSx(isEnabled: boolean): Record<string, unknown> {
  return {
    flexShrink: 0,
    width: 32,
    height: 32,
    p: 1,
    color: '#FFFFFF',
    bgcolor: isEnabled ? '#208BFF' : '#D2E9FF',
    '&:hover': { bgcolor: isEnabled ? '#0A84FF' : '#D2E9FF' },
    '&.Mui-disabled': { color: '#FFFFFF', bgcolor: '#D2E9FF' }
  }
}

export interface AiScribeBarProps {
  /** Placeholder and accessible name of the field ("Help me write") */
  label: string
  /** Name and tooltip of the send button */
  sendLabel: string
  sendIcon: IconProps['icon']
  /** What the user asked for, trimmed */
  onSubmit: (prompt: string) => void
  /** The field takes the focus when it shows */
  autoFocus?: boolean
  'data-testid'?: string
}

/**
 * The prompt of the AI assistant: Enter sends what is written, Shift+Enter
 * starts a new line; the send button waits for some text.
 */
export function AiScribeBar({
  label,
  sendLabel,
  sendIcon,
  onSubmit,
  autoFocus = false,
  'data-testid': testId
}: AiScribeBarProps): ReactElement {
  const [prompt, setPrompt] = useState('')
  const isEnabled = prompt.trim() !== ''

  const submit = (): void => {
    if (!isEnabled) return
    onSubmit(prompt.trim())
    setPrompt('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault()
    submit()
  }

  return (
    <Box sx={FRAME_SX}>
      <Box component="form" onSubmit={handleSubmit} sx={FIELD_SX}>
        <InputBase
          value={prompt}
          onChange={event => {
            setPrompt(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder={label}
          multiline
          autoFocus={autoFocus}
          inputProps={{ 'aria-label': label }}
          sx={INPUT_SX}
          data-testid={testId}
        />
        <Tooltip title={sendLabel}>
          <span>
            <IconButton
              type="submit"
              aria-label={sendLabel}
              disabled={!isEnabled}
              sx={sendSx(isEnabled)}
              data-testid={testId === undefined ? undefined : `${testId}-send`}
            >
              <Icon icon={sendIcon} size={16} aria-hidden="true" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  )
}
