// Upstream to twake-ui: yes. twake-mui's `Main` is grey and its `Content` a
// white card (margin 16 px, radius 16 px). The design has the body plain
// white and flush against the sidebar; this needs a variant of `Layout`
// (e.g. `Layout variant="flat"`) rather than an override.
import { Content, Main, styled } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement } from 'react'

import { InsideMainLandmark } from '@/ds/MainLandmark/MainLandmark'

// twake-mui's `Main` and `Content` hand every prop to the DOM, `sx` included
// (it showed as `sx="[object Object]"`): wrapped, the `sx` is applied here and
// stops before them
const SxMain = styled(Main)({})
const SxContent = styled(Content)({})

const MAIN_SX = { bgcolor: 'background.paper', minWidth: 0 } as const
const CONTENT_SX = { m: 0, borderRadius: 0 } as const

/**
 * `Main` on a white background, flush against the sidebar and the edges of
 * the window, without rounded corners
 */
export function FlatMain({
  children,
  ...props
}: ComponentProps<typeof Main>): ReactElement {
  return (
    <SxMain sx={MAIN_SX} {...props}>
      <InsideMainLandmark>{children}</InsideMainLandmark>
    </SxMain>
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
  return <SxContent sx={CONTENT_SX} role={undefined} {...props} />
}
