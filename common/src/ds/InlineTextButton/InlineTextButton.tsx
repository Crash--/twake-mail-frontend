// Upstream to twake-ui: yes, as `Button variant="text" size="small"` with an
// `underline` option. The "Unsubscribe" of the reading mock is a Medium
// 14/18.4 text button, underlined, 4 / 8 px of padding and a 100 px radius,
// in the secondary text colour.
import { alpha, ButtonBase } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { FOCUS_RING_INSET } from '@/ds/FocusIndicator/focusIndicator'

export interface InlineTextButtonProps {
  children: ReactNode
  onClick: () => void
  /** Underlines the label, a link-like action */
  isUnderlined?: boolean
  'data-testid'?: string
}

/** A small text button in a line of text (a header, a recipient line) */
export function InlineTextButton({
  children,
  onClick,
  isUnderlined = false,
  'data-testid': testId
}: InlineTextButtonProps): ReactElement {
  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      data-testid={testId}
      sx={theme => ({
        px: 1,
        py: 0.5,
        borderRadius: '100px',
        fontSize: 14,
        lineHeight: '18.4px',
        fontWeight: 500,
        letterSpacing: '0.1px',
        textDecoration: isUnderlined ? 'underline' : 'none',
        color: alpha(theme.palette.grey[900], 0.8),
        '&:hover': { bgcolor: 'action.hover' },
        ...FOCUS_RING_INSET,
        ...theme.applyStyles('dark', {
          color: alpha(theme.palette.common.white, 0.8)
        })
      })}
    >
      {children}
    </ButtonBase>
  )
}
