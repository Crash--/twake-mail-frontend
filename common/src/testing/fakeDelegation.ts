import { FAKE_ACCOUNT_ID, type FakeJmapServer } from './fakeJmapServer'

/** Capability of the James delegation extension */
export const FAKE_DELEGATION_CAPABILITIES = {
  'urn:apache:james:params:jmap:delegation': {}
}

interface FakeDelegation {
  id: string
  username: string
}

function idsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(item => typeof item === 'string')
    : []
}

/**
 * `Delegate/*` and `DelegatedAccount/*` of James: the delegates of the
 * user, and the accounts delegated to them (`server.delegatedAccounts`,
 * which the session lists). Giving up a delegated account takes it out of
 * the session too. A delegate whose address is in `refused` is not created.
 */
export function installFakeDelegation(
  server: FakeJmapServer,
  {
    delegates = [],
    refused = []
  }: { delegates?: string[]; refused?: string[] } = {}
): { delegates: () => string[] } {
  let next = 0
  let current: FakeDelegation[] = delegates.map(username => ({
    id: `delegate-${(next += 1)}`,
    username
  }))
  const get = (list: FakeDelegation[]): Record<string, unknown> => ({
    accountId: FAKE_ACCOUNT_ID,
    state: 'delegation-1',
    list,
    notFound: []
  })
  server.handlers.set('Delegate/get', () => get(current))
  server.handlers.set('Delegate/set', args => {
    const create: [string, unknown][] =
      typeof args.create === 'object' && args.create !== null
        ? Object.entries(args.create as Record<string, unknown>)
        : []
    const created: Record<string, unknown> = {}
    const notCreated: Record<string, unknown> = {}
    for (const [creationId, value] of create) {
      const username =
        typeof value === 'object' && value !== null && 'username' in value
          ? String(value.username)
          : ''
      if (refused.includes(username)) {
        notCreated[creationId] = { type: 'invalidArguments' }
        continue
      }
      const id = `delegate-${(next += 1)}`
      current = [...current, { id, username }]
      created[creationId] = { id }
    }
    const destroy = idsOf(args.destroy)
    current = current.filter(delegation => !destroy.includes(delegation.id))
    return {
      accountId: FAKE_ACCOUNT_ID,
      newState: 'delegation-2',
      created,
      notCreated,
      destroyed: destroy
    }
  })
  server.handlers.set('DelegatedAccount/get', () =>
    get(
      server.delegatedAccounts.map(account => ({
        id: `delegated-${account.accountId}`,
        username: account.name
      }))
    )
  )
  server.handlers.set('DelegatedAccount/set', args => {
    const destroy = idsOf(args.destroy)
    server.delegatedAccounts = server.delegatedAccounts.filter(
      account => !destroy.includes(`delegated-${account.accountId}`)
    )
    return {
      accountId: FAKE_ACCOUNT_ID,
      newState: 'delegation-2',
      destroyed: destroy
    }
  })
  return { delegates: () => current.map(delegation => delegation.username) }
}
