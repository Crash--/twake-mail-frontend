// Upstream to twake-ui: yes. twake-mui's `Main` is grey and its `Content` a
// white card (margin 16 px, radius 16 px). The design has the body plain
// white and flush against the app bar and the sidebar; this needs a variant
// of `Layout` (e.g. `Layout variant="flat"`) rather than an override.
import { Content, Main } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement } from 'react'

const MAIN_SX = { bgcolor: 'background.paper' } as const
const CONTENT_SX = { m: 0, borderRadius: 0 } as const

/** `Main` on a white background */
export function FlatMain(props: ComponentProps<typeof Main>): ReactElement {
  return <Main sx={MAIN_SX} {...props} />
}

/** `Content` without margin nor rounded corners */
export function FlatContent(
  props: ComponentProps<typeof Content>
): ReactElement {
  return <Content sx={CONTENT_SX} {...props} />
}
