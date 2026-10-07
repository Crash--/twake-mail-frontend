import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { useFocusFallback } from './useFocusFallback'

function Banner({ onClose }: { onClose: () => void }): ReactElement {
  const ref = useFocusFallback<HTMLDivElement>()
  return (
    <div ref={ref}>
      <button type="button" onClick={onClose}>
        Dismiss
      </button>
    </div>
  )
}

function Screen({ hasAfter = true }: { hasAfter?: boolean }): ReactElement {
  const [isShown, setIsShown] = useState(true)
  return (
    <>
      <button type="button">Before</button>
      {isShown ? (
        <Banner
          onClose={() => {
            setIsShown(false)
          }}
        />
      ) : null}
      <button type="button" disabled>
        Disabled
      </button>
      {hasAfter ? <button type="button">After</button> : null}
    </>
  )
}

function HiddenFromOutside(): ReactElement {
  const [isShown, setIsShown] = useState(true)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsShown(false)
        }}
      >
        Hide
      </button>
      {isShown ? <Banner onClose={() => undefined} /> : null}
      <button type="button">After</button>
    </>
  )
}

describe('useFocusFallback', () => {
  it('gives the focus to the next control when the element holding it goes', async () => {
    renderDs(<Screen />)

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
    })
  })

  it('gives it to the previous control when none follows', async () => {
    renderDs(<Screen hasAfter={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus()
    })
  })

  it('leaves the focus alone when the element did not hold it', async () => {
    renderDs(<HiddenFromOutside />)

    const hide = screen.getByRole('button', { name: 'Hide' })
    await userEvent.click(hide)

    await new Promise(resolve => setTimeout(resolve, 10))
    expect(hide).toHaveFocus()
  })
})
