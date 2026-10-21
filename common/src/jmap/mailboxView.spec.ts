/**
 * @jest-environment jsdom
 */
import type { Session } from 'jmap-client-ts'

import {
  delegatedMailboxes,
  OWN_VIEW,
  readMailboxView,
  validMailboxView,
  writeMailboxView
} from './mailboxView'

function sessionWith(accounts: Session['accounts']): Session {
  return {
    capabilities: {},
    accounts,
    primaryAccounts: {},
    username: 'me@example.com',
    apiUrl: '',
    downloadUrl: '',
    uploadUrl: '',
    eventSourceUrl: '',
    state: 's'
  }
}

const ACCOUNTS: Session['accounts'] = {
  mine: {
    name: 'me@example.com',
    isPersonal: true,
    isReadOnly: false,
    accountCapabilities: {}
  },
  zed: {
    name: 'zed@example.com',
    isPersonal: false,
    isReadOnly: false,
    accountCapabilities: {}
  },
  ann: {
    name: 'ann@example.com',
    isPersonal: false,
    isReadOnly: false,
    accountCapabilities: {}
  }
}

describe('mailboxView', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('lists the accounts delegated to the user, by address', () => {
    expect(delegatedMailboxes(sessionWith(ACCOUNTS))).toEqual([
      { accountId: 'ann', address: 'ann@example.com' },
      { accountId: 'zed', address: 'zed@example.com' }
    ])
  })

  it('keeps the view of each user in the tab', () => {
    writeMailboxView('me@example.com', { kind: 'team', rootId: 'root-1' })

    expect(readMailboxView('me@example.com')).toEqual({
      kind: 'team',
      rootId: 'root-1'
    })
    expect(readMailboxView('other@example.com')).toEqual(OWN_VIEW)

    writeMailboxView('me@example.com', OWN_VIEW)
    expect(readMailboxView('me@example.com')).toEqual(OWN_VIEW)
  })

  it('reads a broken stored view as the own one', () => {
    window.sessionStorage.setItem(
      'twake-mail-mailbox-view:me@example.com',
      '{"kind":"delegated"'
    )

    expect(readMailboxView('me@example.com')).toEqual(OWN_VIEW)
  })

  it('drops a delegated view the session no longer has', () => {
    const session = sessionWith(ACCOUNTS)

    expect(
      validMailboxView({ kind: 'delegated', accountId: 'zed' }, session)
    ).toEqual({ kind: 'delegated', accountId: 'zed' })
    expect(
      validMailboxView({ kind: 'delegated', accountId: 'gone' }, session)
    ).toEqual(OWN_VIEW)
    expect(
      validMailboxView({ kind: 'delegated', accountId: 'mine' }, session)
    ).toEqual(OWN_VIEW)
  })
})
