import {
  formatRecipient,
  hasRecipient,
  isValidEmail,
  mergeRecipients,
  parseRecipients
} from './recipients'

describe('parseRecipients', () => {
  it.each([
    ['alice@example.com', [{ name: null, email: 'alice@example.com' }]],
    [
      'alice@example.com, bob@example.com;carol@example.com',
      [
        { name: null, email: 'alice@example.com' },
        { name: null, email: 'bob@example.com' },
        { name: null, email: 'carol@example.com' }
      ]
    ],
    [
      'alice@example.com\nbob@example.com\tcarol@example.com',
      [
        { name: null, email: 'alice@example.com' },
        { name: null, email: 'bob@example.com' },
        { name: null, email: 'carol@example.com' }
      ]
    ],
    [
      'Alice Martin <alice@example.com>, "Doe, John" <john@example.com>',
      [
        { name: 'Alice Martin', email: 'alice@example.com' },
        { name: 'Doe, John', email: 'john@example.com' }
      ]
    ],
    [
      "'Bob' <bob@example.com> carol@example.com Carol B <carol.b@example.com>",
      [
        { name: 'Bob', email: 'bob@example.com' },
        { name: null, email: 'carol@example.com' },
        { name: 'Carol B', email: 'carol.b@example.com' }
      ]
    ],
    ['<dave@example.com>', [{ name: null, email: 'dave@example.com' }]],
    ['mailto:erin@example.com', [{ name: null, email: 'erin@example.com' }]],
    ['  ,; \n', []],
    ['not-an-address', [{ name: null, email: 'not-an-address' }]]
  ])('reads %j', (text, expected) => {
    expect(parseRecipients(text)).toEqual(expected)
  })
})

describe('isValidEmail', () => {
  it.each([
    ['alice@example.com', true],
    ['alice.martin+news@mail.example.co.uk', true],
    ['alice@localhost', false],
    ['alice', false],
    ['alice@', false],
    ['@example.com', false],
    ['al ice@example.com', false],
    ['alice@example.', false]
  ])('%s is valid: %s', (email, valid) => {
    expect(isValidEmail(email)).toBe(valid)
  })
})

describe('mergeRecipients', () => {
  it('adds the new addresses only, whatever their case', () => {
    const current = [{ name: null, email: 'alice@example.com' }]

    expect(
      mergeRecipients(current, [
        { name: 'Alice', email: 'ALICE@example.com' },
        { name: null, email: 'bob@example.com' },
        { name: null, email: 'bob@example.com' }
      ])
    ).toEqual([
      { name: null, email: 'alice@example.com' },
      { name: null, email: 'bob@example.com' }
    ])
  })
})

describe('formatRecipient', () => {
  it('writes the name before the address', () => {
    expect(formatRecipient({ name: 'Alice', email: 'alice@example.com' })).toBe(
      'Alice <alice@example.com>'
    )
    expect(formatRecipient({ name: null, email: 'bob@example.com' })).toBe(
      'bob@example.com'
    )
  })
})

describe('hasRecipient', () => {
  it('compares addresses without case', () => {
    expect(
      hasRecipient(
        [{ name: null, email: 'alice@example.com' }],
        'Alice@Example.com'
      )
    ).toBe(true)
  })
})
