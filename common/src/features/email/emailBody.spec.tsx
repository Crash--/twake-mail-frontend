import { makeBodyPart } from '@common/testing/fakeJmapServer'

import {
  buildEmailDocument,
  findReferencedCids,
  plainTextToHtml,
  renderBodyParts
} from './emailBody'

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
