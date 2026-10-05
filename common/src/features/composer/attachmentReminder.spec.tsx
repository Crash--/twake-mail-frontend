import { findAttachmentKeywords, writtenText } from './attachmentReminder'

describe('findAttachmentKeywords', () => {
  it('finds whole words of every language, once, whatever their case', () => {
    expect(
      findAttachmentKeywords(
        'See the FILE? And the file-2, the Pièce jointe, the файл and the tệp'
      )
    ).toEqual(['file', 'pièce jointe', 'файл', 'tệp'])
  })

  it('prefers the longest keyword, and skips words that only contain one', () => {
    expect(findAttachmentKeywords('attachments attached')).toEqual([
      'attachments',
      'attached'
    ])
    expect(findAttachmentKeywords('filetage profiles joints')).toEqual([])
  })
})

describe('writtenText', () => {
  it('reads the subject and the text, not the quote nor the signature', () => {
    const text = writtenText(
      'Report',
      [
        '<p>Here it is</p>',
        '<div data-html-block="signature"><p>My file signature</p></div>',
        '<div data-html-block="quote"><blockquote>the file</blockquote></div>',
        '<blockquote><p>an old file</p></blockquote>'
      ].join('')
    )

    expect(text).toBe('Report Here it is')
    expect(findAttachmentKeywords(text)).toEqual([])
  })
})
