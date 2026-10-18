import {
  identityDisplayName,
  identityLabel,
  identitySender
} from './identityName'

describe('identityName', () => {
  it('reads the name of an identity that has one, trimmed', () => {
    const identity = { name: ' Alice Martin ', email: 'alice@example.com' }

    expect(identityDisplayName(identity)).toBe('Alice Martin')
    expect(identityLabel(identity)).toBe('Alice Martin')
    expect(identitySender(identity)).toBe('Alice Martin <alice@example.com>')
  })

  it.each([
    ['blank', ''],
    ['of spaces', '   '],
    [
      'its address, as James names the identities it creates',
      'alice@example.com'
    ],
    ['its address in another case', ' Alice@Example.COM ']
  ])('has no display name when its name is %s', (_case, name) => {
    const identity = { name, email: 'alice@example.com' }

    expect(identityDisplayName(identity)).toBe(null)
    expect(identityLabel(identity)).toBe('alice@example.com')
    expect(identitySender(identity)).toBe('alice@example.com')
  })

  it('keeps a name that is another address: it is the one chosen', () => {
    const identity = { name: 'support@example.com', email: 'alice@example.com' }

    expect(identityDisplayName(identity)).toBe('support@example.com')
  })
})
