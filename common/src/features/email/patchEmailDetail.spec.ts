import { makeEmail } from '@common/testing/fakeJmapServer'

import { patchEmailDetail } from './patchEmailDetail'
import type { EmailDetail } from './queries'

function detail(): EmailDetail {
  return {
    ...makeEmail({ id: 'e1' }),
    bcc: null,
    htmlBody: [],
    bodyValues: {},
    attachments: []
  }
}

describe('patchEmailDetail', () => {
  it('takes the new keywords and mailboxes of the opened email', () => {
    const patched = patchEmailDetail(detail(), {
      changed: [
        makeEmail({
          id: 'e1',
          keywords: { $seen: true },
          mailboxIds: { 'mailbox-archive': true }
        })
      ],
      destroyed: []
    })

    expect(patched?.keywords).toEqual({ $seen: true })
    expect(patched?.mailboxIds).toEqual({ 'mailbox-archive': true })
    expect(patched?.subject).toBe('Subject e1')
  })

  it('becomes null once the email is destroyed', () => {
    expect(patchEmailDetail(detail(), { changed: [], destroyed: ['e1'] })).toBe(
      null
    )
  })

  it('leaves an email that did not change as it is', () => {
    const opened = detail()

    expect(
      patchEmailDetail(opened, {
        changed: [makeEmail({ id: 'e2' })],
        destroyed: []
      })
    ).toBe(opened)
  })
})
