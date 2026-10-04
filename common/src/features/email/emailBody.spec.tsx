import { makeBodyPart } from '@common/testing/fakeJmapServer'

import {
  buildEmailDocument,
  findReferencedCids,
  plainTextToHtml,
  renderBodyParts,
  sanitizeEmailHtml
} from './emailBody'

describe('sanitizeEmailHtml', () => {
  it('removes scripts, event handlers and javascript URLs', () => {
    const html = sanitizeEmailHtml(
      '<p>Hi</p><script>alert("XSSRobot")</script>' +
        '<img src="x" onerror="alert(1)">' +
        '<a href="javascript:alert(2)">click</a>' +
        '<form action="https://evil.example.com"><input name="password"></form>'
    )

    expect(html).not.toMatch(/script|alert|onerror|javascript:|<form|<input/i)
    expect(html).toContain('<p>Hi</p>')
  })

  it('opens links in a new tab without access to the app', () => {
    const html = sanitizeEmailHtml(
      '<a href="https://linagora.com">Linagora</a>'
    )

    expect(html).toBe(
      '<a href="https://linagora.com" target="_blank" rel="noopener noreferrer">Linagora</a>'
    )
  })

  it('keeps the style of the email', () => {
    expect(sanitizeEmailHtml('<style>p { color: red }</style><p>Red</p>')).toBe(
      '<style>p { color: red }</style><p>Red</p>'
    )
  })

  it('points cid images at their downloaded part', () => {
    const html = sanitizeEmailHtml(
      '<img src="cid:logo@example.com"><img src="cid:missing">',
      new Map([['logo@example.com', 'blob:https://mail.example.com/1']])
    )

    expect(html).toBe('<img src="blob:https://mail.example.com/1"><img>')
  })
})

describe('findReferencedCids', () => {
  it('lists the Content-IDs referenced by cid URLs', () => {
    expect(
      findReferencedCids(
        '<img src="cid:a@example.com"><img src=\'cid:%3Cb%3E\'><p>cid</p>'
      )
    ).toEqual(new Set(['a@example.com', 'b']))
  })
})

describe('renderBodyParts', () => {
  it('sanitizes HTML parts and escapes text parts', () => {
    const content = renderBodyParts(
      [
        makeBodyPart({ partId: '1', type: 'text/plain' }),
        makeBodyPart({ partId: '2', type: 'text/html' })
      ],
      {
        '1': {
          value: 'a < b\nsecond line',
          isEncodingProblem: false,
          isTruncated: false
        },
        '2': {
          value: '<b onclick="steal()">bold</b>',
          isEncodingProblem: false,
          isTruncated: false
        }
      }
    )

    expect(content).toBe(`${plainTextToHtml('a < b\nsecond line')}<b>bold</b>`)
    expect(content).toContain('a &lt; b\nsecond line')
  })
})

describe('buildEmailDocument', () => {
  it('forbids scripts by Content Security Policy', () => {
    const document = buildEmailDocument('<p>Hi</p>')

    expect(document).toContain("default-src 'none'")
    expect(document).toContain('<div id="tmail-content"><p>Hi</p></div>')
  })
})
