import type { Session } from '@linagora/jmap-client-ts'

import { expandBlobAccessUrl, getBlobAccessEndpoint } from './blobDownloadUrl'

const ID = 'com:linagora:params:jmap:unauthenticated:blob:access'
const ENDPOINT =
  'https://jmap.example.com/unauthenticatedDownload/{accountId}/{blobId}?token={token}'

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

describe('unauthenticated blob access', () => {
  it('reads the endpoint of the session or of the account', () => {
    const capability = { endpoint: ENDPOINT, tokenTtlInSeconds: 300 }
    expect(getBlobAccessEndpoint(makeSession({ [ID]: capability }), 'a1')).toBe(
      ENDPOINT
    )
    expect(
      getBlobAccessEndpoint(makeSession({}, { [ID]: capability }), 'a1')
    ).toBe(ENDPOINT)
  })

  it.each<Session['capabilities']>([
    {},
    { [ID]: {} },
    { [ID]: { endpoint: '' } }
  ])('has no endpoint without the capability (%j)', capabilities => {
    expect(getBlobAccessEndpoint(makeSession(capabilities), 'a1')).toBe(null)
  })

  it('fills the template with encoded values, even an encoded template', () => {
    const values = { accountId: 'a/1', blobId: 'm1_2', token: 't&k' }
    const expected =
      'https://jmap.example.com/unauthenticatedDownload/a%2F1/m1_2?token=t%26k'

    expect(expandBlobAccessUrl(ENDPOINT, values)).toBe(expected)
    expect(expandBlobAccessUrl(encodeURI(ENDPOINT), values)).toBe(expected)
  })
})
