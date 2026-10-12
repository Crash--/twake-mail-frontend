import { fileFromDataUrl } from './pastedDataImages'

describe('fileFromDataUrl', () => {
  it('reads the bytes and the type of a base64 data URL', () => {
    const file = fileFromDataUrl('data:image/png;base64,iVBORw==', 'image-1')

    expect(file?.name).toBe('image-1.png')
    expect(file?.type).toBe('image/png')
    expect(file?.size).toBe(4)
  })

  it('names an SVG after its subtype', () => {
    const file = fileFromDataUrl('data:image/svg+xml,%3Csvg%2F%3E', 'image-2')

    expect(file?.name).toBe('image-2.svg')
    expect(file?.size).toBe(6)
  })

  it('reads nothing from another URL or broken base64', () => {
    expect(fileFromDataUrl('https://example.com/logo.png', 'image')).toBe(null)
    expect(fileFromDataUrl('data:image/png;base64,%%%', 'image')).toBe(null)
  })
})
