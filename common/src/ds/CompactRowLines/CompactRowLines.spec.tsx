import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { CompactRowLines } from './CompactRowLines'

describe('CompactRowLines', () => {
  it('puts the sender, the subject and the preview on their lines, in order', () => {
    const { container } = renderDs(
      <CompactRowLines
        marker={<i>•</i>}
        sender="Alice"
        senderEnd={<b>10:00</b>}
        end={<u>›</u>}
        subject="Hello"
        preview="Some text"
        isStrong
        testIds={{ sender: 'sender', subject: 'subject', preview: 'preview' }}
      />
    )

    expect(container).toHaveTextContent('•Alice10:00›HelloSome text')
    expect(screen.getByTestId('sender')).toHaveStyle({ fontWeight: 600 })
    expect(screen.getByTestId('subject')).toHaveTextContent('Hello')
    expect(screen.getByTestId('preview')).toHaveTextContent('Some text')
  })
})
