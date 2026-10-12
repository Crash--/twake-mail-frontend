import type { JmapClient } from 'jmap-client-ts'

/** The sender of an email: its name, if any, and its address */
export interface EmailSender {
  name: string | null
  email: string
}

/**
 * The senders of the emails `emailIds` (dropped on a recipient field), in
 * their order, each address once
 */
export async function fetchEmailSenders(
  client: JmapClient,
  accountId: string,
  emailIds: readonly string[]
): Promise<EmailSender[]> {
  if (emailIds.length === 0) return []
  const [found] = await client.request(builder => [
    builder.call('Email/get', {
      accountId,
      ids: [...emailIds],
      properties: ['id', 'from']
    })
  ])
  const byId = new Map(found.list.map(email => [email.id, email]))
  const seen = new Set<string>()
  const senders: EmailSender[] = []
  for (const id of emailIds) {
    for (const address of byId.get(id)?.from ?? []) {
      const { email } = address
      const key = email.toLowerCase()
      if (email === '' || seen.has(key)) continue
      seen.add(key)
      const name = address.name?.trim() ?? ''
      senders.push({ name: name === '' ? null : name, email })
    }
  }
  return senders
}
