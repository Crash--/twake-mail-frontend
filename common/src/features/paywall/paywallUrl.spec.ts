import {
  buildPaywallUrlFromTemplate,
  buildWorkplacePaywallUrl,
  getRootDomain,
  isValidFqdn,
  isValidPaywallUrl,
  normalizeWorkplaceFqdn,
  resolveQualifiedUrl,
  toSafePaywallUrl
} from './paywallUrl'

describe('buildPaywallUrlFromTemplate', () => {
  it.each([
    [
      'replaces raw {localPart} and {domainName}',
      'https://{localPart}.{domainName}/paywall',
      'alice',
      'example.com',
      'https://alice.example.com/paywall'
    ],
    [
      'replaces raw {domainPart} as an alias of {domainName}',
      'https://{localPart}.{domainPart}/paywall',
      'alice',
      'example.com',
      'https://alice.example.com/paywall'
    ],
    [
      'removes {localPart} when null',
      'https://{localPart}.{domainName}/paywall',
      null,
      'example.com',
      'https://.example.com/paywall'
    ],
    [
      'removes {domainName} when null',
      'https://{localPart}.{domainName}/paywall',
      'bob',
      null,
      'https://bob./paywall'
    ],
    [
      'removes both when null',
      'https://{localPart}.{domainName}/paywall',
      null,
      null,
      'https://./paywall'
    ],
    [
      'replaces encoded %7BlocalPart%7D',
      'https://%7BlocalPart%7D.twake.app/paywall',
      'charlie',
      null,
      'https://charlie.twake.app/paywall'
    ],
    [
      'replaces encoded %7BdomainName%7D',
      'https://account.%7BdomainName%7D/paywall',
      null,
      'test.org',
      'https://account.test.org/paywall'
    ],
    [
      'replaces encoded %7BdomainPart%7D as an alias of domainName',
      'https://account.%7BdomainPart%7D/paywall',
      null,
      'test.org',
      'https://account.test.org/paywall'
    ],
    [
      'reads the encoded markers whatever their case',
      'https://%7blocalPart%7d.twake.app/paywall',
      'dora',
      null,
      'https://dora.twake.app/paywall'
    ],
    [
      'removes encoded placeholders when null',
      'https://%7BlocalPart%7D.%7BdomainName%7D/paywall',
      null,
      null,
      'https://./paywall'
    ],
    [
      'mixes raw {localPart} and encoded %7BdomainName%7D',
      'https://{localPart}.%7BdomainName%7D/paywall',
      'eve',
      'hybrid.com',
      'https://eve.hybrid.com/paywall'
    ],
    [
      'mixes encoded %7BlocalPart%7D and raw {domainName}',
      'https://%7BlocalPart%7D.{domainName}/paywall',
      'frank',
      'hybrid.org',
      'https://frank.hybrid.org/paywall'
    ],
    [
      'keeps a template without placeholders',
      'https://static.twake.app/paywall',
      'ghost',
      'ignored.com',
      'https://static.twake.app/paywall'
    ],
    ['returns an empty template as is', '', 'x', 'y.com', ''],
    [
      'fills a template of only {localPart}',
      '{localPart}',
      'single',
      null,
      'single'
    ],
    [
      'fills a template of only {domainName}',
      '{domainName}',
      null,
      'onedomain.com',
      'onedomain.com'
    ],
    [
      'fills repeated placeholders',
      'https://{localPart}.{domainName}/{localPart}-{domainName}/paywall',
      'anna',
      'repeat.com',
      'https://anna.repeat.com/anna-repeat.com/paywall'
    ],
    [
      'fills repeated encoded placeholders',
      'https://%7BlocalPart%7D.%7BdomainName%7D/%7BlocalPart%7D-%7BdomainName%7D/paywall',
      'zoe',
      'repeat.org',
      'https://zoe.repeat.org/zoe-repeat.org/paywall'
    ],
    [
      'fills repeated raw and encoded placeholders',
      'https://{localPart}.%7BdomainName%7D/{localPart}-%7BdomainName%7D/paywall',
      'mix',
      'combo.net',
      'https://mix.combo.net/mix-combo.net/paywall'
    ],
    [
      'fills the template of the Workplace fallback with {localPart} only',
      '{localPart}.twake.linagora.com',
      'alice',
      null,
      'alice.twake.linagora.com'
    ],
    [
      'leaves a placeholder it does not know',
      'https://x.example.com/{other}',
      'a',
      'b.c',
      'https://x.example.com/{other}'
    ]
  ])('%s', (_name, template, localPart, domainName, expected) => {
    expect(
      buildPaywallUrlFromTemplate({ template, localPart, domainName })
    ).toBe(expected)
  })

  it.each([
    'https://domain.tld/{localPart',
    'https://domain.tld/localPart}',
    'https://domain.tld/{}',
    'https://domain.tld/{{localPart}}',
    'https://domain.tld/%7BlocalPart}',
    'https://domain.tld/{localPart%7D'
  ])('returns null for the malformed template %s', template => {
    expect(
      buildPaywallUrlFromTemplate({ template, localPart: 'alice' })
    ).toBeNull()
  })
})

