import { renderDs } from '@/ds/testing/renderDs'

import { ForwardIcon, ReplyAllIcon, ReplyForwardIcon } from './ReplyIcons'

describe('ReplyIcons', () => {
  it('draws two arrows for "Reply all" and a turned one for "Forward", hidden from assistive technologies', () => {
    const { container } = renderDs(
      <>
        <ReplyAllIcon />
        <ForwardIcon />
      </>
    )

    const [replyAll, forward] = Array.from(container.children)
    expect(replyAll?.querySelectorAll('svg')).toHaveLength(2)
    expect(forward?.querySelectorAll('svg')).toHaveLength(1)
    expect(replyAll).toHaveAttribute('aria-hidden', 'true')
    expect(forward).toHaveStyle({ transform: 'scaleX(-1)' })
  })

  it('draws the reply arrow and the turned one side by side for "replied and forwarded"', () => {
    const { container } = renderDs(<ReplyForwardIcon size={16} />)

    const icon = container.firstElementChild
    expect(icon?.querySelectorAll('svg')).toHaveLength(2)
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})
