// Upstream to twake-ui: maybe, as a variant of `Empty`. The empty email list
// draws an illustration, a narrower column and a title that keeps the line
// breaks of the translation; `Empty` takes a twake-icons glyph only. Kept
// local until the Twake design system decides whether the other apps want it.
import { styled } from '@mui/material/styles'
import type { ReactElement } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

import { EmptyFolderIllustration } from './EmptyFolderIllustration'

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

// twake-mui's `Empty` title and text: h3 in text.primary, body1 in
// text.secondary
const Title = styled('p')(({ theme }) => ({
  ...theme.typography.h3,
  margin: '16px 0 8px',
  color: theme.vars.palette.text.primary,
  // The translations break the line where tmail-flutter does
  whiteSpace: 'pre-line'
}))

const Text = styled('p')(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  color: theme.vars.palette.text.secondary
}))

export interface EmptyListViewProps {
  title: string
  /** Below the title, in grey; none when null */
  text?: string | null
  'data-testid'?: string
}

/**
 * An empty list of emails: the empty folder drawing (decorative), the reason
 * as a title and an optional hint below.
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
