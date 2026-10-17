import { act, screen } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import {
  LOADING_GRACE_MS,
  LoadingAnnouncer,
  useLoadingAnnouncement
} from './LoadingAnnouncer'

function View({ isLoading }: { isLoading: boolean }): ReactElement {
  useLoadingAnnouncement(isLoading)
  return <p>view</p>
}

function Views(): ReactElement {
  const [isDone, setIsDone] = useState(false)
  const handleDone = (): void => {
    setIsDone(true)
  }
  return (
    <LoadingAnnouncer>
      <View isLoading={!isDone} />
      <View isLoading={!isDone} />
      <View isLoading={!isDone} />
      <button type="button" onClick={handleDone}>
        done
      </button>
    </LoadingAnnouncer>
  )
}

function Stages(): ReactElement {
  const [stage, setStage] = useState(0)
  const handleNext = (): void => {
    setStage(current => current + 1)
  }
  return (
    <LoadingAnnouncer>
      {stage === 0 && <View isLoading />}
      {stage === 2 && <View isLoading />}
      <button type="button" onClick={handleNext}>
        next
      </button>
    </LoadingAnnouncer>
  )
}

describe('LoadingAnnouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('says "Loading" once for views loading together, then nothing', () => {
    renderWithProviders(<Views />)

    const region = screen.getByTestId('loading-announcement')
    expect(region).toHaveTextContent('Loading')

    act(() => {
      screen.getByRole('button', { name: 'done' }).click()
    })
    act(() => {
      jest.advanceTimersByTime(LOADING_GRACE_MS)
    })

    expect(region).toBeEmptyDOMElement()
  })

  it('keeps saying "Loading" across a short gap between two stages', () => {
    renderWithProviders(<Stages />)
    const region = screen.getByTestId('loading-announcement')
    const next = screen.getByRole('button', { name: 'next' })

    act(() => {
      next.click()
    })
    act(() => {
      jest.advanceTimersByTime(LOADING_GRACE_MS - 1)
    })
    expect(region).toHaveTextContent('Loading')

    act(() => {
      next.click()
    })
    act(() => {
      jest.advanceTimersByTime(LOADING_GRACE_MS)
    })
    expect(region).toHaveTextContent('Loading')
  })

  it('stays silent when nothing loads', () => {
    renderWithProviders(
      <LoadingAnnouncer>
        <View isLoading={false} />
      </LoadingAnnouncer>
    )

    expect(screen.getByTestId('loading-announcement')).toBeEmptyDOMElement()
  })

  it('keeps one region for the page when an announcer is inside another', () => {
    renderWithProviders(
      <LoadingAnnouncer>
        <LoadingAnnouncer>
          <View isLoading />
        </LoadingAnnouncer>
      </LoadingAnnouncer>
    )

    expect(screen.getByTestId('loading-announcement')).toHaveTextContent(
      'Loading'
    )
  })

  it('lets a view render without the announcer', () => {
    renderWithProviders(<View isLoading />)

    expect(screen.getByText('view')).toBeInTheDocument()
  })
})
