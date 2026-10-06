import { parseTeamMailboxEmbedPath } from './teamMailboxEmbedPath'

describe('parseTeamMailboxEmbedPath', () => {
  it('reads the id of the root of the team mailbox', () => {
    expect(
      parseTeamMailboxEmbedPath(
        '/embed/team-mailboxes/5b098274-c18f-11f1-81f5-15d254926254/mailbox/m1?x=1#top'
      )
    ).toEqual({
      basename: '/embed/team-mailboxes/5b098274-c18f-11f1-81f5-15d254926254',
      rootId: '5b098274-c18f-11f1-81f5-15d254926254'
    })
  })

  it.each([
    '/mailbox/m1',
    '/embed/team-mailboxes/',
    '/embed/team-mailboxes/team%40example.com',
    '/embed/team-mailboxes/team@example.com',
    `/embed/team-mailboxes/${'a'.repeat(256)}`,
    '/embed/projects/p1'
  ])('is null for %s', path => {
    expect(parseTeamMailboxEmbedPath(path)).toBe(null)
  })
})
