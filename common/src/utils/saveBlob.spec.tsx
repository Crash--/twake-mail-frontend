import { saveBlob } from './saveBlob'

describe('saveBlob', () => {
  it('saves a file under its own name, without the type the browser would add an extension for (tf#4674)', () => {
    const saved: Blob[] = []
    jest.spyOn(URL, 'createObjectURL').mockImplementation(object => {
      if (object instanceof Blob) saved.push(object)
      return 'blob:https://mail.example.com/1'
    })
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const clicked: HTMLAnchorElement[] = []
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this)
      })

    saveBlob(new Blob(['make all'], { type: 'text/plain' }), 'Makefile')

    expect(saved.map(blob => [blob.type, blob.size])).toEqual([
      ['application/octet-stream', 8]
    ])
    expect(clicked.map(link => link.download)).toEqual(['Makefile'])
  })
})
