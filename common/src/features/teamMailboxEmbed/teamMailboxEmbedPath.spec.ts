import { parseTeamMailboxEmbedPath } from './teamMailboxEmbedPath'

describe('parseTeamMailboxEmbedPath', () => {
  it('reads the address and keeps the path as written for the base', () => {
    expect(
      parseTeamMailboxEmbedPath(
        '/embed/team-mailboxes/Marketing%40example.com/mailbox/m1?x=1#top'
      )
    ).toEqual({
      basename: '/embed/team-mailboxes/Marketing%40example.com',
      address: 'marketing@example.com'
    })
  })

  it('accepts an address written without encoding', () => {
    expect(
      parseTeamMailboxEmbedPath('/embed/team-mailboxes/team@example.com')
    ).toEqual({
      basename: '/embed/team-mailboxes/team@example.com',
      address: 'team@example.com'
    })
  })

  it.each([
    '/mailbox/m1',
    '/embed/team-mailboxes/',
    '/embed/team-mailboxes/not-an-address',
    '/embed/team-mailboxes/%E0%A4%A',
    '/embed/projects/p1'
  ])('is null for %s', path => {
    expect(parseTeamMailboxEmbedPath(path)).toBe(null)
  })
})
