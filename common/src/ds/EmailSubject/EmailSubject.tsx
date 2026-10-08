// Upstream to twake-ui: no, the look of tmail-flutter's reading view
// (`EmailSubjectStyles`): the subject in Inter Medium 24, black, with a
// -0.24 letter spacing; the theme's `h4` is bold and grey.
import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

const SUBJECT_SX = {
  fontSize: 24,
  fontWeight: 500,
  lineHeight: '30px',
  letterSpacing: '-0.24px',
  color: '#000000',
  overflowWrap: 'anywhere'
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
