import { elapsedMs, STRESS_TIME_LIMIT_MS } from '@common/testing/redos'

import {
  dayRangeProblems,
  deletionRanges,
  firstDeletionDay,
  horizonDays,
  periodBounds,
  presetStart,
  recoveryCriteria
} from './recovery'

// Tests run in UTC (jest.config.ts)
const NOW = new Date('2026-10-08T10:30:00Z')

describe('recovery', () => {
  it('reads the restoration horizon of the vault', () => {
    expect(horizonDays('15 days')).toBe(15)
    expect(horizonDays('1 day 12 hours')).toBe(2)
    expect(horizonDays(null)).toBe(15)
  })

  it('offers the deletion periods within the horizon, then the custom range', () => {
    expect(deletionRanges(15, NOW)).toEqual([
      'last7Days',
      'last15Days',
      'customRange'
    ])
    expect(deletionRanges(400, NOW)).toEqual([
      'last7Days',
      'last15Days',
      'last30Days',
      'last6Months',
      'last1Year',
      'customRange'
    ])
    // 6 calendar months back from October 8 are 183 days
    expect(deletionRanges(183, NOW)).toContain('last6Months')
    expect(deletionRanges(182, NOW)).not.toContain('last6Months')
  })

  it('counts the months in calendar months, as tmail-flutter', () => {
    expect(presetStart('last6Months', NOW)?.toISOString()).toBe(
      '2026-04-08T10:30:00.000Z'
    )
    expect(
      presetStart('last6Months', new Date('2026-08-31T00:00:00Z'))
    ).toEqual(new Date('2026-02-28T00:00:00Z'))
    expect(presetStart('last1Year', NOW)?.toISOString()).toBe(
      '2025-10-08T10:30:00.000Z'
    )
    expect(presetStart('allTime', NOW)).toBe(null)
  })

  it('refuses a custom range missing a date, inverted or past the horizon', () => {
    const firstDay = firstDeletionDay(15, NOW)
    expect(firstDay).toBe('2026-09-23')
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

  it('turns a custom range into UTC bounds, its last day included', () => {
    expect(
      periodBounds(
        { range: 'customRange', start: '2026-09-25', end: '2026-10-01' },
        NOW
      )
    ).toEqual({ after: '2026-09-25T00:00:00Z', before: '2026-10-02T00:00:00Z' })
    // A start before the horizon moves to it
    expect(
      periodBounds(
        { range: 'customRange', start: '2026-09-23', end: '2026-09-30' },
        NOW,
        new Date('2026-09-23T10:30:00Z')
      )
    ).toEqual({ after: '2026-09-23T10:30:00Z', before: '2026-10-01T00:00:00Z' })
    expect(periodBounds({ range: 'last7Days' }, NOW)).toEqual({
      after: '2026-10-01T10:30:00Z',
      before: null
    })
  })

  it('sends only the criteria given', () => {
    expect(
      recoveryCriteria(
        {
          deletion: { range: 'last7Days' },
          reception: { range: 'allTime' },
          subject: ' Invoice ',
          sender: null,
          recipients: ['bob@example.com'],
          hasAttachment: false
        },
        new Date('2026-10-08T00:00:00Z'),
        15
      )
    ).toEqual({
      deletedAfter: '2026-10-01T00:00:00Z',
      subject: 'Invoice',
      recipients: ['bob@example.com']
    })
  })

  it('sends both bounds of custom ranges', () => {
    expect(
      recoveryCriteria(
        {
          deletion: {
            range: 'customRange',
            start: '2026-09-30',
            end: '2026-10-02'
          },
          reception: {
            range: 'customRange',
            start: '2026-01-01',
            end: '2026-01-31'
          },
          subject: '',
          sender: 'alice@example.com',
          recipients: [],
          hasAttachment: true
        },
        NOW,
        15
      )
    ).toEqual({
      deletedAfter: '2026-09-30T00:00:00Z',
      deletedBefore: '2026-10-03T00:00:00Z',
      receivedAfter: '2026-01-01T00:00:00Z',
      receivedBefore: '2026-02-01T00:00:00Z',
      sender: 'alice@example.com',
      hasAttachment: true
    })
  })
})

describe('horizonDays against ReDoS', () => {
  it('reads a horizon as before', () => {
    expect(horizonDays('12 days 3 hours')).toBe(13)
    expect(horizonDays('x15day')).toBe(15)
    expect(horizonDays('1 2day')).toBe(2)
  })

  it('reads a horizon of digits in a linear time', () => {
    expect(elapsedMs(() => horizonDays('0'.repeat(50_000)))).toBeLessThan(
      STRESS_TIME_LIMIT_MS
    )
  })
})
