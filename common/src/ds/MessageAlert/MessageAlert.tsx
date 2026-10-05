// Upstream to twake-ui: partly. twake-mui re-exports `Alert` and
// `AlertTitle` (levels, icon, title, `onClose`); this wrapper only adds what
// they lack for a message the page carries: the level said in text (not by
// colour and icon alone), a static `group` instead of the live-region
// `role="alert"` of MUI, and an action beside a labelled dismiss button
// (MUI's `action` replaces its own close button). See
// docs/twake-mui-gaps.md "Message alerts".
import { Cross, Icon } from '@linagora/twake-icons'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  IconButton,
  Tooltip
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { VISUALLY_HIDDEN } from './visuallyHidden'

export type MessageAlertLevel = 'info' | 'warn' | 'error'

const SEVERITIES: Record<MessageAlertLevel, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warn: 'warning',
  error: 'error'
}

export interface MessageAlertAction {
  label: string
  onClick: () => void
  disabled?: boolean
  'data-testid'?: string
}

export interface MessageAlertDismiss {
  /** Name and tooltip of the button, e.g. "Dismiss" */
  label: string
  onClick: () => void
  'data-testid'?: string
}

export interface MessageAlertProps {
  level: MessageAlertLevel
  /** The level in words ("Warning", "Danger"), read before the title */
  levelLabel: string
  title: string
  description: string
  action?: MessageAlertAction
  dismiss?: MessageAlertDismiss
  className?: string
  'data-testid'?: string
}

/**
 * A banner about a message, in three levels (info blue, warn yellow, error
 * red) with an icon, a title, a description, an optional action pill and an
 * optional dismiss button. The content is part of the page, not an event:
 * it is a labelled `group`, not a live region. The level is in the text
 * (`levelLabel`, visually hidden), never only in the colour.
 */
export function MessageAlert({
  level,
  levelLabel,
  title,
  description,
  action,
  dismiss,
  className,
  'data-testid': testId
}: MessageAlertProps): ReactElement {
  const titleId = useId()
  return (
    <Alert
      role="group"
      aria-labelledby={titleId}
      severity={SEVERITIES[level]}
      className={className}
      data-testid={testId}
      action={
        action || dismiss ? (
          <Box className="u-flex u-flex-items-center">
            {action ? (
              <Button
                size="small"
                disabled={action.disabled}
                onClick={action.onClick}
                data-testid={action['data-testid']}
                sx={{
                  borderRadius: '100px',
                  color: `${SEVERITIES[level]}.main`,
                  bgcolor: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'none',
                  fontWeight: 500,
                  px: 2
                }}
              >
                {action.label}
              </Button>
            ) : null}
            {dismiss ? (
              <Tooltip title={dismiss.label}>
                <IconButton
                  size="small"
                  color="inherit"
                  aria-label={dismiss.label}
                  onClick={dismiss.onClick}
                  data-testid={dismiss['data-testid']}
                >
                  <Icon icon={Cross} size={16} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>
        ) : undefined
      }
    >
      <AlertTitle id={titleId}>
        <Box component="span" sx={VISUALLY_HIDDEN}>{`${levelLabel}: `}</Box>
        {title}
      </AlertTitle>
      <Box sx={{ overflowWrap: 'anywhere' }}>{description}</Box>
    </Alert>
  )
}
