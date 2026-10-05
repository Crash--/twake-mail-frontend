import { makeBodyPart } from '@common/testing/fakeJmapServer'

import {
  buildEmailDocument,
  findReferencedCids,
  plainTextToHtml,
  plainTextToLinkedHtml,
  renderBodyParts
} from './emailBody'

function textPart(value: string): {
  value: string
  isEncodingProblem: boolean
  isTruncated: boolean
} {
  return { value, isEncodingProblem: false, isTruncated: false }
}

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

    expect(content.html).toBe(
      `${plainTextToHtml('a < b\nsecond line')}<b>bold</b>`
    )
    expect(content.html).toContain('a &lt; b\nsecond line')
  })

  it('counts the remote content left out of its HTML parts', () => {
    const content = renderBodyParts(
      [makeBodyPart({ partId: '1', type: 'text/html' })],
      {
        '1': {
          value: '<img src="https://tracker.example.com/p.gif">',
          isEncodingProblem: false,
          isTruncated: false
        }
      }
    )

    expect(content).toEqual({ html: '<img>', blockedRemoteContent: 1 })
  })

  it('links the bare URLs and addresses of text and HTML parts', () => {
    const content = renderBodyParts(
      [
        makeBodyPart({ partId: '1', type: 'text/plain' }),
        makeBodyPart({ partId: '2', type: 'text/html' })
      ],
      {
        '1': textPart('See https://example.com/a.'),
        '2': textPart(
          '<p>www.example.org or <a href="https://example.net">https://example.net</a></p>'
        )
      }
    )

    expect(content.html).toBe(
      '<div class="tmail-plain-text">See <a href="https://example.com/a" target="_blank" rel="noopener noreferrer">https://example.com/a</a>.</div>' +
        '<p><a href="https://www.example.org/" target="_blank" rel="noopener noreferrer">www.example.org</a> or <a href="https://example.net" target="_blank" rel="noopener noreferrer">https://example.net</a></p>'
    )
  })
})

describe('plainTextToLinkedHtml', () => {
  it('escapes the text, line breaks kept', () => {
    expect(plainTextToLinkedHtml('a < b & "c"\n<script>x</script>')).toBe(
      '<div class="tmail-plain-text">a &lt; b &amp; "c"\n&lt;script&gt;x&lt;/script&gt;</div>'
    )
  })

  it('links an address to write to', () => {
    expect(plainTextToLinkedHtml('bob@example.com')).toBe(
      '<div class="tmail-plain-text"><a href="mailto:bob@example.com" target="_blank" rel="noopener noreferrer">bob@example.com</a></div>'
    )
  })

  it('is not what the composer quotes: plainTextToHtml keeps URLs as text', () => {
    expect(plainTextToHtml('https://example.com')).toBe(
      '<div class="tmail-plain-text">https://example.com</div>'
    )
  })
})

describe('buildEmailDocument', () => {
  it('forbids scripts and remote content by Content Security Policy', () => {
    const document = buildEmailDocument('<p>Hi</p>')

    expect(document).toContain(
      "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:"
    )
    expect(document).toContain('<meta name="referrer" content="no-referrer">')
    expect(document).toContain('<div id="tmail-content"><p>Hi</p></div>')
  })

  it('lets remote images and fonts load once allowed, without referrer', () => {
    const document = buildEmailDocument('<p>Hi</p>', {
      allowRemoteContent: true
    })

    expect(document).toContain('img-src data: blob: https: http:')
    expect(document).toContain('font-src data: https: http:')
    expect(document).toContain('<meta name="referrer" content="no-referrer">')
  })
})
