import { createClient, type JmapClient } from 'jmap-client-ts'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeBodyPart,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { InlineImageStore } from './InlineImageStore'
import type { QuoteLabels } from './quote'
import { loadReplyContent, type ReplyLabels } from './replyContent'
import { makeIsSelf } from './replyRecipients'

const QUOTE_LABELS: QuoteLabels = {
  replyHeader: (date, address) => `On ${date}, ${address} wrote:`,
  dateTime: (date, time) => `${date} at ${time}`,
  forwarded: 'Forwarded message',
  subject: 'Subject',
  date: 'Date',
  from: 'From',
  to: 'To',
  cc: 'Cc',
  bcc: 'Bcc',
  replyTo: 'Reply to'
}

const LABELS: ReplyLabels = {
  quote: QUOTE_LABELS,
  replyPrefix: 'Re:',
  forwardPrefix: 'Fwd:'
}

function makeClient(server: FakeJmapServer): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: server.fetch,
    methodCapabilities: METHOD_CAPABILITIES
  })
}

function serverWithInlinePart(type: string): FakeJmapServer {
  const server = makeFakeJmapServer({
    emails: [
      makeEmailWithBody(
        {
          id: 'e1',
          attachments: [
            makeBodyPart({
              type,
              blobId: 'blob-inline',
              cid: '<part@example.com>',
              disposition: 'inline',
              name: 'part'
            })
          ]
        },
        { html: '<p>Look</p><img src="cid:part@example.com">' }
      )
    ]
  })
  // The fake server answers without the declared type
  server.blobs.set('blob-inline', '<script>alert(1)</script>')
  return server
}

async function forward(
  server: FakeJmapServer
): Promise<{ images: InlineImageStore; attachmentTypes: string[] }> {
  const client = makeClient(server)
  const images = new InlineImageStore(client, FAKE_ACCOUNT_ID)
  const content = await loadReplyContent(
    client,
    FAKE_ACCOUNT_ID,
    { emailId: 'e1', action: 'forward' },
    [],
    [],
    images,
    LABELS,
    'en',
    makeIsSelf([]),
    () => false
  )
  return {
    images,
    attachmentTypes: content.attachments.map(attachment => attachment.type)
  }
}

describe('loadReplyContent inline images', () => {
  it('shows a raster image inline, its blob typed as an image', async () => {
    const createObjectURL = jest.spyOn(URL, 'createObjectURL')

    const { images, attachmentTypes } = await forward(
      serverWithInlinePart('image/png')
    )

    expect(images.get('part@example.com')?.url).not.toBe(null)
    expect(attachmentTypes).toEqual([])
    const [blob] = createObjectURL.mock.calls.at(-1) ?? []
    expect(blob && 'type' in blob ? blob.type : null).toBe('image/png')
  })

  it.each(['text/html', 'image/svg+xml', 'application/xml'])(
    'keeps a part declared %s as an attachment, never an inline image',
    async type => {
      const createObjectURL = jest.spyOn(URL, 'createObjectURL')

      const { images, attachmentTypes } = await forward(
        serverWithInlinePart(type)
      )

      expect(images.get('part@example.com')).toBe(null)
      expect(attachmentTypes).toEqual([type])
      expect(createObjectURL).not.toHaveBeenCalled()
    }
  )
})
