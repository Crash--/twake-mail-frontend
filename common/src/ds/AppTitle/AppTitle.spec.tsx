import { Button, useColorScheme } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { AppTitle } from './AppTitle'

function SchemeSwitch(): ReactElement {
  const { setMode } = useColorScheme()
  return (
    <>
      <Button onClick={() => setMode('dark')}>dark</Button>
      <Button onClick={() => setMode('light')}>light</Button>
    </>
  )
}

describe('AppTitle', () => {
  it('is one image named by its label, the light logotype', () => {
    renderDs(
      <AppTitle
        label="Twake Mail"
        src="/light.svg"
        darkSrc="/dark.svg"
        data-testid="app-title"
      />
    )

    const image = screen.getByRole('img', { name: 'Twake Mail' })
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(image).toHaveAttribute('src', '/light.svg')
    expect(screen.getByTestId('app-title')).toContainElement(image)
  })

  it('follows the scheme, also when it changes', async () => {
    const user = userEvent.setup()
    renderDs(
      <>
        <AppTitle label="Twake Mail" src="/light.svg" darkSrc="/dark.svg" />
        <SchemeSwitch />
      </>
    )

    await user.click(screen.getByRole('button', { name: 'dark' }))

    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Twake Mail' })).toHaveAttribute(
      'src',
      '/dark.svg'
    )

    await user.click(screen.getByRole('button', { name: 'light' }))

    expect(screen.getByRole('img', { name: 'Twake Mail' })).toHaveAttribute(
      'src',
      '/light.svg'
    )
  })

  it('is 32 px high as twake-mui, its width following the image', () => {
    renderDs(
      <AppTitle label="Twake Mail" src="/light.svg" darkSrc="/dark.svg" />
    )

    const image = screen.getByRole('img', { name: 'Twake Mail' })
    expect(image).toHaveStyle({ height: '32px', width: 'auto' })
  })
})
