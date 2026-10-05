import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

/**
 * What tmail-backend does with the requests of the composer, checked
 * without the app: the composer relies on it (features/composer/
 * composeEmail.ts), and tmail-backend#2685 / #2686 track the gaps.
 */

// 1x1 red PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
)

type Responses = Awaited<ReturnType<JmapClient['request']>>

function result(responses: Responses, index: number): Record<string, unknown> {
  return (responses[index]?.[1] ?? {}) as Record<string, unknown>
}

async function draftWithImage(
  jmap: JmapClient,
  email: string,
  shape: 'parts' | 'structure'
): Promise<Record<string, unknown>> {
  const drafts = await jmap.findMailboxByRole('drafts')
  const blob = await jmap.upload(PNG, 'image/png')
  const image = {
    blobId: blob.blobId,
    type: 'image/png',
    disposition: 'inline',
    cid: 'img1@e2e',
    name: 'red.png'
  }
  return {
    mailboxIds: { [drafts.id]: true },
    keywords: { $draft: true, $seen: true },
    from: [{ email }],
    to: [{ email }],
    subject: `inline image ${shape}`,
    bodyValues: {
      text: { value: 'Hello' },
      html: { value: '<div>Hello <img src="cid:img1@e2e" alt="red"></div>' }
    },
    ...(shape === 'structure'
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
              image
            ]
          }
        }
      : {
          textBody: [{ partId: 'text', type: 'text/plain' }],
          htmlBody: [{ partId: 'html', type: 'text/html' }],
          attachments: [image]
        })
  }
}

async function structureOf(jmap: JmapClient, id: string): Promise<string> {
  const accountId = await jmap.accountId()
  const [got] = await jmap.request([
    [
      'Email/get',
      {
        accountId,
        ids: [id],
        properties: ['bodyStructure'],
        bodyProperties: ['type', 'disposition', 'cid', 'subParts']
      },
      'g'
    ]
  ])
  return JSON.stringify((got?.[1].list as Record<string, unknown>[])[0])
}

test.describe('INFRA tmail-backend and the composer', () => {
  test('INFRA-13 htmlBody, textBody and inline attachments make multipart/related; bodyStructure is ignored on creation (#2685)', async ({
    jmap,
    user
  }) => {
    const accountId = await jmap.accountId()
    const responses = await jmap.request([
      [
        'Email/set',
        {
          accountId,
          create: {
            parts: await draftWithImage(jmap, user.email, 'parts'),
            structure: await draftWithImage(jmap, user.email, 'structure')
          }
        },
        'c0'
      ]
    ])
    const created = result(responses, 0).created as Record<
      string,
      { id: string }
    >
    expect(Object.keys(created).sort()).toEqual(['parts', 'structure'])

    const parts = await structureOf(jmap, created.parts?.id ?? '')
    expect(parts).toContain('multipart/related')
    expect(parts).toContain('multipart/alternative')
    expect(parts).toContain('img1@e2e')
    // When this fails, tmail-backend#2685 is fixed
    expect(await structureOf(jmap, created.structure?.id ?? '')).not.toContain(
      'multipart/related'
    )
  })

  test('INFRA-14 one Email/set creates before it destroys, the new version keeping the parts of the old one; Email/get reads #creationId', async ({
    jmap,
    user
  }) => {
    const accountId = await jmap.accountId()
    const first = await jmap.request([
      [
        'Email/set',
        {
          accountId,
          create: { v1: await draftWithImage(jmap, user.email, 'parts') }
        },
        'c0'
      ],
      [
        'Email/get',
        {
          accountId,
          ids: ['#v1'],
          // A body property before attachments (tmail-backend#2686)
          properties: ['htmlBody', 'attachments'],
          bodyProperties: ['blobId', 'cid']
        },
        'c1'
      ]
    ])
    const v1Id =
      (result(first, 0).created as Record<string, { id: string }>).v1?.id ?? ''
    const v1Parts = (
      result(first, 1).list as { attachments: { blobId: string }[] }[]
    )[0]?.attachments
    const imageBlob = v1Parts?.[0]?.blobId ?? ''
    expect(imageBlob).toContain(`${v1Id}_`)

    const v2 = await draftWithImage(jmap, user.email, 'parts')
    const v2Attachments = (v2.attachments as Record<string, unknown>[]).map(
      part => ({
        ...part,
        blobId: imageBlob
      })
    )
    const responses = await jmap.request([
      [
        'Email/set',
        {
          accountId,
          create: { v2: { ...v2, attachments: v2Attachments } },
          destroy: [v1Id]
        },
        'c0'
      ],
      [
        'Email/get',
        {
          accountId,
          ids: ['#v2'],
          properties: ['htmlBody', 'attachments'],
          bodyProperties: ['blobId', 'cid']
        },
        'c1'
      ]
    ])
    expect(result(responses, 0).destroyed).toEqual([v1Id])
    const v2Id =
      (result(responses, 0).created as Record<string, { id: string }>).v2?.id ??
      ''
    const v2Parts = (
      result(responses, 1).list as { attachments: { blobId: string }[] }[]
    )[0]?.attachments
    expect(v2Parts?.[0]?.blobId).toContain(`${v2Id}_`)
  })

  test('INFRA-15 Email/get answers serverFail when attachments come before any body property (#2686)', async ({
    jmap,
    user
  }) => {
    const accountId = await jmap.accountId()
    const [created] = await jmap.request([
      [
        'Email/set',
        {
          accountId,
          create: { d: await draftWithImage(jmap, user.email, 'parts') }
        },
        'c0'
      ]
    ])
    const id =
      (created?.[1].created as Record<string, { id: string }>).d?.id ?? ''
    // When this fails, tmail-backend#2686 is fixed
    await expect(
      jmap.request([
        [
          'Email/get',
          { accountId, ids: [id], properties: ['attachments', 'bodyValues'] },
          'bad'
        ]
      ])
    ).rejects.toThrow(/serverFail/)
    const [good] = await jmap.request([
      [
        'Email/get',
        {
          accountId,
          ids: [id],
          properties: ['htmlBody', 'attachments', 'bodyValues']
        },
        'good'
      ]
    ])
    expect(good?.[0]).toBe('Email/get')
  })

  test.describe('over quota', () => {
    test.use({ userQuota: { size: 4000 } })

    test('INFRA-16 a refused creation does not stop the destroy of the same Email/set', async ({
      jmap
    }) => {
      const accountId = await jmap.accountId()
      const drafts = await jmap.findMailboxByRole('drafts')
      const draft = (text: string): Record<string, unknown> => ({
        mailboxIds: { [drafts.id]: true },
        keywords: { $draft: true, $seen: true },
        subject: 'quota',
        bodyValues: { text: { value: text } },
        textBody: [{ partId: 'text', type: 'text/plain' }]
      })
      const [first] = await jmap.request([
        ['Email/set', { accountId, create: { small: draft('small') } }, 'c0']
      ])
      const smallId =
        (first?.[1].created as Record<string, { id: string }>).small?.id ?? ''

      const responses = await jmap.request([
        [
          'Email/set',
          {
            accountId,
            create: { big: draft('x'.repeat(8000)) },
            destroy: [smallId]
          },
          'c0'
        ]
      ])
      const notCreated = result(responses, 0).notCreated as Record<
        string,
        { type: string }
      >
      expect(notCreated.big?.type).toBe('overQuota')
      // The composer sends in two requests for this reason (composeEmail.ts)
      expect(result(responses, 0).destroyed).toEqual([smallId])
    })
  })
})
