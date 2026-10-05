import type { Session } from 'jmap-client-ts'

import {
  downloadAllBaseName,
  expandDownloadAllUrl,
  getDownloadAllEndpoint,
  isDownloadAllAvailable
} from './downloadAll'

const ID = 'com:linagora:params:downloadAll'

function makeSession(
  capabilities: Session['capabilities'],
  accountCapabilities: Session['capabilities'] = {}
): Session {
  return {
    capabilities,
    accounts: {
      a1: {
        name: 'a',
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities
      }
    },
    primaryAccounts: {},
    username: 'a',
    apiUrl: '',
    downloadUrl: '',
    uploadUrl: '',
    eventSourceUrl: '',
    state: ''
  }
}

describe('download all', () => {
  const endpoint =
    'https://jmap.test//downloadAll/{accountId}/{emailId}?name={name}'

  it('reads the endpoint of the session or of the account', () => {
    expect(
      getDownloadAllEndpoint(makeSession({ [ID]: { endpoint } }), 'a1')
    ).toBe(endpoint)
    expect(
      getDownloadAllEndpoint(makeSession({}, { [ID]: { endpoint } }), 'a1')
    ).toBe(endpoint)
  })

  it.each([
    ['no capability', makeSession({})],
    ['no endpoint', makeSession({ [ID]: {} })],
    ['an empty endpoint', makeSession({ [ID]: { endpoint: '' } })],
    ['an endpoint that is not a string', makeSession({ [ID]: { endpoint: 3 } })]
  ])('is unavailable with %s', (_label, session) => {
    expect(isDownloadAllAvailable(session, 'a1', 3)).toBe(false)
  })

  it('needs more than one attachment', () => {
    const session = makeSession({ [ID]: { endpoint } })
    expect(isDownloadAllAvailable(session, 'a1', 1)).toBe(false)
    expect(isDownloadAllAvailable(session, 'a1', 2)).toBe(true)
  })

  it('expands the template and normalizes slashes', () => {
    expect(
      expandDownloadAllUrl(endpoint, {
        accountId: 'a1',
        emailId: 'e 1',
        name: 'TwakeMail-x'
      })
    ).toBe('https://jmap.test/downloadAll/a1/e%201?name=TwakeMail-x')
  })

  it('names the archive after the date, without colons', () => {
    expect(downloadAllBaseName(new Date('2026-10-05T12:34:56Z'))).toBe(
      'TwakeMail-2026-10-05-12-34-56'
    )
  })
})
