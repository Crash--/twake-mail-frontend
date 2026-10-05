import { foldQuotedHistory } from './quoteToggle'
import { sanitizeEmailHtml } from './sanitizeEmailHtml'

const LABEL = 'Show trimmed content'

/** The folded part, null when nothing is */
function folded(html: string): string | null {
  const container = document.createElement('div')
  container.innerHTML = foldQuotedHistory(html, LABEL)
  const details = container.querySelector('details.tmail-quoted-history')
  if (details === null) return null
  const summary = details.querySelector(':scope > summary')
  expect(summary?.getAttribute('aria-label')).toBe(LABEL)
  expect(summary?.getAttribute('title')).toBe(LABEL)
  expect(details.hasAttribute('open')).toBe(false)
  summary?.remove()
  return details.innerHTML
}

describe('foldQuotedHistory', () => {
  it('folds the last blockquote of the message', () => {
    expect(
      folded(
        '<p>Answer</p><blockquote>first</blockquote><p>More</p><blockquote>last</blockquote>'
      )
    ).toBe('<blockquote>last</blockquote>')
  })

  it('finds it in a div or a div of a div, as tmail-flutter', () => {
    expect(
      folded('<div><p>Answer</p><blockquote>quoted</blockquote></div>')
    ).toBe('<blockquote>quoted</blockquote>')
    expect(
      folded('<div><div>Answer<blockquote>quoted</blockquote></div></div>')
    ).toBe('<blockquote>quoted</blockquote>')
    expect(
      folded(
        '<div><div><div>Answer<blockquote>quoted</blockquote></div></div></div>'
      )
    ).toBe(null)
  })

  it('folds a Gmail quote with its attribution, the outer one', () => {
    expect(
      folded(
        '<div dir="ltr">Answer</div><div class="gmail_quote"><div class="gmail_attr">On Monday, Bob wrote:</div><blockquote class="gmail_quote">Hi<div class="gmail_quote">older</div></blockquote></div>'
      )
    ).toBe(
      '<div class="gmail_quote"><div class="gmail_attr">On Monday, Bob wrote:</div><blockquote class="gmail_quote">Hi<div class="gmail_quote">older</div></blockquote></div>'
    )
  })

  it('folds an Outlook header and the original after it, from the rule', () => {
    expect(
      folded(
        '<div>Answer</div><hr><div id="divRplyFwdMsg"><b>From:</b> Bob</div><div>Original</div>'
      )
    ).toBe(
      '<hr><div id="divRplyFwdMsg"><b>From:</b> Bob</div><div>Original</div>'
    )
  })

  it('folds a Thunderbird attribution and its quote', () => {
    expect(
      folded(
        '<p>Answer</p><div class="moz-cite-prefix">Bob wrote:</div><blockquote type="cite">Original</blockquote><p>Bye</p>'
      )
    ).toBe(
      '<div class="moz-cite-prefix">Bob wrote:</div><blockquote type="cite">Original</blockquote>'
    )
  })

  it('folds nothing when the quote is all there is, or without one', () => {
    expect(folded('<blockquote>Forwarded alone</blockquote>')).toBe(null)
    expect(folded('<p>No quote</p>')).toBe(null)
  })

  it('counts an image as content before the quote', () => {
    expect(folded('<img alt="logo"><blockquote>quoted</blockquote>')).toBe(
      '<blockquote>quoted</blockquote>'
    )
  })

  it('works on the sanitized HTML, which keeps the marks of the clients', () => {
    const { html } = sanitizeEmailHtml(
      '<div>Answer</div><hr><div id="divRplyFwdMsg">From: Bob</div><div>Original</div><div class="gmail_quote">x</div>'
    )
    expect(html).toContain('id="divRplyFwdMsg"')
    expect(html).toContain('class="gmail_quote"')
  })
})
