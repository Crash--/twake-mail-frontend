import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

const SUBJECT_SX = {
  overflowWrap: 'anywhere',
  // two lines with an ellipsis; the whole subject stays in the heading for
  // assistive technologies
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
      variant="h4"
      component="h1"
      tabIndex={-1}
      sx={SUBJECT_SX}
      data-testid={testId}
    >
      {children}
    </Typography>
  )
}
