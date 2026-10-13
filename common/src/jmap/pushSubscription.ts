import type { CAPABILITIES, SetError } from 'jmap-client-ts'

/** RFC 9749: the session gives the VAPID public key of the server */
export const WEBPUSH_VAPID_CAPABILITY = 'urn:ietf:params:jmap:webpush-vapid'

/** RFC 8620 §7.2. The server never gives `url` and `keys` back */
export interface PushSubscriptionCreate {
  deviceClientId: string
  url: string
  keys: { p256dh: string; auth: string } | null
  types: readonly string[] | null
}

export interface PushSubscriptionUpdate {
  verificationCode?: string
  /** UTC date: the server may shorten it */
  expires?: string | null
}

interface PushSubscriptionSetResponse {
  created: Record<string, { id: string; expires?: string | null }> | null
  updated: Record<string, unknown> | null
  destroyed: string[] | null
  notCreated: Record<string, SetError> | null
  notUpdated: Record<string, SetError> | null
  notDestroyed: Record<string, SetError> | null
}

// ponytail: declared here until jmap-client-ts has the push subscriptions
declare module 'jmap-client-ts' {
  interface JmapMethods {
    /** No `accountId`: a push subscription belongs to the user */
    'PushSubscription/set': {
      capability: typeof CAPABILITIES.core
      args: {
        create?: Record<string, PushSubscriptionCreate> | null
        update?: Record<string, PushSubscriptionUpdate> | null
        destroy?: readonly string[] | null
      }
      response: PushSubscriptionSetResponse
    }
  }
}
