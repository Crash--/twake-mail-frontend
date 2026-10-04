import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { perfUserExists, seedPerfUser, type PerfUser } from '../scripts/seed-perf'

export const PERF_USER_FILE = path.join(__dirname, '.perf-user.json')

function isPerfUser(value: unknown): value is PerfUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'email' in value &&
    'password' in value &&
    'inboxId' in value &&
    'otherMailboxId' in value
  )
}

/**
 * Seeds the perf user once (5 000 emails in the Inbox, 500 in "Perf folder") and keeps its
 * credentials in perf/.perf-user.json; reused while the stack keeps it.
 */
export default async function globalSetup(): Promise<void> {
  if (existsSync(PERF_USER_FILE)) {
    const stored: unknown = JSON.parse(readFileSync(PERF_USER_FILE, 'utf8'))
    if (isPerfUser(stored) && (await perfUserExists(stored))) {
      console.log(`Perf user ${stored.email} reused`)
      return
    }
  }
  const user = await seedPerfUser()
  writeFileSync(PERF_USER_FILE, `${JSON.stringify(user, null, 2)}\n`)
  console.log(
    `Perf user ${user.email}: ${user.inboxCount} + ${user.otherCount} emails seeded in ${(user.seedMs / 1000).toFixed(1)} s`
  )
}
