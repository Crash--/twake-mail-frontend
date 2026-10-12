import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { LoginLayout } from './LoginLayout'

describe('LoginLayout', () => {
  it('is the main landmark holding the pitch, the form and the named mark', () => {
    renderDs(
      <LoginLayout
        pitchTitle="Mail"
        pitchPoints={[
          { iconSrc: '/a.svg', text: 'Fast' },
          { iconSrc: '/b.svg', text: 'Safe' }
        ]}
        pitchImageSrc="/c.svg"
        footerImageSrc="/d.svg"
        footerLabel="Powered by LINAGORA"
      >
        <p>Form</p>
      </LoginLayout>
    )

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('Form')
    expect(
      screen.getAllByRole('listitem').map(item => item.textContent)
    ).toEqual(['Fast', 'Safe'])
    expect(
      screen.getByRole('img', { name: 'Powered by LINAGORA' })
    ).toBeVisible()
  })
})
