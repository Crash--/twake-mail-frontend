import { imageBlobType, previewKind } from './attachmentPreview'

describe('previewKind', () => {
  it.each([
    ['application/pdf', 'a.bin', 'pdf'],
    ['application/octet-stream', 'scan.PDF', 'pdf'],
    ['message/rfc822', 'forwarded.eml', 'eml'],
    ['text/html', 'page.html', 'html'],
    ['application/octet-stream', 'page.html', 'html'],
    ['image/png', 'photo.png', 'image'],
    ['application/octet-stream', 'logo.svg', 'image'],
    ['image/x-unknown', 'noext', 'image'],
    ['text/plain', 'notes.txt', 'text'],
    ['application/json', 'data', 'text'],
    ['application/octet-stream', 'data.json', 'text'],
    ['text/csv', 'table.csv', null],
    ['application/zip', 'a.zip', null],
    ['application/octet-stream', 'program.exe', null],
    ['application/octet-stream', null, null]
  ] as const)('%s %s is %s', (type, name, expected) => {
    expect(previewKind({ type, name })).toBe(expected)
  })
})

describe('imageBlobType', () => {
  it('keeps a known image type and never an active document type', () => {
    expect(imageBlobType({ type: 'image/png', name: 'a.png' })).toBe(
      'image/png'
    )
    expect(imageBlobType({ type: 'text/html', name: 'a.svg' })).toBe(
      'image/svg+xml'
    )
    expect(imageBlobType({ type: 'text/html', name: 'a.heic' })).toBe(
      'application/octet-stream'
    )
  })
})
