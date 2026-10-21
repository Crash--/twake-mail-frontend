import {
  CAPABILITIES,
  type GetArgs,
  type GetResponse,
  type SetArgs,
  type SetError,
  type SetResponse
} from 'jmap-client-ts'
import {
  LINAGORA_CAPABILITIES,
  LINAGORA_METHOD_CAPABILITIES
} from 'jmap-client-ts/linagora'

/** James delegation extension: `Delegate/*` and `DelegatedAccount/*` */
export const DELEGATION_CAPABILITY = LINAGORA_CAPABILITIES.jamesDelegation

type DelegationCapability = typeof DELEGATION_CAPABILITY

/** tmail-backend team mailboxes: `TeamMailbox/revokeAccess` */
export const TEAM_MAILBOXES_CAPABILITY = LINAGORA_CAPABILITIES.teamMailboxes

const MAIL_CAPABILITY = CAPABILITIES.mail

/**
 * A delegation of the James extension: `username` is the address of the
 * delegate (`Delegate`) or of the owner of the account delegated to the
 * user (`DelegatedAccount`)
 */
export interface Delegation {
  id: string
  username: string
}

// Not in jmap-client-ts yet
declare module 'jmap-client-ts' {
  interface JmapMethods {
    'Delegate/get': {
      capability: DelegationCapability
      args: GetArgs<Delegation>
      response: GetResponse<Delegation>
    }
    'Delegate/set': {
      capability: DelegationCapability
      args: SetArgs<Delegation, Pick<Delegation, 'username'>>
      response: SetResponse<Delegation>
    }
    'DelegatedAccount/get': {
      capability: DelegationCapability
      args: GetArgs<Delegation>
      response: GetResponse<Delegation>
    }
    'DelegatedAccount/set': {
      capability: DelegationCapability
      args: SetArgs<Delegation, never>
      response: SetResponse<Delegation>
    }
    /** The user leaves these team mailboxes, given by their address */
    'TeamMailbox/revokeAccess': {
      capability: typeof TEAM_MAILBOXES_CAPABILITY | typeof MAIL_CAPABILITY
      args: { accountId: string; ids: string[] }
      response: {
        accountId: string
        revoked?: string[] | null
        notRevoked?: Record<string, SetError> | null
      }
    }
  }
}

/** The capabilities of the extension methods, as `createClient` takes them */
export const METHOD_CAPABILITIES = {
  ...LINAGORA_METHOD_CAPABILITIES,
  'Delegate/get': DELEGATION_CAPABILITY,
  'Delegate/set': DELEGATION_CAPABILITY,
  'DelegatedAccount/get': DELEGATION_CAPABILITY,
  'DelegatedAccount/set': DELEGATION_CAPABILITY,
  // tmail-backend wants the mail capability too
  'TeamMailbox/revokeAccess': [TEAM_MAILBOXES_CAPABILITY, MAIL_CAPABILITY]
} as const
