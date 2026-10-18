import { allowsRemoteContent } from './remoteContentPolicy'

const ASKING = {
  isAlwaysShown: false,
  isConsented: false,
  isTrustedSender: false,
  senderEmail: 'news@newsletter.example.org',
  userEmail: 'alice@example.com'
}

describe('allowsRemoteContent', () => {
  it('asks for an outside sender the user did not trust', () => {
    expect(allowsRemoteContent(ASKING)).toBe(false)
  })

  it('shows it when the user wants it for every email', () => {
    expect(allowsRemoteContent({ ...ASKING, isAlwaysShown: true })).toBe(true)
  })

  it('shows it when the user showed it for this email', () => {
    expect(allowsRemoteContent({ ...ASKING, isConsented: true })).toBe(true)
  })

  it('shows it for a trusted sender', () => {
    expect(allowsRemoteContent({ ...ASKING, isTrustedSender: true })).toBe(true)
  })

  it('shows it for a sender of the domain of the user, whatever the case', () => {
    expect(
      allowsRemoteContent({ ...ASKING, senderEmail: 'Bob@Example.COM' })
    ).toBe(true)
    expect(
      allowsRemoteContent({ ...ASKING, senderEmail: 'bob@sub.example.com' })
    ).toBe(false)
  })

  it('asks for an email without a sender', () => {
    expect(allowsRemoteContent({ ...ASKING, senderEmail: null })).toBe(false)
    expect(
      allowsRemoteContent({ ...ASKING, senderEmail: null, isAlwaysShown: true })
    ).toBe(true)
  })
})
