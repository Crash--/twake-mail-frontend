import { makeAttachmentReference } from './queries'

describe('makeAttachmentReference', () => {
  it('names the attachment by account, email and blob', () => {
    expect(makeAttachmentReference('a1', 'e1', 'b1')).toEqual({
      type: 'io.cozy.mails.attachments',
      id: 'a1:e1:b1'
    })
  })
})
