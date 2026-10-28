import { Typography, type TypographyProps } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface SecondaryTextProps {
  children: ReactNode
  variant?: TypographyProps['variant']
  component?: 'span' | 'p' | 'div' | 'h2' | 'h3'
  noWrap?: boolean
  /** Cut after this many lines, with an ellipsis */
  lines?: number
  className?: string
  id?: string
  'data-testid'?: string
}

/**
 * Text of lesser importance (preview, date, hint), in the theme's
 * `text.secondary`.
 */
export function SecondaryText({
  children,
  variant,
  component = 'span',
  noWrap,
  lines,
  className,
  id,
  'data-testid': testId
}: SecondaryTextProps): ReactElement {
  return (
    <Typography
      variant={variant}
      component={component}
      noWrap={noWrap}
      className={className}
      id={id}
      data-testid={testId}
      color="text.secondary"
      sx={
        lines === undefined
          ? undefined
          : {
              display: '-webkit-box',
              overflow: 'hidden',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: lines
            }
      }
    >
      {children}
    </Typography>
  )
}
