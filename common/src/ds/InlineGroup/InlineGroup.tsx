// Upstream to twake-ui: no, `Stack direction="row" useFlexGap` does the same;
// twake-mui re-exports Stack but outside `@/ds/` its `sx` and `spacing` are
// not allowed, and a flex gap has no twake-css utility class.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface InlineGroupProps {
  children: ReactNode
  /** Space between the children, in theme spacing units (8 px) */
  gap?: number
  /** Lets the children go to the next line */
  isWrapping?: boolean
  /** Space between the lines once they wrap, in theme spacing units */
  rowGap?: number
  /**
   * `baseline` aligns texts of different sizes; `flex-end` puts a child on
   * the last line of a text that breaks beside it
   */
  align?: 'center' | 'baseline' | 'flex-start' | 'flex-end'
  /** `h2`: a heading that looks like the text around it */
  component?: 'div' | 'span' | 'p' | 'h2'
  className?: string
  /** e.g. `list`, its children being `listitem`s */
  role?: 'list' | 'group'
  'aria-label'?: string
  'data-testid'?: string
}

/** Children in a row, spaced by a flex gap */
export function InlineGroup({
  children,
  gap = 1,
  isWrapping = true,
  rowGap = 0,
  align = 'center',
  component = 'div',
  className,
  role,
  'aria-label': ariaLabel,
  'data-testid': testId
}: InlineGroupProps): ReactElement {
  return (
    <Box
      component={component}
      className={className}
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      sx={{
        display: 'flex',
        flexWrap: isWrapping ? 'wrap' : 'nowrap',
        alignItems: align,
        columnGap: gap,
        rowGap,
        m: 0,
        ...(component === 'h2' ? { font: 'inherit' } : {})
      }}
    >
      {children}
    </Box>
  )
}