describe('resolveQualifiedUrl', () => {
  it('returns null when a placeholder cannot be filled', () => {
    expect(
      resolveQualifiedUrl('{localPart}.twake.linagora.com', {
        ownerEmail: 'alice'
      })
    ).toBeNull()
  })

  it('resolves a literal pattern without a usable owner email', () => {
    expect(
      resolveQualifiedUrl('workplace.example.com', { ownerEmail: '' })
    ).toBe('workplace.example.com')
  })

  it('fills the placeholder from a parseable address, without the dots', () => {
    expect(
      resolveQualifiedUrl('{localPart}.twake.linagora.com', {
        ownerEmail: 'john.doe@corp.tld'
      })
    ).toBe('johndoe.twake.linagora.com')
  })

  it.each(['domainName', 'domainPart'])(
    'fills {%s} from the explicit domain when given',
    name => {
      expect(
        resolveQualifiedUrl(
          `https://paywall.domain.tld/{localPart}/{${name}}`,
          {
            ownerEmail: 'alice@corp.tld',
            domainName: 'other.tld'
          }
        )
      ).toBe('https://paywall.domain.tld/alice/other.tld')
    }
  )

  it('fills {domainName} from the address without an explicit domain', () => {
    expect(
      resolveQualifiedUrl('https://paywall.domain.tld/{domainName}', {
        ownerEmail: 'alice@corp.tld'
      })
    ).toBe('https://paywall.domain.tld/corp.tld')
  })

  it('returns null when the owner email cannot fill {localPart}', () => {
    expect(
      resolveQualifiedUrl(
        'https://paywall.domain.tld/{localPart}/{domainName}',
        {
          ownerEmail: '',
          domainName: 'domain.tld'
        }
      )
    ).toBeNull()
  })

  it('returns null for a malformed template', () => {
    expect(
      resolveQualifiedUrl('https://paywall.domain.tld/{localPart', {
        ownerEmail: 'alice@corp.tld'
      })
    ).toBeNull()
  })

  it.each([
    ['a local part that would leave the host', 'evil.com/x@corp.tld'],
    ['a local part with a query', 'a?b=c@corp.tld'],
    ['a local part with a port', 'a:80@corp.tld'],
    ['a local part with a percent escape', 'a%2Fb@corp.tld']
  ])('writes nothing of %s in the URL', (_name, ownerEmail) => {
    expect(
      resolveQualifiedUrl('https://{localPart}.paywall.tld/', { ownerEmail })
    ).toBeNull()
  })

  it('refuses an explicit domain with more than a host', () => {
    expect(
      resolveQualifiedUrl('https://paywall.tld/{domainName}', {
        ownerEmail: 'a@b.tld',
        domainName: 'evil.com/path?x'
      })
    ).toBeNull()
  })
})

describe('buildWorkplacePaywallUrl', () => {
  const PAYWALL = 'https://workplace.domain.tld/settings/premium'

  it.each([
    ['a bare FQDN', 'workplace.domain.tld', PAYWALL],
    ['an HTTPS URL', 'https://workplace.domain.tld', PAYWALL],
    ['an uppercase HTTPS scheme', 'HTTPS://workplace.domain.tld', PAYWALL],
    ['a trimmed FQDN', '  workplace.domain.tld  ', PAYWALL],
    ['a null value', null, ''],
    ['a blank value', '   ', ''],
    ['localhost', 'localhost', ''],
    ['an HTTP URL', 'http://workplace.domain.tld', ''],
    ['an unsupported scheme', 'httpx://workplace.domain.tld', ''],
    ['a URL containing user info', 'https://user@workplace.domain.tld', ''],
    ['an unparseable URI', 'https://[invalid', ''],
    ['a URL without a host', 'https:///settings', ''],
    [
      'a URL carrying a path, query and fragment',
      'https://workplace.domain.tld/foo?x=1#fragment',
      PAYWALL
    ],
    ['an uppercase host', 'HTTPS://WORKPLACE.DOMAIN.TLD', PAYWALL],
    [
      'an explicit port',
      'https://workplace.domain.tld:8443',
      'https://workplace.domain.tld:8443/settings/premium'
    ],
    ['a javascript URL', 'javascript:alert(1)', ''],
    [
      'an IP literal host (the FQDN check only counts the parts)',
      'https://192.168.1.1',
      'https://192.168.1.1/settings/premium'
    ]
  ])('handles %s', (_name, input, expected) => {
    expect(buildWorkplacePaywallUrl(input)).toBe(expected)
  })
})

