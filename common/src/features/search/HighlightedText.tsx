import { useMemo, type ReactElement } from 'react'

import { parseSnippet } from './snippet'

export interface HighlightedTextProps {
  /** The text as stored, shown when there is no snippet */
  text: string
  /** The same text, HTML-escaped with its matches in `<mark>` (search) */
  snippet: string | null
}

/**
 * A subject or a preview in search results, the matches in `<mark>`
 * (announced as highlighted by screen readers that support it). The
 * snippet is rendered as text, never as HTML.
 */
export function HighlightedText({
  text,
  snippet
}: HighlightedTextProps): ReactElement {
  const segments = useMemo(
    () => (snippet === null ? null : parseSnippet(snippet)),
    [snippet]
  )
  if (!segments?.some(segment => segment.isMatch)) {
    return <>{text}</>
  }
  return (
    <>
      {segments.map((segment, index) =>
        segment.isMatch ? <mark key={index}>{segment.text}</mark> : segment.text
      )}
    </>
  )
}
