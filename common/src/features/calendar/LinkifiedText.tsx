import { Link } from '@linagora/twake-mui'
import { Fragment, type ReactElement } from 'react'

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g

export interface LinkifiedTextProps {
  text: string
}

/**
 * Text of an event file (location, description): its lines kept, its web
 * addresses as links opening in a new tab. Never rendered as HTML.
 */
export function LinkifiedText({ text }: LinkifiedTextProps): ReactElement {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, lineIndex) => (
        // The lines of a fixed text: their position is their identity
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          {line.split(URL_PATTERN).map((part, partIndex) =>
            partIndex % 2 === 1 ? (
              <Link
                key={partIndex}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                // Underlined: the primary blue fails AA (docs/twake-mui-gaps.md)
                color="inherit"
                className="u-breakword"
              >
                {part}
              </Link>
            ) : (
              part
            )
          )}
        </Fragment>
      ))}
    </>
  )
}