describe('isValidPaywallUrl', () => {
  it.each([
    ['an absolute HTTPS URL', 'https://domain.tld/paywall', true],
    ['an uppercase HTTPS scheme', 'HTTPS://domain.tld/paywall', true],
    ['a fragment route', 'https://domain.tld/#/premium', true],
    ['a null value', null, false],
    ['a blank value', '   ', false],
    ['an HTTP URL', 'http://domain.tld/paywall', false],
    ['a JavaScript URL', 'javascript:alert(1)', false],
    ['a data URL', 'data:text/html,<script>alert(1)</script>', false],
    ['a protocol-relative URL', '//domain.tld/paywall', false],
    ['a relative URL', '/paywall', false],
    ['a URL without a host', 'https:///paywall', false],
    [
      'a host written after three slashes',
      'https:///domain.tld/paywall',
      false
    ],
    ['a host that is not fully qualified', 'https://localhost/paywall', false],
    ['a URL containing user info', 'https://user@domain.tld/paywall', false],
    ['a URL containing a password', 'https://:pw@domain.tld/paywall', false],
    ['an unparseable URI', 'https://[invalid', false],
    ['a URL padded with whitespace', '  https://domain.tld/paywall  ', true],
    ['an explicit port', 'https://domain.tld:8443/paywall', true],
    ['an IP literal host', 'https://192.168.1.1/paywall', true],
    ['a trailing-dot host', 'https://domain.tld./paywall', true]
  ])('handles %s', (_name, input, expected) => {
    expect(isValidPaywallUrl(input)).toBe(expected)
  })
})

describe('toSafePaywallUrl', () => {
  it('gives the URL as the browser reads it', () => {
    expect(toSafePaywallUrl('  HTTPS://Domain.TLD/Pay wall ')).toBe(
      'https://domain.tld/Pay%20wall'
    )
  })

  it('reads a backslash as the browser does, never as another host', () => {
    expect(toSafePaywallUrl('https://good.tld\\@evil.tld/')).toBe(
      'https://good.tld/@evil.tld/'
    )
  })

  it('gives nothing for an unsafe URL', () => {
    expect(toSafePaywallUrl('http://domain.tld/')).toBeNull()
    expect(toSafePaywallUrl(null)).toBeNull()
  })
})

describe('normalizeWorkplaceFqdn', () => {
  it.each([
    ['workplace.domain.tld', 'workplace.domain.tld'],
    ['  https://workplace.domain.tld/ ', 'https://workplace.domain.tld'],
    ['https://workplace.domain.tld:8443', 'https://workplace.domain.tld:8443'],
    ['', null],
    [null, null],
    ['http://workplace.domain.tld', null],
    ['https://workplace.domain.tld/path', null],
    ['https://workplace.domain.tld?x=1', null],
    ['https://workplace.domain.tld#x', null]
  ])('reads %j as %j', (input, expected) => {
    expect(normalizeWorkplaceFqdn(input)).toBe(expected)
  })
})

describe('isValidFqdn', () => {
  it.each([
    ['domain.tld', true],
    ['a.b.c', true],
    ['localhost', false],
    ['', false],
    ['.tld', false]
  ])('%j is %s', (fqdn, expected) => {
    expect(isValidFqdn(fqdn)).toBe(expected)
  })
})

describe('getRootDomain', () => {
  it.each([
    ['mail.twake.valmoriq.fr', 'valmoriq.fr'],
    ['example.com', 'example.com'],
    ['localhost', 'localhost'],
    ['', null]
  ])('the root domain of %j is %j', (hostname, expected) => {
    expect(getRootDomain(hostname)).toBe(expected)
  })
})
