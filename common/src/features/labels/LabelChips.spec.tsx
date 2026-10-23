import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Label } from 'jmap-client-ts/linagora'
import { useState, type ReactElement } from 'react'

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

function RemovableChips(): ReactElement {
  const [labels, setLabels] = useState(LABELS)
  return (
    <>
      <LabelChips
        labels={labels}
        onRemove={removed => {
          setLabels(current => current.filter(label => label !== removed))
        }}
      />
      <button type="button">More</button>
    </>
  )
}

describe('LabelChips', () => {
  it('shows the first labels then "+N", naming the others for assistive technologies', () => {
    renderWithProviders(<LabelChips labels={LABELS} max={1} size="small" />)

    const list = screen.getByRole('list', { name: 'Labels of the email' })
    expect(within(list).getAllByTestId('label-chip')).toHaveLength(1)
    expect(within(list).getByTestId('label-chip-more')).toHaveTextContent('+2')
    expect(list).toHaveTextContent('2 more labels: Urgent, Personal')
  })

  it('names a single hidden label in the singular', () => {
    renderWithProviders(<LabelChips labels={LABELS} max={2} size="small" />)

    const list = screen.getByRole('list', { name: 'Labels of the email' })
    expect(within(list).getByTestId('label-chip-more')).toHaveTextContent('+1')
    expect(list).toHaveTextContent('1 more label: Personal')
  })

  it('shows every label without a maximum', () => {
    renderWithProviders(<LabelChips labels={LABELS} />)

    expect(screen.getAllByTestId('label-chip')).toHaveLength(3)
    expect(screen.queryByTestId('label-chip-more')).toBe(null)
  })

  it('writes a label in black or white, whichever reads better on its colour', () => {
    renderWithProviders(
      <LabelChips
        labels={[makeLabel('Light', '#EDC661'), makeLabel('Dark', '#273891')]}
      />
    )

    const [light, dark] = screen.getAllByTestId('label-chip')
    expect(light).toHaveStyle({ color: 'rgb(0, 0, 0)' })
    expect(dark).toHaveStyle({ color: 'rgb(255, 255, 255)' })
  })

  it('keeps each label within the width of the list', () => {
    renderWithProviders(<LabelChips labels={LABELS} onRemove={jest.fn()} />)

    for (const item of screen.getAllByRole('listitem')) {
      expect(item).toHaveClass('u-maw-100')
    }
  })

  it('gives the focus to the next chip when a chip is taken off', async () => {
    renderWithProviders(<RemovableChips />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove the label Design' })
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Remove the label Urgent' })
      ).toHaveFocus()
    })
  })

  it('gives the focus to the next control when the last chip is taken off', async () => {
    renderWithProviders(<RemovableChips />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove the label Personal' })
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()
    })
  })

  it('keeps the labels of an email, in the order of the account', () => {
    expect(
      labelsOfEmail(LABELS, { keywords: { personal: true, design: true } }).map(
        label => label.displayName
      )
    ).toEqual(['Design', 'Personal'])
  })
})
