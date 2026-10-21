import { hasDateFormats, loadDateFormats } from './dateFormats'

const OCTOBER_21 = new Date('2026-10-21T13:30:00Z')

describe('loadDateFormats', () => {
  it('writes the dates of a language the browser lacks', async () => {
    // As Chromium, which ships no Mongolian data
    jest
      .spyOn(Intl.DateTimeFormat, 'supportedLocalesOf')
      .mockImplementation(locales =>
        [locales ?? []]
          .flat()
          .map(locale => locale.toString())
          .filter(locale => locale !== 'mn')
      )
    expect(hasDateFormats('mn')).toBe(false)

    await loadDateFormats('mn')

    expect(hasDateFormats('mn')).toBe(true)
    expect(
      new Intl.DateTimeFormat('mn', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(OCTOBER_21)
    ).toBe('2026\u202Fоны аравдугаар сар')
    expect(
      new Intl.DateTimeFormat('mn', {
        hour: 'numeric',
        minute: 'numeric',
        timeZone: 'UTC'
      }).format(OCTOBER_21)
    ).toBe('13:30')
  })

  it('keeps the time zone of the browser', () => {
    expect(new Intl.DateTimeFormat('mn').resolvedOptions().timeZone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    )
  })

  it('loads the data of another language once the polyfill is in', async () => {
    expect(hasDateFormats('fr')).toBe(false)

    await loadDateFormats('fr')

    expect(
      new Intl.DateTimeFormat('fr', {
        month: 'long',
        timeZone: 'UTC'
      }).format(OCTOBER_21)
    ).toBe('octobre')
  })
})
