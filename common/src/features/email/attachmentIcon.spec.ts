import {
  FileTypeCode,
  FileTypeImage,
  FileTypeText
} from '@linagora/twake-icons'

import { File } from '@/ds/FlutterIcons/FlutterIcons'
import { attachmentIcon } from './attachmentIcon'

describe('attachmentIcon', () => {
  it.each([
    ['notes.txt', 'text/plain'],
    ['notes.txt', 'text/plain; charset=utf-8'],
    ['notes.txt', 'TEXT/PLAIN'],
    ['notes.txt', ''],
    ['server.log', '']
  ])('draws %s (%s) as a generic file', (name, type) => {
    expect(attachmentIcon(name, type)).toBe(File)
  })

  it.each([
    [
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      FileTypeText
    ],
    ['report.doc', '', FileTypeText],
    ['pixel.png', 'image/png', FileTypeImage],
    ['page.html', 'text/html', FileTypeCode]
  ])('keeps the twake-icons icon of %s (%s)', (name, type, icon) => {
    expect(attachmentIcon(name, type)).toBe(icon)
  })
})
