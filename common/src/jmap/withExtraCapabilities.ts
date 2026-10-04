import type { JmapClient } from 'jmap-client-ts'

interface WithExtras {
  extraCapabilities?: readonly string[]
}

/**
 * The client, adding `extra` to the `using` of every request, as
 * tmail-flutter adds the James shares capability to all its mail requests
 * when the session has it: team mailboxes, their emails and their
 * `namespace` need it. The other methods are the client's.
 */
export function withExtraCapabilities(
  client: JmapClient,
  extra: readonly string[]
): JmapClient {
  if (extra.length === 0) return client
  const merge = <Options extends WithExtras>(
    options: Options | undefined
  ): Options & WithExtras => ({
    ...(options ?? ({} as Options)),
    extraCapabilities: [...extra, ...(options?.extraCapabilities ?? [])]
  })
  return {
    getSession: () => client.getSession(),
    refreshSession: () => client.refreshSession(),
    getPrimaryAccountId: capability => client.getPrimaryAccountId(capability),
    hasCapability: (capability, accountId) =>
      client.hasCapability(capability, accountId),
    onSessionChange: listener => client.onSessionChange(listener),
    call: (method, args, options) => client.call(method, args, merge(options)),
    request: (build, options) => client.request(build, merge(options)),
    requestSettled: (build, options) =>
      client.requestSettled(build, merge(options)),
    upload: (accountId, data, contentType, options) =>
      client.upload(accountId, data, contentType, options),
    getDownloadUrl: params => client.getDownloadUrl(params),
    download: (params, options) => client.download(params, options),
    connectWebSocket: options => client.connectWebSocket(options)
  }
}
