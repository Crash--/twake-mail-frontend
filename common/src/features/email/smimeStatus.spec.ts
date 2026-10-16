import { parseSmimeStatus } from './smimeStatus'

describe('parseSmimeStatus', () => {
  it('reads a good and a bad signature', () => {
    expect(parseSmimeStatus('Good signature')).toBe('good')
    expect(parseSmimeStatus('Bad signature')).toBe('bad')
  })

  it('ignores the case and the surrounding spaces', () => {
    expect(parseSmimeStatus('  good SIGNATURE ')).toBe('good')
    expect(parseSmimeStatus('BAD signature')).toBe('bad')
  })

  it('takes no header, "Not signed" and any other value as not signed', () => {
    expect(parseSmimeStatus(null)).toBe('not-signed')
    expect(parseSmimeStatus(undefined)).toBe('not-signed')
    expect(parseSmimeStatus('Not signed')).toBe('not-signed')
    expect(parseSmimeStatus('Good')).toBe('not-signed')
  })
})
