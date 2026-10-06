import { act, screen } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { LoadingAnnouncer, useLoadingAnnouncement } from './LoadingAnnouncer'

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

describe('LoadingAnnouncer', () => {
  it('says "Loading" once for views loading together, then nothing', () => {
    renderWithProviders(<Views />)

    const region = screen.getByTestId('loading-announcement')
    expect(region).toHaveTextContent('Loading')

    act(() => {
      screen.getByRole('button', { name: 'done' }).click()
    })

    expect(region).toBeEmptyDOMElement()
  })

  it('stays silent when nothing loads', () => {
    renderWithProviders(
      <LoadingAnnouncer>
        <View isLoading={false} />
      </LoadingAnnouncer>
    )

    expect(screen.getByTestId('loading-announcement')).toBeEmptyDOMElement()
  })

  it('lets a view render without the announcer', () => {
    renderWithProviders(<View isLoading />)

    expect(screen.getByText('view')).toBeInTheDocument()
  })
})
