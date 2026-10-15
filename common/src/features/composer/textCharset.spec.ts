import { detectCharset, needsCharset } from './textCharset'

describe('needsCharset', () => {
  it.each([
    ['text/plain', true],
    ['Text/CSV', true],
    ['text/plain; format=flowed', true],
    ['text/plain; charset=UTF-8', false],
    ['text/html;Charset="iso-8859-1"', false],
    ['application/pdf', false],
    ['image/png', false]
  ])('%s: %s', (type, expected) => {
    expect(needsCharset(type)).toBe(expected)
  })
})

describe('detectCharset', () => {
  it('names UTF-8 the bytes that decode as such, ASCII and empty ones included', () => {
    expect(detectCharset(new TextEncoder().encode('Café, 日本'))).toBe('UTF-8')
    expect(detectCharset(new TextEncoder().encode('plain'))).toBe('UTF-8')
    expect(detectCharset(new Uint8Array())).toBe('UTF-8')
  })

  it('reads a UTF-16 byte order mark', () => {
    expect(detectCharset(new Uint8Array([0xff, 0xfe, 0x41, 0x00]))).toBe(
      'UTF-16LE'
    )
    expect(detectCharset(new Uint8Array([0xfe, 0xff, 0x00, 0x41]))).toBe(
      'UTF-16BE'
    )
  })

  it('falls back to ISO-8859-1, or Windows-1252 when its extra characters are there', () => {
    // "Café" in Latin-1
    expect(detectCharset(new Uint8Array([0x43, 0x61, 0x66, 0xe9]))).toBe(
      'ISO-8859-1'
    )
    // "€5" in Windows-1252
    expect(detectCharset(new Uint8Array([0x80, 0x35]))).toBe('windows-1252')
  })
})
