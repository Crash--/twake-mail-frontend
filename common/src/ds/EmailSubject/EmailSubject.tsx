// Upstream to twake-ui: no, the look of tmail-flutter's reading view
// (`EmailSubjectStyles`): the subject in Inter Medium 24/30.86, black, with
// a -0.24 letter spacing, on two lines at most; the theme's `h4` is bold and
// grey.
import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const SUBJECT_SX = {
  fontSize: 24,
  fontWeight: 500,
  // `textStyleInter500`: a height of 18 / 14
  lineHeight: 18 / 14,
  letterSpacing: '-0.24px',
  // tmail-flutter draws the static Inter: the optical size of the variable
  // one would narrow the glyphs at 24 px
  fontOpticalSizing: 'none',
  color: TMAIL.textBlack,
  overflowWrap: 'anywhere',
  // `maxLines: 2` with an ellipsis on the web; the whole subject stays in
  // the heading for assistive technologies
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
} as const

export interface EmailSubjectProps {
  children: ReactNode
  /** Takes the focus when the view opens (`tabIndex={-1}`) */
  ref?: Ref<HTMLHeadingElement>
  id?: string
  'data-testid'?: string
}

/** The subject of an open email or conversation, its `h1` */
export function EmailSubject({
  children,
  ref,
  id,
  'data-testid': testId
}: EmailSubjectProps): ReactElement {
  return (
    <Typography
      ref={ref}
      id={id}
      component="h1"
      tabIndex={-1}
      sx={SUBJECT_SX}
      data-testid={testId}
    >
      {children}
    </Typography>
  )
}
