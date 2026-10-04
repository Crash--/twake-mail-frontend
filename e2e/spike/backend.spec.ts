import { expect, test } from '../support/fixtures'

// 1x1 red PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
)

test('SPIKE-BACKEND multipart/related with a cid image goes through Email/set + EmailSubmission/set', async ({
  user,
  users,
  jmap,
  jmapFor
}) => {
  const bob = await users.create({ prefix: 'bob' })
  const accountId = await jmap.accountId()
  const [identities] = await jmap.request([
    ['Identity/get', { accountId, ids: null }, 'i']
  ])
  const identity = (identities?.[1].list as { id: string; email: string }[])[0]
  expect(identity?.email).toBe(user.email)
  const drafts = await jmap.findMailboxByRole('drafts')
  const sent = await jmap.findMailboxByRole('sent')
  const blob = await jmap.upload(PNG, 'image/png')

  const html = '<div>Hello <b>bob</b></div><div><img src="cid:img1@spike" alt="red"></div>'
  const responses = await jmap.request([
    [
      'Email/set',
      {
        accountId,
        create: {
          draft: {
            mailboxIds: { [drafts.id]: true },
            keywords: { $draft: true, $seen: true },
            from: [{ email: user.email }],
            to: [{ email: bob.email }],
            subject: 'multipart related',
            bodyValues: { text: { value: 'Hello bob' }, html: { value: html } },
            ...(process.env.SPIKE_SHAPE === 'structure'
              ? {
                  bodyStructure: {
                    type: 'multipart/related',
                    subParts: [
                      {
                        type: 'multipart/alternative',
                        subParts: [
                          { partId: 'text', type: 'text/plain' },
                          { partId: 'html', type: 'text/html' }
                        ]
                      },
                      {
                        blobId: blob.blobId,
                        type: 'image/png',
                        disposition: 'inline',
                        cid: 'img1@spike',
                        name: 'red.png'
                      }
                    ]
                  }
                }
              : {
                  textBody: [{ partId: 'text', type: 'text/plain' }],
                  htmlBody: [{ partId: 'html', type: 'text/html' }],
                  attachments: [
                    {
                      blobId: blob.blobId,
                      type: 'image/png',
                      disposition: 'inline',
                      cid: 'img1@spike',
                      name: 'red.png'
                    }
                  ]
                })
          }
        }
      },
      'c0'
    ],
    [
      'EmailSubmission/set',
      {
        accountId,
        create: { sub: { emailId: '#draft', identityId: identity?.id } },
        onSuccessUpdateEmail: {
          '#sub': {
            [`mailboxIds/${drafts.id}`]: null,
            [`mailboxIds/${sent.id}`]: true,
            'keywords/$draft': null
          }
        }
      },
      'c1'
    ]
  ])
  console.log(JSON.stringify(responses))
  expect(JSON.stringify(responses)).not.toContain('notCreated')

  const received = await jmapFor(bob).waitForEmail({ subject: 'multipart related' })
  const [got] = await jmapFor(bob).request([
    [
      'Email/get',
      {
        accountId: await jmapFor(bob).accountId(),
        ids: [received.id],
        properties: ['bodyStructure', 'htmlBody', 'textBody', 'attachments'],
        bodyProperties: ['partId', 'type', 'disposition', 'cid', 'subParts', 'blobId']
      },
      'g'
    ]
  ])
  const email = (got?.[1].list as Record<string, unknown>[])[0]
  console.log(JSON.stringify(email, null, 1))
  expect(JSON.stringify(email?.bodyStructure)).toContain('multipart/related')
  expect(JSON.stringify(email?.bodyStructure)).toContain('img1@spike')
})

// Passes only because this draft has no inline part: with images pointing at the parts of the
// previous version, tmail-backend destroys first and the create fails ("Attachment not found").
// The composer saves in two requests (drafts.spec.ts, docs/spikes/composer-tiptap.md).
test('SPIKE-BACKEND draft rewrite: create + destroy in one Email/set', async ({ jmap, user }) => {
  const accountId = await jmap.accountId()
  const drafts = await jmap.findMailboxByRole('drafts')
  const draft = (subject: string): Record<string, unknown> => ({
    mailboxIds: { [drafts.id]: true },
    keywords: { $draft: true, $seen: true },
    from: [{ email: user.email }],
    subject,
    bodyValues: { html: { value: `<div>${subject}</div>` } },
    htmlBody: [{ partId: 'html', type: 'text/html' }]
  })
  const [first] = await jmap.request([
    ['Email/set', { accountId, create: { d1: draft('v1') } }, 'c0']
  ])
  const firstId = (first?.[1].created as Record<string, { id: string }>).d1?.id
  const [second] = await jmap.request([
    ['Email/set', { accountId, create: { d2: draft('v2') }, destroy: [firstId] }, 'c0']
  ])
  expect(second?.[1].destroyed).toEqual([firstId])
  expect(Object.keys(second?.[1].created as object)).toEqual(['d2'])
})
