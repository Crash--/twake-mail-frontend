import type { Session } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import type { MailboxSummary } from '@common/features/mailbox/queries'

import {
  anyoneRightsWith,
  isSubaddressingAllowed,
  isSubaddressingSupported,
  subaddress,
  subaddressDetail
} from './subaddressing'

const SHARES = LINAGORA_CAPABILITIES.jamesShares

function sessionWith(
  capability?: Record<string, unknown>,
  accountCapability?: Record<string, unknown>
): Pick<Session, 'capabilities' | 'accounts'> {
  return {
    capabilities: capability === undefined ? {} : { [SHARES]: capability },
    accounts: {
      account: {
        name: 'alice@example.com',
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities:
          accountCapability === undefined ? {} : { [SHARES]: accountCapability }
      }
    }
  }
}

function folder(
  id: string,
  name: string,
  parentId: string | null = null
): MailboxSummary {
  return {
    id,
    name,
    parentId,
    role: null,
    sortOrder: 0,
    totalEmails: 0,
    unreadEmails: 0,
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: true,
      mayDelete: true,
      maySubmit: true
    },
    isSubscribed: true,
    namespace: 'Personal'
  }
}

describe('subaddressing', () => {
  it('is supported as the shares capability says, of the account first', () => {
    expect(
      isSubaddressingSupported(
        sessionWith({ subaddressingSupported: true }),
        'account'
      )
    ).toBe(true)
    expect(
      isSubaddressingSupported(
        sessionWith(
          { subaddressingSupported: true },
          { subaddressingSupported: false }
        ),
        'account'
      )
    ).toBe(false)
    expect(isSubaddressingSupported(sessionWith({}), 'account')).toBe(false)
    expect(isSubaddressingSupported(sessionWith(), 'account')).toBe(false)
    expect(
      isSubaddressingSupported(
        sessionWith({ subaddressingSupported: 'yes' }),
        'account'
      )
    ).toBe(false)
  })

  it('is allowed when anyone may post in the folder', () => {
    expect(isSubaddressingAllowed({ anyone: ['p'] })).toBe(true)
    expect(isSubaddressingAllowed({ anyone: ['l', 'r'] })).toBe(false)
    expect(isSubaddressingAllowed({ 'bob@example.com': ['p'] })).toBe(false)
    expect(isSubaddressingAllowed({})).toBe(false)
    expect(isSubaddressingAllowed(undefined)).toBe(false)
  })

  it('gives or takes back the posting right of anyone, keeping the others', () => {
    expect(anyoneRightsWith({}, true)).toEqual(['p'])
    expect(anyoneRightsWith({ anyone: ['l', 'r'] }, true)).toEqual([
      'l',
      'r',
      'p'
    ])
    expect(anyoneRightsWith({ anyone: ['p'] }, true)).toEqual(['p'])
    expect(anyoneRightsWith({ anyone: ['l', 'p'] }, false)).toEqual(['l'])
    expect(anyoneRightsWith(undefined, false)).toEqual([])
  })

  it('names a folder by its path, with dots, by the names the server knows', () => {
    const mailboxes = [
      folder('projects', 'Projects'),
      folder('mongolia', 'Mongolia', 'projects'),
      folder('north', 'North', 'mongolia')
    ]

    expect(subaddressDetail(mailboxes, 'projects')).toBe('Projects')
    expect(subaddressDetail(mailboxes, 'north')).toBe('Projects.Mongolia.North')
    expect(subaddressDetail(mailboxes, 'unknown')).toBe(null)
  })

  it('writes user+detail@domain', () => {
    expect(subaddress('btellier@linagora.com', 'Mongolia')).toBe(
      'btellier+Mongolia@linagora.com'
    )
    expect(subaddress('btellier@linagora.com', 'Projects.Mongolia')).toBe(
      'btellier+Projects.Mongolia@linagora.com'
    )
    expect(subaddress('nodomain', 'Mongolia')).toBe(null)
    expect(subaddress('@linagora.com', 'Mongolia')).toBe(null)
    expect(subaddress('btellier@', 'Mongolia')).toBe(null)
    expect(subaddress('btellier@linagora.com', '')).toBe(null)
  })
})
