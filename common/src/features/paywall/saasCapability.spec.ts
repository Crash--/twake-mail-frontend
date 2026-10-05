import {
  type SaasCapabilitySource,
  isAlreadyHighestSubscription,
  isPremiumAvailable,
  parseSaasCapability,
  readSaasCapability,
  SAAS_CAPABILITY
} from './saasCapability'

function sessionWith({
  account,
  session
}: {
  account?: unknown
  session?: unknown
}): SaasCapabilitySource {
  return {
    capabilities: session === undefined ? {} : { [SAAS_CAPABILITY]: session },
    accounts: {
      a1: {
        accountCapabilities:
          account === undefined ? {} : { [SAAS_CAPABILITY]: account }
      }
    }
  }
}

describe('parseSaasCapability', () => {
  it('reads the two flags, false when absent', () => {
    expect(parseSaasCapability({ isPaying: true, canUpgrade: true })).toEqual({
      isPaying: true,
      canUpgrade: true
    })
    expect(parseSaasCapability({})).toEqual({
      isPaying: false,
      canUpgrade: false
    })
  })

  it.each([
    ['a string flag', { isPaying: 'true' }],
    ['a null flag', { canUpgrade: null }],
    ['an array', []],
    ['a string', 'yes'],
    ['null', null]
  ])('ignores the capability with %s', (_name, value) => {
    expect(parseSaasCapability(value)).toBeNull()
  })
})

describe('readSaasCapability', () => {
  it('reads the capability of the account', () => {
    const session = sessionWith({
      account: { isPaying: false, canUpgrade: true }
    })

    expect(readSaasCapability(session, 'a1')).toEqual({
      isPaying: false,
      canUpgrade: true
    })
  })

  it('falls back to the one of the session', () => {
    const session = sessionWith({ session: { canUpgrade: true } })

    expect(readSaasCapability(session, 'a1')).toEqual({
      isPaying: false,
      canUpgrade: true
    })
  })

  it('is null without the capability', () => {
    expect(readSaasCapability(sessionWith({}), 'a1')).toBeNull()
    expect(readSaasCapability(sessionWith({}), 'unknown')).toBeNull()
  })
})

describe('the subscription', () => {
  it.each([
    [
      'cannot upgrade, not paying',
      { isPaying: false, canUpgrade: false },
      false,
      false
    ],
    [
      'can upgrade, not paying',
      { isPaying: false, canUpgrade: true },
      true,
      false
    ],
    ['can upgrade, paying', { isPaying: true, canUpgrade: true }, true, false],
    ['the highest plan', { isPaying: true, canUpgrade: false }, false, true],
    ['no capability', null, false, false]
  ])('%s', (_name, capability, premium, highest) => {
    expect(isPremiumAvailable(capability)).toBe(premium)
    expect(isAlreadyHighestSubscription(capability)).toBe(highest)
  })
})
