import { decodeEntities, parseSnippet } from './snippet'

describe('decodeEntities', () => {
  it('decodes named, decimal and hexadecimal references', () => {
    expect(decodeEntities('&lt;b&gt; &amp; &quot;x&quot; &#39;y&#x2F;')).toBe(
      '<b> & "x" \'y/'
    )
  })

  it('keeps unknown or invalid references as they are', () => {
    expect(decodeEntities('&unknown; &#xD800; &#0;')).toBe(
      '&unknown; &#xD800; &#0;'
    )
  })
})

describe('parseSnippet', () => {
  it('splits the marked matches from the text', () => {
    expect(parseSnippet('Body with <mark>Search</mark> keyword')).toEqual([
      { text: 'Body with ', isMatch: false },
      { text: 'Search', isMatch: true },
      { text: ' keyword', isMatch: false }
    ])
  })

  it('shows escaped markup literally, as the subject was typed', () => {
    expect(
      parseSnippet('&lt;<mark>Search</mark> snippets html escape&gt;')
    ).toEqual([
      { text: '<', isMatch: false },
      { text: 'Search', isMatch: true },
      { text: ' snippets html escape>', isMatch: false }
    ])
  })

  it('keeps other tags as text when the server did not escape them', () => {
    expect(parseSnippet('<img src=x onerror=alert(1)><mark>a</mark>')).toEqual([
      { text: '<img src=x onerror=alert(1)>', isMatch: false },
      { text: 'a', isMatch: true }
    ])
  })

  it('merges adjacent matches and ignores empty pieces', () => {
    expect(parseSnippet('<mark>Se</mark><mark>arch</mark>')).toEqual([
      { text: 'Search', isMatch: true }
    ])
    expect(parseSnippet('')).toEqual([])
  })
})
