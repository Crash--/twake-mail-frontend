import { env } from './env'

/**
 * Minimal tmail-backend WebAdmin client: what the fixtures need to hand out isolated
 * accounts. https://james.apache.org/server/manage-webadmin.html
 */
export interface Quota {
  /** Maximum number of messages */
  count?: number
  /** Maximum size in bytes */
  size?: number
}

export type TeamMailboxRole = 'member' | 'manager'

export class WebAdminError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'WebAdminError'
    this.status = status
  }
}

export class WebAdminClient {
  readonly #baseUrl: string

  constructor(baseUrl: string = env.webadminUrl) {
    this.#baseUrl = baseUrl
  }

  async healthcheck(): Promise<boolean> {
    const response = await fetch(`${this.#baseUrl}/healthcheck`)
    return response.ok
  }

  async domainExists(domain: string): Promise<boolean> {
    const response = await fetch(
      `${this.#baseUrl}/domains/${encodeURIComponent(domain)}`
    )
    return response.status === 204
  }

  async createDomain(domain: string): Promise<Response> {
    return this.#call('PUT', `/domains/${encodeURIComponent(domain)}`)
  }

  async createUser(email: string, password: string): Promise<Response> {
    return this.#call('PUT', `/users/${encodeURIComponent(email)}`, {
      password
    })
  }

  /**
   * Deletes the account. Its mailboxes and messages stay in the (in memory) store until
   * the stack is stopped: James has no synchronous "delete everything" route, and the
   * address is never reused anyway (random local part).
   */
  async deleteUser(email: string): Promise<Response> {
    return this.#call('DELETE', `/users/${encodeURIComponent(email)}`)
  }

  async setUserQuota(email: string, quota: Quota): Promise<Response> {
    return this.#call('PUT', `/quota/users/${encodeURIComponent(email)}`, quota)
  }

  /** Twake team mailbox: `<name>@<domain>`, shared by its members */
  async createTeamMailbox(domain: string, name: string): Promise<Response> {
    return this.#call(
      'PUT',
      `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(name)}`
    )
  }

  async addTeamMailboxMember(
    domain: string,
    name: string,
    memberEmail: string,
    role: TeamMailboxRole = 'member'
  ): Promise<Response> {
    const path = `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(name)}/members/${encodeURIComponent(memberEmail)}?role=${role}`
    return this.#call('PUT', path)
  }

  async deleteTeamMailbox(domain: string, name: string): Promise<Response> {
    return this.#call(
      'DELETE',
      `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(name)}`
    )
  }

  async #call(method: string, path: string, body?: object): Promise<Response> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!response.ok) {
      const text = await response.text()
      throw new WebAdminError(
        `WebAdmin ${method} ${path} failed: ${response.status} ${text}`,
        response.status
      )
    }
    return response
  }
}
