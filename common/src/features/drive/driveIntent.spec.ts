import { pickerData, readPickedFiles, readPickerHref } from './driveIntent'

function intentWith(href: string | null): unknown {
  return {
    id: 'intent-1',
    type: 'io.cozy.intents',
    attributes: {
      action: 'PICK',
      type: 'io.cozy.files',
      services: href === null ? [] : [{ slug: 'drive', href }]
    }
  }
}

describe('Drive intent', () => {
  it('reads the page of the picker in the intent the stack created, in https', () => {
    expect(
      readPickerHref(
        intentWith(
          'https://user1-drive.twake.example.com/#/intents?intent=intent-1'
        )
      )
    ).toBe('https://user1-drive.twake.example.com/#/intents?intent=intent-1')
    expect(readPickerHref(intentWith('http://drive.example.com/'))).toBe(null)
    expect(readPickerHref(intentWith(null))).toBe(null)
    expect(readPickerHref(null)).toBe(null)
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
      theme: { type: 'light' }
    })
  })

  it('keeps the picked files with valid links only', () => {
    expect(
      readPickedFiles([
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
      ])
    ).toEqual([
      {
        id: 'f1',
        name: 'report.pdf',
        size: 1200,
        mimeType: 'application/pdf',
        sharingLink: 'https://user1-drive.twake.example.com/public?sharecode=x',
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
    ])
  })
})
