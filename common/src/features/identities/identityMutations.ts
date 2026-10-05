import type { EmailAddress, JmapClient, SetError } from 'jmap-client-ts'

import { IDENTITY_SORT_ORDER_CAPABILITY, type IdentitySummary } from './queries'
import {
  defaultSortOrderUpdates,
  DEFAULT_SORT_ORDER,
  OTHER_SORT_ORDER
} from './identityForm'

/** What the identity form saves */
export interface IdentityValues {
  name: string
  email: string
  replyTo: EmailAddress[]
  bcc: EmailAddress[]
  htmlSignature: string
  textSignature: string
}

export type IdentityMutationResult =
  { ok: true; id: string } | { ok: false; error: SetError | null }

function capabilities(hasSortOrder: boolean): string[] {
  return hasSortOrder ? [IDENTITY_SORT_ORDER_CAPABILITY] : []
}

/**
 * Creates an identity; the default one when `makeDefault` (with the
 * `sortOrder` extension): it comes first, the previous default ones after,
 * in the same `Identity/set`
 */
export async function createIdentity(
  client: JmapClient,
  accountId: string,
  {
    values,
    makeDefault,
    hasSortOrder,
    identities
  }: {
    values: IdentityValues
    makeDefault: boolean
    hasSortOrder: boolean
    identities: readonly IdentitySummary[]
  }
): Promise<IdentityMutationResult> {
  const response = await client.call(
    'Identity/set',
    {
      accountId,
      create: {
        identity: {
          ...values,
          ...(hasSortOrder
            ? { sortOrder: makeDefault ? DEFAULT_SORT_ORDER : OTHER_SORT_ORDER }
            : {})
        }
      },
      update:
        hasSortOrder && makeDefault
          ? defaultSortOrderUpdates(identities, null)
          : null
    },
    { extraCapabilities: capabilities(hasSortOrder) }
  )
  const created = response.created?.identity
  if (created) return { ok: true, id: created.id }
  return { ok: false, error: response.notCreated?.identity ?? null }
}

/**
 * Updates an identity (its address does not change). `isDefault` moves it
 * first or, unchecked on the default one, after the others; null leaves
 * the order as it is.
 */
export async function updateIdentity(
  client: JmapClient,
  accountId: string,
  {
    id,
    values,
    isDefault,
    hasSortOrder,
    identities
  }: {
    id: string
    values: Omit<IdentityValues, 'email'>
    isDefault: boolean | null
    hasSortOrder: boolean
    identities: readonly IdentitySummary[]
  }
): Promise<IdentityMutationResult> {
  const sortOrderUpdates =
    !hasSortOrder || isDefault === null
      ? {}
      : isDefault
        ? defaultSortOrderUpdates(identities, id)
        : { [id]: { sortOrder: OTHER_SORT_ORDER } }
  const response = await client.call(
    'Identity/set',
    {
      accountId,
      update: {
        ...sortOrderUpdates,
        [id]: { ...values, ...sortOrderUpdates[id] }
      }
    },
    { extraCapabilities: capabilities(hasSortOrder) }
  )
  if (response.updated && id in response.updated) return { ok: true, id }
  return { ok: false, error: response.notUpdated?.[id] ?? null }
}

/** Makes an identity the default one (`select_identity_as_default`) */
export async function setDefaultIdentity(
  client: JmapClient,
  accountId: string,
  id: string,
  identities: readonly IdentitySummary[]
): Promise<IdentityMutationResult> {
  const response = await client.call(
    'Identity/set',
    { accountId, update: defaultSortOrderUpdates(identities, id) },
    { extraCapabilities: capabilities(true) }
  )
  if (response.updated && id in response.updated) return { ok: true, id }
  return { ok: false, error: response.notUpdated?.[id] ?? null }
}

export async function deleteIdentity(
  client: JmapClient,
  accountId: string,
  id: string
): Promise<IdentityMutationResult> {
  const response = await client.call('Identity/set', {
    accountId,
    destroy: [id]
  })
  if (response.destroyed?.includes(id)) return { ok: true, id }
  return { ok: false, error: response.notDestroyed?.[id] ?? null }
}
