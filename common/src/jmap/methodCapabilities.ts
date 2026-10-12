import { CAPABILITIES } from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

// The methods declared by the app itself
import './pushSubscription'

/** `methodCapabilities` of `createClient`: every method the app declares */
export const METHOD_CAPABILITIES = {
  ...LINAGORA_METHOD_CAPABILITIES,
  'PushSubscription/set': CAPABILITIES.core
}
