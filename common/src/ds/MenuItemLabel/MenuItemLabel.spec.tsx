import { Menu, MenuItem } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { MenuItemLabel } from './MenuItemLabel'

const LABEL = 'Télécharger le message au format EML'

function setWidths(element: HTMLElement, scroll: number, client: number): void {
  Object.defineProperty(element, 'scrollWidth', { value: scroll })
  Object.defineProperty(element, 'clientWidth', { value: client })
}

function setup(): HTMLElement {
  renderDs(
    <Menu open anchorEl={document.body}>
      <MenuItem>
        <MenuItemLabel label={LABEL} />
      </MenuItem>
    </Menu>
  )
  return screen.getByText(LABEL)
}

describe('MenuItemLabel', () => {
  it('keeps the label on one line, cut with an ellipsis', () => {
    const text = setup()

    expect(text).toHaveStyle({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    })
  })

  it('shows the full label on hover when it is cut', async () => {
    const user = userEvent.setup()
    const text = setup()
    setWidths(text, 320, 240)

    await user.hover(text)

    expect(await screen.findByRole('tooltip')).toHaveTextContent(LABEL)
  })

  it('shows no tooltip when the label fits', async () => {
    const user = userEvent.setup()
    const text = setup()
    setWidths(text, 120, 240)

    await user.hover(text)
    await new Promise(resolve => setTimeout(resolve, 700))

    expect(screen.queryByRole('tooltip')).toBe(null)
  })
})
