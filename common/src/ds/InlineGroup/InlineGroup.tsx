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
  /** `baseline` aligns texts of different sizes */
  align?: 'center' | 'baseline' | 'flex-start'
  component?: 'div' | 'span' | 'p'
  className?: string
  'data-testid'?: string
}

/** Children in a row, spaced by a flex gap */
export function InlineGroup({
  children,
  gap = 1,
  isWrapping = true,
  align = 'center',
  component = 'div',
  className,
  'data-testid': testId
}: InlineGroupProps): ReactElement {
  return (
    <Box
      component={component}
      className={className}
      data-testid={testId}
      sx={{
        display: 'flex',
        flexWrap: isWrapping ? 'wrap' : 'nowrap',
        alignItems: align,
        columnGap: gap,
        m: 0
      }}
    >
      {children}
    </Box>
  )
}
