import { isAddressFile, parseAddressFile } from './addressFile'

describe('parseAddressFile', () => {
  it('reads one address per line, skipping comments and blank lines', () => {
    const file = [
      '# The team',
      'alice@example.com',
      '',
      '   ',
      '  Bob Dupont <bob@example.com>  ',
      '\t# away',
      'carol@example.com\r',
      'dan@example.com'
    ].join('\n')

    expect(parseAddressFile(file)).toEqual({
      recipients: [
        { name: null, email: 'alice@example.com' },
        { name: 'Bob Dupont', email: 'bob@example.com' },
        { name: null, email: 'carol@example.com' },
        { name: null, email: 'dan@example.com' }
      ],
      invalidLines: []
    })
  })

  it('reports the lines that are not one valid address, by number', () => {
    const file = [
      'alice@example.com',
      'not an address',
      '# a comment',
      'bob@example.com, carol@example.com',
      'dan@',
      'erin@example.com'
    ].join('\r\n')

    expect(parseAddressFile(file)).toEqual({
      recipients: [
        { name: null, email: 'alice@example.com' },
        { name: null, email: 'erin@example.com' }
      ],
      invalidLines: [2, 4, 5]
    })
  })

  it('reads nothing from an empty file', () => {
    expect(parseAddressFile('')).toEqual({ recipients: [], invalidLines: [] })
  })
})

describe('isAddressFile', () => {
  it('takes plain text files and .txt files', () => {
    expect(isAddressFile({ name: 'team', type: 'text/plain' })).toBe(true)
    expect(isAddressFile({ name: 'TEAM.TXT', type: '' })).toBe(true)
    expect(isAddressFile({ name: 'team.csv', type: 'text/csv' })).toBe(false)
    expect(isAddressFile({ name: 'photo.png', type: 'image/png' })).toBe(false)
  })
})
