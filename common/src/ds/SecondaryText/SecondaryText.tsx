// Upstream to twake-ui: yes, as a fix of the theme rather than a component.
// `text.secondary` (Grey 900 at 64 %) is 3.6:1 on white and 3.5:1 on the
// default background: below the 4.5:1 that RGAA 3.2 / WCAG 1.4.3 require for
// text. This one is Grey 900 at 80 % (5.4:1 on white, 5.1:1 on Grey 100),
// white at 80 % in the dark scheme.
import { alpha, Typography, type TypographyProps } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface SecondaryTextProps {
  children: ReactNode
  variant?: TypographyProps['variant']
  component?: 'span' | 'p' | 'div'
  noWrap?: boolean
  className?: string
  'data-testid'?: string
}

/**
 * Text of lesser importance (preview, date, hint), greyed but readable:
 * the `textSecondary` of twake-mui with an AA contrast.
 */
export function SecondaryText({
  children,
  variant,
  component = 'span',
  noWrap,
  className,
  'data-testid': testId
}: SecondaryTextProps): ReactElement {
  return (
    <Typography
      variant={variant}
      component={component}
      noWrap={noWrap}
      className={className}
      data-testid={testId}
      sx={theme => ({
        color: alpha(theme.palette.grey[900], 0.8),
        // The dark scheme of twake-mui has the same 64 % text.secondary
        ...theme.applyStyles('dark', {
          color: alpha(theme.palette.common.white, 0.8)
        })
      })}
    >
      {children}
    </Typography>
  )
}
