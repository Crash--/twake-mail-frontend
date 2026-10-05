import { randomBytes, randomUUID } from 'node:crypto'

import { env } from './env'
import { JmapClient } from './jmap'
import { type Quota, WebAdminClient, WebAdminError } from './webadmin'

/** An account created for one test and deleted after it */
export interface E2EUser {
  /** `<prefix>-<uuid>@example.com` */
  email: string
  password: string
  /** Local part of the address, handy for display assertions */
  localPart: string
}

/** A Twake team mailbox (`<name>@<domain>`) shared by test users */
export interface E2ETeamMailbox {
  email: string
  name: string
}

export interface CreateUserOptions {
  /** Readable start of the local part, `user` by default: `alice` gives `alice-<uuid>@example.com` */
  prefix?: string
  quota?: Quota
}

export interface CreateTeamMailboxOptions {
  members: E2EUser[]
  managers?: E2EUser[]
  /** Readable start of the name, `team` by default */
  prefix?: string
}

/**
 * Creates accounts and team mailboxes through WebAdmin and remembers them, so that
 * `cleanup()` removes everything the test created. The user, not a global reset, is the
 * unit of isolation: tests can run in parallel on one stack.
 */
export class E2EUserFactory {
  readonly #webadmin: WebAdminClient
  readonly #domain: string
  readonly #users: E2EUser[] = []
  readonly #teamMailboxes: E2ETeamMailbox[] = []
  readonly #aliases: { user: E2EUser; alias: string }[] = []

  constructor(
    webadmin: WebAdminClient = new WebAdminClient(),
    domain: string = env.domain
  ) {
    this.#webadmin = webadmin
    this.#domain = domain
  }

  async create(options: CreateUserOptions = {}): Promise<E2EUser> {
    const localPart = `${options.prefix ?? 'user'}-${randomUUID()}`
    const user: E2EUser = {
      email: `${localPart}@${this.#domain}`,
      password: randomBytes(18).toString('base64url'),
      localPart
    }
    await this.#webadmin.createUser(user.email, user.password)
    this.#users.push(user)
    if (options.quota !== undefined) {
      await this.#webadmin.setUserQuota(user.email, options.quota)
    }
    return user
  }

  async createTeamMailbox(
    options: CreateTeamMailboxOptions
  ): Promise<E2ETeamMailbox> {
    const name = `${options.prefix ?? 'team'}-${randomUUID().slice(0, 8)}`
    await this.#webadmin.createTeamMailbox(this.#domain, name)
    const teamMailbox: E2ETeamMailbox = {
      name,
      email: `${name}@${this.#domain}`
    }
    this.#teamMailboxes.push(teamMailbox)
    for (const member of options.members) {
      await this.#webadmin.addTeamMailboxMember(
        this.#domain,
        name,
        member.email,
        'member'
      )
    }
    for (const manager of options.managers ?? []) {
      await this.#webadmin.addTeamMailboxMember(
        this.#domain,
        name,
        manager.email,
        'manager'
      )
    }
    return teamMailbox
  }

  /** An alias of `user` (`<prefix>-<uuid>@<domain>`), delivered to its account */
  async createAlias(user: E2EUser, prefix = 'alias'): Promise<string> {
    const alias = `${prefix}-${randomUUID().slice(0, 8)}@${this.#domain}`
    await this.#webadmin.addAlias(user.email, alias)
    this.#aliases.push({ user, alias })
    return alias
  }

  /**
   * Deletes every alias, team mailbox and account created by this factory, and the emails of
   * those accounts. Already gone is fine.
   */
  async cleanup(): Promise<string[]> {
    const failures: string[] = []
    const ignoreNotFound = async (
      operation: Promise<Response>,
      what: string
    ): Promise<void> => {
      try {
        await operation
      } catch (error: unknown) {
        if (!(error instanceof WebAdminError && error.status === 404)) {
          failures.push(
            `${what}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
    }
    // James keeps the messages of deleted users and team mailboxes: destroy them first,
    // the team ones through their members (DEFAULT_USING has the shares capability)
    for (const user of this.#users) {
      try {
        await JmapClient.forUser(user).destroyAllEmails()
      } catch (error: unknown) {
        failures.push(
          `${user.email} emails: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
    for (const { user, alias } of this.#aliases.splice(0)) {
      await ignoreNotFound(this.#webadmin.deleteAlias(user.email, alias), alias)
    }
    for (const teamMailbox of this.#teamMailboxes.splice(0)) {
      await ignoreNotFound(
        this.#webadmin.deleteTeamMailbox(this.#domain, teamMailbox.name),
        teamMailbox.email
      )
    }
    for (const user of this.#users.splice(0)) {
      await ignoreNotFound(this.#webadmin.deleteUser(user.email), user.email)
    }
    return failures
  }
}
