import {
  FAKE_ACCOUNT_ID,
  type FakeEmail,
  type FakeJmapServer
} from './fakeJmapServer'
import { collapseThreads, matchesFilter, sortEmails } from './fakeEmailQuery'

/**
 * Answers `Email/query` from `indexed`, a search index that missed later
 * updates of the emails (a flag, a move), while `Email/get` reads the
 * emails as they are: `Email/query` no longer agrees with `Email/get`
 */
export function answerQueriesFromStaleIndex(
  server: FakeJmapServer,
  indexed: readonly FakeEmail[]
): void {
  server.handlers.set('Email/query', args => {
    const found = sortEmails(
      indexed.filter(email => matchesFilter(email, args.filter)),
      args.sort
    )
    const matching =
      args.collapseThreads === true ? collapseThreads(found) : found
    const position = typeof args.position === 'number' ? args.position : 0
    const limit = typeof args.limit === 'number' ? args.limit : matching.length
    return {
      accountId: FAKE_ACCOUNT_ID,
      queryState: 'q1',
      canCalculateChanges: false,
      position,
      ids: matching.slice(position, position + limit).map(email => email.id),
      total: matching.length
    }
  })
}
