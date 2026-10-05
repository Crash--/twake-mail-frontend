import {
  hasDangerWarning,
  isTwpWarningDismissed,
  offersNotSpam,
  parseTwpWarning,
  parseTwpWarnings,
  twpDismissKeyword,
  twpWarningCodeText,
  TWP_TEXT_MAX_LENGTH
} from './twpWarnings'

describe('parseTwpWarning', () => {
  it('parses the level, the code and the text', () => {
    expect(
      parseTwpWarning('level:warn code:virus This email contains a virus', 0)
    ).toEqual({
      level: 'warn',
      code: 'virus',
      text: 'This email contains a virus',
      index: 0
    })
  })

  it('accepts the tokens in any leading order', () => {
    expect(parseTwpWarning('code:virus level:error Boom', 2)).toEqual({
      level: 'error',
      code: 'virus',
      text: 'Boom',
      index: 2
    })
  })

  it('reads a plain message as info without a code', () => {
    expect(parseTwpWarning('A plain warning message', 0)).toMatchObject({
      level: 'info',
      code: null,
      text: 'A plain warning message'
    })
  })

  it('stops reading tokens at the first word of the text', () => {
    expect(parseTwpWarning('Hello level:warn', 0)).toMatchObject({
      level: 'info',
      code: null,
      text: 'Hello level:warn'
    })
  })

  it('falls back to info for an unknown level', () => {
    expect(parseTwpWarning('level:critical code:virus Text', 0)).toMatchObject({
      level: 'info',
      code: 'virus'
    })
  })

  it('reads the tokens whatever their case', () => {
    expect(parseTwpWarning('LEVEL:ERROR Code:Virus Text', 0)).toMatchObject({
      level: 'error',
      code: 'Virus'
    })
  })

  it('treats an empty code as none', () => {
    expect(parseTwpWarning('level:warn code: Text', 0)).toMatchObject({
      code: null,
      text: 'Text'
    })
  })

  it('collapses surrounding and repeated whitespace', () => {
    expect(parseTwpWarning('  level:warn   code:virus   A   B  ', 0)).toEqual({
      level: 'warn',
      code: 'virus',
      text: 'A B',
      index: 0
    })
  })

  it('has an empty text for a header with tokens only', () => {
    expect(parseTwpWarning('level:warn', 0).text).toBe('')
    expect(parseTwpWarning('', 0)).toMatchObject({ level: 'info', text: '' })
  })

  it('drops control characters and caps the length of the text', () => {
    const text = parseTwpWarning(
      `level:warn a\u0007b ${'x'.repeat(900)}`,
      0
    ).text

    expect(text.startsWith('a b ')).toBe(true)
    expect(Array.from(text)).toHaveLength(TWP_TEXT_MAX_LENGTH + 1)
    expect(text.endsWith('…')).toBe(true)
  })

  it('keeps markup as characters', () => {
    expect(parseTwpWarning('<a href="https://x.test">go</a>', 0).text).toBe(
      '<a href="https://x.test">go</a>'
    )
  })
})

describe('parseTwpWarnings', () => {
  it('is empty without header', () => {
    expect(parseTwpWarnings(null)).toEqual([])
    expect(parseTwpWarnings(undefined)).toEqual([])
    expect(parseTwpWarnings([])).toEqual([])
  })

  it('parses a single header', () => {
    expect(
      parseTwpWarnings([
        'level:info code:suspicious-sender This email is from an external sender.'
      ])
    ).toEqual([
      {
        level: 'info',
        code: 'suspicious-sender',
        text: 'This email is from an external sender.',
        index: 0
      }
    ])
  })

  it('gives each header its position, in order', () => {
    const warnings = parseTwpWarnings([
      'level:warn code:virus Virus found',
      'level:error code:virus-removed Virus removed'
    ])

    expect(warnings.map(({ index, level }) => [index, level])).toEqual([
      [0, 'warn'],
      [1, 'error']
    ])
  })

  it('keeps two identical headers apart', () => {
    const warnings = parseTwpWarnings(['level:warn Same', 'level:warn Same'])

    expect(warnings.map(warning => warning.index)).toEqual([0, 1])
  })
})

describe('dismissal', () => {
  it('names the keyword after the position', () => {
    expect(twpDismissKeyword(3)).toBe('twp-warning-dismissed-3')
  })

  it('is read from the keywords of the email', () => {
    const email = { keywords: { 'twp-warning-dismissed-1': true as const } }

    expect(isTwpWarningDismissed(email, { index: 1 })).toBe(true)
    expect(isTwpWarningDismissed(email, { index: 0 })).toBe(false)
  })
})

describe('twpWarningCodeText', () => {
  it('knows the three codes of the backend, whatever their case', () => {
    expect(twpWarningCodeText('suspicious-sender')).toBe(
      'email.twpWarning.codes.suspiciousSender'
    )
    expect(twpWarningCodeText('virus')).toBe('email.twpWarning.codes.virus')
    expect(twpWarningCodeText('Virus-Removed')).toBe(
      'email.twpWarning.codes.virusRemoved'
    )
  })

  it('does not know any other, nor inherited property names', () => {
    expect(twpWarningCodeText('phishing')).toBeNull()
    expect(twpWarningCodeText('constructor')).toBeNull()
    expect(twpWarningCodeText(null)).toBeNull()
  })
})

describe('rules', () => {
  it('offers Not spam for an error in Spam only', () => {
    expect(offersNotSpam({ level: 'error' }, true)).toBe(true)
    expect(offersNotSpam({ level: 'error' }, false)).toBe(false)
    expect(offersNotSpam({ level: 'warn' }, true)).toBe(false)
  })

  it('flags an email as dangerous by an error-level warning', () => {
    const [info, error] = parseTwpWarnings(['level:info A', 'level:error B'])
    if (info === undefined || error === undefined) throw new Error('parsed')

    expect(hasDangerWarning([info])).toBe(false)
    expect(hasDangerWarning([info, error])).toBe(true)
  })
})
