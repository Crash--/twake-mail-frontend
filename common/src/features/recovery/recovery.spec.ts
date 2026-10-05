import { deletionRanges, horizonDays, recoveryCriteria } from './recovery'

describe('recovery', () => {
  it('reads the restoration horizon of the vault', () => {
    expect(horizonDays('15 days')).toBe(15)
    expect(horizonDays('1 day 12 hours')).toBe(2)
    expect(horizonDays(null)).toBe(15)
  })

  it('offers the deletion periods within the horizon', () => {
    expect(deletionRanges(15)).toEqual(['last7Days', 'last15Days'])
    expect(deletionRanges(400)).toEqual([
      'last7Days',
      'last15Days',
      'last30Days',
      'last6Months',
      'last1Year'
    ])
  })

  it('sends only the criteria given', () => {
    expect(
      recoveryCriteria(
        {
          deletion: 'last7Days',
          reception: 'allTime',
          subject: ' Invoice ',
          sender: null,
          recipients: ['bob@example.com'],
          hasAttachment: false
        },
        new Date('2026-10-08T00:00:00Z')
      )
    ).toEqual({
      deletedAfter: '2026-10-01T00:00:00Z',
      subject: 'Invoice',
      recipients: ['bob@example.com']
    })
  })
})
