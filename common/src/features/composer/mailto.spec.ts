import { mailtoBodyHtml, mailtoFromSearch, parseMailto } from './mailto'

describe('parseMailto', () => {
  it('reads the addresses and the fields of RFC 6068', () => {
    expect(
      parseMailto(
        'mailto:alice@example.com,bob@example.com?cc=carol@example.com&bcc=dan@example.com&subject=Hello%20there&body=Line%201%0ALine%202&to=erin@example.com'
      )
    ).toEqual({
      to: ['alice@example.com', 'bob@example.com', 'erin@example.com'],
      cc: ['carol@example.com'],
      bcc: ['dan@example.com'],
      subject: 'Hello there',
      body: 'Line 1\nLine 2'
    })
  })

  it('decodes once, keeps a plus, ignores the other fields', () => {
    expect(
      parseMailto(
        'MAILTO:a%2Bb@example.com?Subject=1+1%3D2%2520&in-reply-to=%3Cx@y%3E'
      )
    ).toEqual({
      to: ['a+b@example.com'],
      cc: [],
      bcc: [],
      subject: '1+1=2%20',
      body: null
    })
    expect(parseMailto('https://example.com')).toBe(null)
  })
})

describe('mailtoFromSearch', () => {
  it('reads the uri parameter, and the fields given beside it', () => {
    expect(
      mailtoFromSearch(
        '?uri=mailto%3Ashared-recipient%40example.com%3Fsubject%3DHello%26body%3DWorld'
      )
    ).toEqual({
      to: ['shared-recipient@example.com'],
      cc: [],
      bcc: [],
      subject: 'Hello',
      body: 'World'
    })
    expect(
      mailtoFromSearch(
        '?uri=mailto:u1@example.com&cc=u2@example.com&subject=Hi'
      )
    ).toMatchObject({
      to: ['u1@example.com'],
      cc: ['u2@example.com'],
      subject: 'Hi'
    })
    expect(mailtoFromSearch('?uri=user@example.com')).toMatchObject({
      to: ['user@example.com']
    })
    expect(mailtoFromSearch('')).toBe(null)
  })
})

describe('mailtoBodyHtml', () => {
  it('writes the text as paragraphs, markup escaped', () => {
    expect(mailtoBodyHtml('Hi <b>you</b>\r\n\r\nBye')).toBe(
      '<p>Hi &lt;b&gt;you&lt;/b&gt;</p><p></p><p>Bye</p>'
    )
  })
})
