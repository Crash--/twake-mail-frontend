import { fromLocalInputs, toLocalInputs, vacationState } from './vacation'

const NOW = new Date('2026-10-05T10:00:00Z')

describe('vacation', () => {
  it('tells where a response stands, as tmail-flutter', () => {
    const on = {
      isEnabled: true,
      fromDate: '2026-10-01T00:00:00Z',
      toDate: null
    }
    expect(vacationState({ ...on, isEnabled: false }, NOW)).toBe('off')
    expect(vacationState(on, NOW)).toBe('active')
    expect(
      vacationState({ ...on, fromDate: '2026-10-06T00:00:00Z' }, NOW)
    ).toBe('scheduled')
    expect(vacationState({ ...on, toDate: '2026-10-04T00:00:00Z' }, NOW)).toBe(
      'ended'
    )
  })

  it('turns the date and time inputs into UTC and back', () => {
    // Tests run in UTC (jest.config.ts)
    expect(fromLocalInputs('2026-10-05', '08:30')).toBe('2026-10-05T08:30:00Z')
    expect(fromLocalInputs('2026-10-05', '')).toBe('2026-10-05T00:00:00Z')
    expect(fromLocalInputs('', '08:30')).toBe(null)
    expect(toLocalInputs('2026-10-05T08:30:00Z')).toEqual({
      date: '2026-10-05',
      time: '08:30'
    })
    expect(toLocalInputs(null)).toEqual({ date: '', time: '' })
  })
})
