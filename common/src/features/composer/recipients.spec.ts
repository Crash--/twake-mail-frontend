import {
  formatRecipient,
  hasRecipient,
  isValidEmail,
  mergeRecipients,
  parseRecipients,
  uniqueByAddress,
  withTypedAddressFirst
} from './recipients'

describe('withTypedAddressFirst', () => {
  const typed = (email: string): { id: string } => ({ id: email })

  it('lists a complete address missing from the suggestions first', () => {
    expect(
      withTypedAddressFirst(
        [{ id: 'smtp-newcomer@example.com' }],
        ' newcomer@example.com ',
        typed
      )
    ).toEqual([
      { id: 'newcomer@example.com' },
      { id: 'smtp-newcomer@example.com' }
    ])
  })

  it('moves the suggestion of the typed address first, whatever its case', () => {
    const match = { id: 'Newcomer@example.com', label: 'Newcomer' }
    expect(
      withTypedAddressFirst(
        [{ id: 'smtp-newcomer@example.com', label: 'Smtp' }, match],
        'newcomer@EXAMPLE.com',
        email => ({ id: email, label: email })
      )
    ).toEqual([match, { id: 'smtp-newcomer@example.com', label: 'Smtp' }])
  })

  it.each([
    ['an incomplete address', [{ id: 'newcomer@example.com' }], 'newcomer'],
    ['no suggestions', [], 'newcomer@example.com']
  ])('keeps the suggestions as they are with %s', (_, suggestions, text) => {
    expect(withTypedAddressFirst(suggestions, text, typed)).toEqual(suggestions)
  })

  it.each([
    ['an incomplete address', 'alice'],
    ['a complete address', 'alice@example.com']
  ])(
    'lists an address returned twice once, whatever its case, with %s',
    (_, text) => {
      const first = { id: 'alice@example.com', label: 'Alice' }
      expect(
        withTypedAddressFirst(
          [
            first,
            { id: 'Alice@Example.com', label: 'Alice again' },
            { id: 'alice@example.com', label: 'Alice once more' }
          ],
          text,
          email => ({ id: email, label: email })
        )
      ).toEqual([first])
    }
  )
})

describe('uniqueByAddress', () => {
  it('keeps the first item of each address, whatever its case, in order', () => {
    expect(
      uniqueByAddress(
        [
          { emailAddress: 'bob@example.com', name: 'Bob' },
          { emailAddress: 'alice@example.com', name: 'Alice' },
          { emailAddress: 'BOB@example.com', name: 'Bob again' }
        ],
        contact => contact.emailAddress
      )
    ).toEqual([
      { emailAddress: 'bob@example.com', name: 'Bob' },
      { emailAddress: 'alice@example.com', name: 'Alice' }
    ])
  })
})

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
    ['alice@localhost', true],
    ['bob@intranet', true],
    ['alice@-localhost', false],
    ['alice', false],
    ['alice@', false],
    ['@example.com', false],
    ['al ice@example.com', false],
    ['alice@example.', false],
    ['jo-e@my-host.example.com', true],
    ['x..y@example.com', false],
    ['.alice@example.com', false],
    ['alice.@example.com', false],
    ['a@-bad-.com', false],
    ['a@bad-.com', false],
    ['alice@example..com', false]
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
