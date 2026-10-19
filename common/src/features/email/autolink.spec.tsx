import { elapsedMs, STRESS_TIME_LIMIT_MS } from '@common/testing/redos'

import { autolink, findLinks } from './autolink'

function linkify(html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = html
  autolink(container)
  return container
}

function hrefs(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('a')).map(link =>
    link.getAttribute('href')
  )
}

describe('findLinks', () => {
  it.each([
    ['https://example.com/path', 'https://example.com/path'],
    ['http://example.com', 'http://example.com/'],
    ['HTTPS://EXAMPLE.COM/A', 'https://example.com/A'],
    ['www.example.com', 'https://www.example.com/'],
    ['john.doe+tag@example.co.uk', 'mailto:john.doe+tag@example.co.uk'],
    ['mailto:bob@example.com', 'mailto:bob@example.com'],
    [
      'https://en.wikipedia.org/wiki/Foo_(bar)',
      'https://en.wikipedia.org/wiki/Foo_(bar)'
    ],
    ['https://example.com/a?b=1&c=2#d', 'https://example.com/a?b=1&c=2#d']
  ])('links %s', (text, href) => {
    expect(findLinks(text)).toEqual([
      { text, href, start: 0, end: text.length }
    ])
  })

  it.each([
    [
      'a full stop',
      'See https://example.com/path.',
      'https://example.com/path'
    ],
    ['a comma', 'https://example.com, then', 'https://example.com'],
    ['a parenthesis', '(https://example.com/a)', 'https://example.com/a'],
    ['an angle bracket', '<https://example.com/a>', 'https://example.com/a'],
    ['a semicolon', 'www.example.com;', 'www.example.com'],
    [
      'an exclamation mark',
      'Visit https://example.com!',
      'https://example.com'
    ],
    ['a question mark', 'Seen https://example.com/x?', 'https://example.com/x'],
    ['quotes', '"https://example.com/b"', 'https://example.com/b'],
    ['a guillemet', '« https://example.com/b»', 'https://example.com/b'],
    ['an ellipsis', 'https://example.com/x...', 'https://example.com/x'],
    ['an address full stop', 'Write to a@example.fr.', 'a@example.fr']
  ])('leaves out %s at the end', (_, text, linked) => {
    expect(findLinks(text).map(match => match.text)).toEqual([linked])
  })

  it.each([
    ['a domain without www', 'example.com'],
    ['an ftp URL', 'ftp://example.com/file'],
    ['a javascript URL', 'javascript:alert(1)'],
    [
      'a javascript URL looking like a host',
      'javascript://example.com/%0Aalert(1)'
    ],
    ['a vbscript URL', 'vbscript:msgbox(1)'],
    ['a data URL', 'data:text/html,<script>alert(1)</script>'],
    ['a file URL', 'file:///etc/passwd'],
    ['an address without a top-level domain', 'bob@example'],
    ['an incomplete URL', 'http://']
  ])('does not link %s', (_, text) => {
    expect(findLinks(text)).toEqual([])
  })

  it.each([
    [
      'HTML written in a text part (tf#558)',
      '<a href="https://ci.example.com/job/566/">james/master #566</a>',
      'https://ci.example.com/job/566/'
    ],
    [
      'an attribute after the URL',
      'https://example.com/"onmouseover=alert(1)',
      'https://example.com/'
    ],
    [
      'a tag right after the URL',
      'https://example.com/a<br>',
      'https://example.com/a'
    ]
  ])('ends a URL at a quote or an angle bracket: %s', (_, text, href) => {
    expect(findLinks(text).map(match => match.href)).toEqual([href])
  })
})

describe('autolink', () => {
  it('links the URLs and addresses of the text, the rest kept as text', () => {
    const container = linkify(
      '<p>Go to https://example.com/a. or www.example.org, or write to bob@example.com</p>'
    )

    expect(hrefs(container)).toEqual([
      'https://example.com/a',
      'https://www.example.org/',
      'mailto:bob@example.com'
    ])
    expect(container.textContent).toBe(
      'Go to https://example.com/a. or www.example.org, or write to bob@example.com'
    )
  })

  it('opens the links in a new tab without access to the app', () => {
    const link = linkify('https://example.com').querySelector('a')

    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link?.textContent).toBe('https://example.com')
  })

  it('does not link a link twice', () => {
    const container = linkify(
      '<a href="https://example.com/">see <b>https://example.com</b></a>'
    )

    expect(hrefs(container)).toEqual(['https://example.com/'])
  })

  it.each([
    [
      'a style sheet',
      '<style>p { background: url(https://example.com/x.png) }</style>'
    ],
    ['code', '<code>curl https://example.com/api</code>'],
    ['code in a block', '<pre><code>www.example.com</code></pre>'],
    ['a text area', '<textarea>https://example.com</textarea>'],
    ['a script', '<script>// https://example.com</script>']
  ])('leaves the text of %s', (_, html) => {
    expect(hrefs(linkify(html))).toEqual([])
  })

  it('links the text of a preformatted block', () => {
    expect(hrefs(linkify('<pre>https://example.com/log</pre>'))).toEqual([
      'https://example.com/log'
    ])
  })

  it('never turns text into markup', () => {
    const container = linkify(
      '&lt;img src=x onerror=alert(1)&gt; https://example.com/&lt;script&gt;'
    )

    expect(container.querySelector('img')).toBe(null)
    expect(container.querySelector('script')).toBe(null)
    expect(hrefs(container)).toEqual(['https://example.com/'])
    expect(container.textContent).toContain('<script>')
  })

  it('links several matches in one text node', () => {
    const container = linkify(
      'a@example.com https://x.example.com b@example.com'
    )

    expect(hrefs(container)).toEqual([
      'mailto:a@example.com',
      'https://x.example.com/',
      'mailto:b@example.com'
    ])
  })
})

describe('findLinks against ReDoS', () => {
  it.each([
    ['closing quotes', 'https://example.com/' + '»'.repeat(50_000) + 'x»'],
    ['dots', 'www.' + 'a.'.repeat(25_000)],
    ['hyphens', 'a-'.repeat(25_000)],
    ['runs of the longest length read', ('a-'.repeat(1024) + ' ').repeat(10)],
    ['at signs', 'a@'.repeat(25_000)],
    ['parentheses', 'https://example.com/' + '('.repeat(50_000)]
  ])('reads %s in a linear time', (_, text) => {
    expect(elapsedMs(() => findLinks(text))).toBeLessThan(STRESS_TIME_LIMIT_MS)
  })

  it('links a URL of 2 048 characters, not a longer run', () => {
    const url = 'https://example.com/' + 'a'.repeat(2028)
    expect(findLinks(`see ${url} now`).map(link => link.text)).toEqual([url])
    expect(findLinks(`see ${url}a https://example.com now`)).toEqual([
      {
        text: 'https://example.com',
        href: 'https://example.com/',
        start: 2054,
        end: 2073
      }
    ])
  })

  it('drops the closing quotes after a URL as before', () => {
    expect(findLinks('« https://example.com/a»» »')[0]?.text).toBe(
      'https://example.com/a'
    )
  })
})
