import type { LinagoraEcosystem } from '@common/features/ecosystem/ecosystem'

import {
  hasLocalPaywallUrl,
  isPremiumCtaPossible,
  resolvePremiumCta,
  type EcosystemState,
  type PremiumCtaInput
} from './premiumCta'

const CAN_UPGRADE = { isPaying: false, canUpgrade: true }

function ecosystemOf(
  parts: Partial<
    Pick<
      LinagoraEcosystem,
      'paywallUrlTemplate' | 'workplaceFqdnFallbackTemplate'
    >
  >
): EcosystemState {
  return {
    status: 'available',
    ecosystem: {
      paywallUrlTemplate: null,
      workplaceFqdnFallbackTemplate: null,
      sentry: null,
      document: {},
      ...parts
    }
  }
}

function resolve(
  input: Partial<PremiumCtaInput> = {}
): ReturnType<typeof resolvePremiumCta> {
  return resolvePremiumCta({
    capability: CAN_UPGRADE,
    isInsideWorkplace: true,
    workplaceFqdn: null,
    ecosystem: { status: 'unavailable' },
    owner: { email: 'alice@corp.tld', domainName: 'corp.tld' },
    ...input
  })
}

describe('resolvePremiumCta', () => {
  describe('the capability and the place', () => {
    it.each([
      ['no capability', null, 'premiumNotAvailable'],
      [
        'a capability that cannot upgrade',
        { isPaying: false, canUpgrade: false },
        'premiumNotAvailable'
      ],
      [
        'the highest subscription',
        { isPaying: true, canUpgrade: false },
        'highestSubscription'
      ]
    ])('is unavailable with %s', (_name, capability, reason) => {
      expect(
        resolve({ capability, workplaceFqdn: 'workplace.domain.tld' })
      ).toEqual({ status: 'unavailable', reason })
    })

    it('ignores the Workplace outside of it', () => {
      expect(
        resolve({
          isInsideWorkplace: false,
          workplaceFqdn: 'workplace.domain.tld'
        })
      ).toEqual({ status: 'unavailable', reason: 'notInsideWorkplace' })
    })

    it('ignores the ecosystem paywall outside of the Workplace', () => {
      expect(
        resolve({
          isInsideWorkplace: false,
          ecosystem: ecosystemOf({
            paywallUrlTemplate: 'https://pay.domain.tld/'
          })
        })
      ).toEqual({ status: 'unavailable', reason: 'notInsideWorkplace' })
    })

    it('can upgrade a paying account that is not on the highest plan', () => {
      expect(
        resolve({
          capability: { isPaying: true, canUpgrade: true },
          workplaceFqdn: 'workplace.domain.tld'
        })
      ).toEqual({
        status: 'available',
        url: 'https://workplace.domain.tld/settings/premium'
      })
    })
  })

  describe('the destination', () => {
    it('prefers the Workplace without asking the ecosystem', () => {
      expect(
        resolve({
          workplaceFqdn: 'workplace.domain.tld',
          ecosystem: { status: 'loading' }
        })
      ).toEqual({
        status: 'available',
        url: 'https://workplace.domain.tld/settings/premium'
      })
    })

    it('falls back to the template when the Workplace is unusable', () => {
      expect(
        resolve({
          workplaceFqdn: 'localhost',
          ecosystem: ecosystemOf({
            paywallUrlTemplate: 'https://pay.domain.tld/{localPart}'
          })
        })
      ).toEqual({ status: 'available', url: 'https://pay.domain.tld/alice' })
    })

    it('fills the template with the local part and the domain', () => {
      expect(
        resolve({
          owner: { email: 'john.doe@corp.tld', domainName: 'root.tld' },
          ecosystem: ecosystemOf({
            paywallUrlTemplate: 'https://{domainName}/pay?for=%7BlocalPart%7D'
          })
        })
      ).toEqual({
        status: 'available',
        url: 'https://root.tld/pay?for=johndoe'
      })
    })

    it('takes the Workplace of the ecosystem fallback', () => {
      expect(
        resolve({
          ecosystem: ecosystemOf({
            workplaceFqdnFallbackTemplate: '{localPart}.twake.linagora.com',
            paywallUrlTemplate: 'https://pay.domain.tld/'
          })
        })
      ).toEqual({
        status: 'available',
        url: 'https://alice.twake.linagora.com/settings/premium'
      })
    })

    it('prefers the Workplace of the user to the one of the ecosystem', () => {
      expect(
        resolve({
          workplaceFqdn: 'mine.domain.tld',
          ecosystem: ecosystemOf({
            workplaceFqdnFallbackTemplate: '{localPart}.twake.linagora.com'
          })
        })
      ).toEqual({
        status: 'available',
        url: 'https://mine.domain.tld/settings/premium'
      })
    })

    it('is loading until the ecosystem answers', () => {
      expect(resolve({ ecosystem: { status: 'loading' } })).toEqual({
        status: 'loading'
      })
    })

    it('maps a failure of the ecosystem to unavailable', () => {
      expect(resolve({ ecosystem: { status: 'unavailable' } })).toEqual({
        status: 'unavailable',
        reason: 'ecosystemUnavailable'
      })
    })

    it('reports an ecosystem with no paywall', () => {
      expect(resolve({ ecosystem: ecosystemOf({}) })).toEqual({
        status: 'unavailable',
        reason: 'paywallNotConfigured'
      })
    })

    it.each([
      ['an HTTP template', 'http://pay.domain.tld/'],
      ['a JavaScript template', 'javascript:alert(1)'],
      ['a relative template', '/pay'],
      ['a template with credentials', 'https://user@pay.domain.tld/'],
      ['a host that is not a FQDN', 'https://localhost/pay'],
      ['a malformed template', 'https://pay.domain.tld/{localPart'],
      ['a host from the placeholder', 'https://{localPart}/'],
      ['a half-filled template', 'https://pay.domain.tld/{domainName}x']
    ])('refuses %s', (_name, template) => {
      expect(
        resolve({
          owner: { email: 'alice', domainName: null },
          ecosystem: ecosystemOf({ paywallUrlTemplate: template })
        })
      ).toEqual({ status: 'unavailable', reason: 'invalidDestination' })
    })

    it('blocks the CTA when a placeholder cannot be filled', () => {
      expect(
        resolve({
          owner: { email: '', domainName: 'corp.tld' },
          ecosystem: ecosystemOf({
            paywallUrlTemplate: 'https://pay.domain.tld/{localPart}'
          })
        })
      ).toEqual({ status: 'unavailable', reason: 'invalidDestination' })
    })
  })
})

describe('isPremiumCtaPossible and hasLocalPaywallUrl', () => {
  it('asks for the ecosystem only when nothing else gives the URL', () => {
    expect(isPremiumCtaPossible(CAN_UPGRADE, true)).toBe(true)
    expect(isPremiumCtaPossible(CAN_UPGRADE, false)).toBe(false)
    expect(isPremiumCtaPossible(null, true)).toBe(false)
    expect(
      isPremiumCtaPossible({ isPaying: true, canUpgrade: false }, true)
    ).toBe(false)
    expect(hasLocalPaywallUrl('workplace.domain.tld')).toBe(true)
    expect(hasLocalPaywallUrl('localhost')).toBe(false)
    expect(hasLocalPaywallUrl(null)).toBe(false)
  })
})
