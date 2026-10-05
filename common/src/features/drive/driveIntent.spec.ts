import { pickerData, readIntent, readIntentMessage } from './driveIntent'

const INTENT = {
  id: 'intent-1',
  origin: 'https://user1-drive.twake.example.com'
}

function message(
  type: string,
  extra: Record<string, unknown> = {}
): {
  origin: string
  data: unknown
} {
  return { origin: INTENT.origin, data: { type, ...extra } }
}

describe('Drive intent', () => {
  it('reads the intent the stack created, its page in https', () => {
    expect(
      readIntent({
        data: {
          id: 'intent-1',
          attributes: {
            services: [
              {
                href: 'https://user1-drive.twake.example.com/#/intents?intent=intent-1'
              }
            ]
          }
        }
      })
    ).toEqual({
      id: 'intent-1',
      href: 'https://user1-drive.twake.example.com/#/intents?intent=intent-1',
      origin: 'https://user1-drive.twake.example.com'
    })
    expect(
      readIntent({
        data: {
          id: 'i',
          attributes: { services: [{ href: 'http://drive.example.com/' }] }
        }
      })
    ).toBe(null)
    expect(readIntent({ errors: [] })).toBe(null)
  })

  it('asks for several files, a link or an attachment', () => {
    expect(
      pickerData({
        linkLabel: 'Add as link',
        attachLabel: 'Add as attachment',
        maxFileSize: 1000,
        theme: 'light'
      })
    ).toEqual({
      multiple: true,
      sharingLink: { label: 'Add as link' },
      downloadLink: {
        label: 'Add as attachment',
        maxFileSize: 1000,
        availableSize: 1000
      },
      displayCloseButton: true,
      theme: { type: 'light' }
    })
  })

  it('only hears the picker of this intent, from its origin', () => {
    expect(readIntentMessage(message('intent-intent-1:ready'), INTENT)).toEqual(
      {
        type: 'ready'
      }
    )
    expect(
      readIntentMessage(
        {
          origin: 'https://evil.example.com',
          data: { type: 'intent-intent-1:ready' }
        },
        INTENT
      )
    ).toBe(null)
    expect(readIntentMessage(message('intent-other:ready'), INTENT)).toBe(null)
    expect(readIntentMessage(message('intent-intent-1:resize'), INTENT)).toBe(
      null
    )
    expect(
      readIntentMessage(
        { origin: INTENT.origin, data: 'intent-intent-1:done' },
        INTENT
      )
    ).toBe(null)
  })

  it('keeps the picked files with valid links only', () => {
    expect(
      readIntentMessage(
        message('intent-intent-1:done', {
          document: [
            {
              id: 'f1',
              name: 'report.pdf',
              size: 1200,
              mimeType: 'application/pdf',
              sharingLink:
                'https://user1-drive.twake.example.com/public?sharecode=x',
              thumbnail: { link: 'https://user1.twake.example.com/thumb.png' }
            },
            {
              _id: 'f2',
              filename: 'notes.txt',
              size: '42',
              downloadLink:
                'https://user1.twake.example.com/files/downloads/abc/notes.txt'
            },
            { id: 'f3', name: 'evil', sharingLink: 'javascript:alert(1)' },
            {
              id: 'f4',
              name: 'negative',
              size: -1,
              sharingLink: 'https://x.example.com/'
            },
            { id: 'f5', name: 'local', downloadLink: 'http://localhost:8080/f' }
          ]
        }),
        INTENT
      )
    ).toEqual({
      type: 'done',
      files: [
        {
          id: 'f1',
          name: 'report.pdf',
          size: 1200,
          mimeType: 'application/pdf',
          sharingLink:
            'https://user1-drive.twake.example.com/public?sharecode=x',
          downloadLink: null,
          thumbnail: 'https://user1.twake.example.com/thumb.png'
        },
        {
          id: 'f2',
          name: 'notes.txt',
          size: 42,
          mimeType: null,
          sharingLink: null,
          downloadLink:
            'https://user1.twake.example.com/files/downloads/abc/notes.txt',
          thumbnail: null
        },
        {
          id: 'f5',
          name: 'local',
          size: null,
          mimeType: null,
          sharingLink: null,
          downloadLink: 'http://localhost:8080/f',
          thumbnail: null
        }
      ]
    })
  })
})
