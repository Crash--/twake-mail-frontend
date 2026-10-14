import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { EmailSubject } from './EmailSubject'
import { EmailSubjectBar } from './EmailSubjectBar'

describe('EmailSubjectBar', () => {
  it('puts the labels on the line of the subject', () => {
    renderDs(
      <EmailSubjectBar end={<span>Work</span>} data-testid="bar">
        <EmailSubject>A long subject</EmailSubject>
      </EmailSubjectBar>
    )

    const bar = screen.getByTestId('bar')
    expect(getComputedStyle(bar).flexWrap).not.toBe('wrap')
    const [subjectBox, endBox] = Array.from(bar.children)
    expect(subjectBox).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'A long subject' })
    )
    expect(subjectBox).toHaveStyle({ minWidth: '0' })
    expect(endBox).toHaveTextContent('Work')
  })

  it('has nothing after the subject without labels', () => {
    renderDs(
      <EmailSubjectBar data-testid="bar">
        <EmailSubject>Hello</EmailSubject>
      </EmailSubjectBar>
    )

    expect(screen.getByTestId('bar').children).toHaveLength(1)
  })
})
