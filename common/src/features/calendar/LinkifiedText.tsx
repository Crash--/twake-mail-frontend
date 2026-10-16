import { Link } from '@linagora/twake-mui'
import { Fragment, type ReactElement, type ReactNode } from 'react'

import { useComposer } from '@common/features/composer/ComposerProvider'
import { parseMailto } from '@common/features/composer/mailto'
import { findLinks } from '@common/features/email/autolink'

export interface LinkifiedTextProps {
  text: string
}

/**
 * Text of an event file (location, description): its lines kept, its links
 * found as in an email body. Web addresses open in a new tab,
 * email addresses in the composer. Never rendered as HTML.
 */
export function LinkifiedText({ text }: LinkifiedTextProps): ReactElement {
  const { openComposer } = useComposer()

  const renderLine = (line: string): ReactNode[] => {
    const parts: ReactNode[] = []
    let position = 0
    for (const match of findLinks(line)) {
      parts.push(line.slice(position, match.start))
      const mailto = parseMailto(match.href)
      parts.push(
        <Link
          key={match.start}
          href={match.href}
          target={mailto === null ? '_blank' : undefined}
          rel={mailto === null ? 'noopener noreferrer' : undefined}
          onClick={event => {
            if (mailto === null) return
            event.preventDefault()
            openComposer({ mailto })
          }}
          // Underlined: the primary blue fails AA (docs/twake-mui-gaps.md)
          color="inherit"
          className="u-breakword"
        >
          {match.text}
        </Link>
      )
      position = match.end
    }
    parts.push(line.slice(position))
    return parts
  }

  return (
    <>
      {text.split('\n').map((line, lineIndex) => (
        // The lines of a fixed text: their position is their identity
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          {renderLine(line)}
        </Fragment>
      ))}
    </>
  )
}
