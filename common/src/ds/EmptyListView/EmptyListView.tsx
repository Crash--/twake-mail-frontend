// Upstream to twake-ui: maybe, as a variant of `Empty`. The empty email list
// of tmail-flutter (`EmptyEmailsWidget`) has its own drawing, a narrower
// column and its own type scale, none of which `Empty` takes (its icon is a
// twake-icons glyph, its title an h3 of the theme). Kept local until the
// Twake design system decides whether the other apps want it.
import { styled } from '@mui/material/styles'
import type { ReactElement } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

import { EmptyFolderIllustration } from './EmptyFolderIllustration'

// tmail-flutter's AppColor.gray424244, at the opacities of the widget
const TITLE_COLOR = 'rgba(66, 66, 68, 0.9)'
const TEXT_COLOR = 'rgba(66, 66, 68, 0.64)'

const Root = styled('div')({
  display: 'flex',
  flex: '1 0 auto',
  justifyContent: 'center'
})

// EmptyEmailsWidgetStyles: 352.07 px wide at most, 16 px of padding, centred
// in the pane, at the top on a phone
const Column = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: 352.07,
  padding: 16,
  textAlign: 'center',
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    justifyContent: 'flex-start'
  }
})

const Illustration = styled(EmptyFolderIllustration)({
  flex: 'none',
  width: 160,
  height: 160
})

// ThemeUtils.textStyleInter600()
const Title = styled('p')(({ theme }) => ({
  margin: '16px 0 8px',
  fontFamily: theme.typography.fontFamily,
  fontWeight: 600,
  fontSize: 24,
  lineHeight: 28.01 / 24,
  letterSpacing: 0,
  color: TITLE_COLOR,
  // The translations break the line where tmail-flutter does
  whiteSpace: 'pre-line'
}))

// ThemeUtils.textStyleInter400, as the widget overrides it
const Text = styled('p')(({ theme }) => ({
  margin: 0,
  fontFamily: theme.typography.fontFamily,
  fontWeight: 400,
  fontSize: 16,
  lineHeight: 21.01 / 16,
  letterSpacing: -0.15,
  color: TEXT_COLOR
}))

export interface EmptyListViewProps {
  title: string
  /** Below the title, in grey; none when null */
  text?: string | null
  'data-testid'?: string
}

/**
 * An empty list of emails, as tmail-flutter draws it: the empty folder
 * drawing (decorative), the reason in bold and an optional hint below.
 */
export function EmptyListView({
  title,
  text = null,
  'data-testid': testId
}: EmptyListViewProps): ReactElement {
  return (
    <Root data-testid={testId}>
      <Column>
        <Illustration />
        <Title>{title}</Title>
        {text === null ? null : <Text>{text}</Text>}
      </Column>
    </Root>
  )
}
