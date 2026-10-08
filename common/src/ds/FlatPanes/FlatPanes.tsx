// Upstream to twake-ui: yes. twake-mui's `Main` is grey and its `Content` a
// white card (margin 16 px, radius 16 px). The design has the body plain
// white and flush against the sidebar; this needs a variant of `Layout`
// (e.g. `Layout variant="flat"`) rather than an override.
import { Box, Content, Main } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

const MAIN_SX = { bgcolor: 'background.paper' } as const
// The metrics of twake-mui's `Content` card, around the whole main pane: the
// grey of the `Layout` shows between it and the top bar
const INSET_MAIN_SX = {
  bgcolor: 'background.paper',
  height: 'auto',
  minWidth: 0,
  m: '16px 16px 16px 0',
  borderRadius: '16px'
} as const
const CONTENT_SX = { m: 0, borderRadius: 0 } as const
// With a header on the grey (tmail-flutter's search filters): its chips 16
// px under the top bar and 10 px above the card (minus the 4 px a scrolling
// row of chips keeps around them for the focus ring)
const HEADED_MAIN_SX = {
  height: 'auto',
  minWidth: 0,
  m: '0 16px 16px 0',
  bgcolor: 'transparent'
} as const
const HEADER_SX = { flexShrink: 0, pt: '12px', pb: '6px', minWidth: 0 } as const
const CARD_SX = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
  overflow: 'hidden',
  bgcolor: 'background.paper',
  borderRadius: '16px'
} as const

export interface FlatMainProps extends ComponentProps<typeof Main> {
  /**
   * A white card on the grey of the `Layout`, away from the top bar and the
   * window edges (a desktop); flush and full height otherwise
   */
  inset?: boolean
  /**
   * With `inset`: a row above the card, on the grey of the `Layout` (the
   * search filters of tmail-flutter), inside the `main` landmark
   */
  header?: ReactNode
}

/** `Main` on a white background */
export function FlatMain({
  inset = false,
  header = null,
  children,
  ...props
}: FlatMainProps): ReactElement {
  if (inset && header !== null) {
    return (
      <Main sx={HEADED_MAIN_SX} {...props}>
        <Box sx={HEADER_SX}>{header}</Box>
        <Box sx={CARD_SX}>{children}</Box>
      </Main>
    )
  }
  return (
    <Main sx={inset ? INSET_MAIN_SX : MAIN_SX} {...props}>
      {children}
    </Main>
  )
}

/**
 * `Content` without margin nor rounded corners, nor the `main` role of
 * twake-mui's `Content`: it sits in `FlatMain`, whose `<main>` is the landmark
 * (two nested `main` landmarks otherwise, docs/twake-mui-gaps.md)
 */
export function FlatContent(
  props: ComponentProps<typeof Content>
): ReactElement {
  return <Content sx={CONTENT_SX} role={undefined} {...props} />
}
