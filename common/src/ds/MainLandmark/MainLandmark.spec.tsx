import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  InsideMainLandmark,
  MainLandmark,
  useIsInMainLandmark
} from './MainLandmark'

function Probe(): ReactElement {
  return <p>{useIsInMainLandmark() ? 'in main' : 'outside main'}</p>
}

describe('MainLandmark', () => {
  it('is the main landmark, around its content', () => {
    renderDs(
      <MainLandmark className="u-h-100">
        <Probe />
      </MainLandmark>
    )

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('in main')
    expect(main).toHaveClass('u-h-100')
  })

  it('tells its content when the caller renders the landmark', () => {
    renderDs(
      <InsideMainLandmark>
        <Probe />
      </InsideMainLandmark>
    )

    expect(screen.getByText('in main')).toBeInTheDocument()
    expect(screen.queryByRole('main')).toBe(null)
  })

  it('is not around content rendered without it', () => {
    renderDs(<Probe />)

    expect(screen.getByText('outside main')).toBeInTheDocument()
  })
})
