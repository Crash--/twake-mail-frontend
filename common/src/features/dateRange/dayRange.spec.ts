import { dayRangeProblems } from './dayRange'

describe('dayRangeProblems', () => {
  it('refuses a custom range missing a date, inverted or before its first day', () => {
    const firstDay = '2026-09-23'
    expect(
      dayRangeProblems({ start: '2026-09-25', end: '2026-10-01' }, firstDay)
    ).toEqual({ start: null, end: null })
    expect(dayRangeProblems({ start: '', end: '' }, firstDay)).toEqual({
      start: 'startMissing',
      end: 'endMissing'
    })
    expect(
      dayRangeProblems({ start: '2026-10-02', end: '2026-10-01' }, firstDay)
    ).toEqual({ start: null, end: 'reversed' })
    expect(
      dayRangeProblems({ start: '2026-09-22', end: '2026-10-01' }, firstDay)
    ).toEqual({ start: 'beforeHorizon', end: null })
    expect(
      dayRangeProblems({ start: '2020-01-01', end: '2020-01-01' }, null)
    ).toEqual({ start: null, end: null })
    expect(
      dayRangeProblems({ start: '2026-1-5', end: '2026-10-01' }, null)
    ).toEqual({ start: 'startMissing', end: null })
  })
})
