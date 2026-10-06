import { screen, within } from '@testing-library/react'
import type { Label } from 'jmap-client-ts/linagora'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { LabelChips, labelsOfEmail } from './LabelChips'

function makeLabel(name: string, color: string): Label {
  return {
    id: name.toLowerCase(),
    displayName: name,
    keyword: name.toLowerCase(),
    color
  }
}

const LABELS = [
  makeLabel('Design', '#2196F3'),
  makeLabel('Urgent', '#F44336'),
  makeLabel('Personal', '#4CAF50')
]

describe('LabelChips', () => {
  it('shows the first labels then "+N", naming the others for assistive technologies', () => {
    renderWithProviders(<LabelChips labels={LABELS} max={1} size="small" />)

    const list = screen.getByRole('list', { name: 'Labels of the email' })
    expect(within(list).getAllByTestId('label-chip')).toHaveLength(1)
    expect(within(list).getByTestId('label-chip-more')).toHaveTextContent('+2')
    expect(list).toHaveTextContent('2 more labels: Urgent, Personal')
  })

  it('shows every label without a maximum', () => {
    renderWithProviders(<LabelChips labels={LABELS} />)

    expect(screen.getAllByTestId('label-chip')).toHaveLength(3)
    expect(screen.queryByTestId('label-chip-more')).toBe(null)
  })

  it('keeps the labels of an email, in the order of the account', () => {
    expect(
      labelsOfEmail(LABELS, { keywords: { personal: true, design: true } }).map(
        label => label.displayName
      )
    ).toEqual(['Design', 'Personal'])
  })
})
