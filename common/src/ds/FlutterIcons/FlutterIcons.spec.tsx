import { renderDs } from '@/ds/testing/renderDs'
import { Icon } from '@/ds/Icon/Icon'

import * as FlutterIcons from './FlutterIcons'

describe('FlutterIcons', () => {
  it('draws every icon, the one-colour ones in the current colour', () => {
    const { container } = renderDs(
      <>
        {Object.entries(FlutterIcons).map(([name, icon]) => (
          <Icon key={name} icon={icon} aria-hidden="true" />
        ))}
      </>
    )

    const svgs = Array.from(container.querySelectorAll('svg'))
    expect(svgs).toHaveLength(Object.keys(FlutterIcons).length)
    svgs.forEach(svg => {
      expect(svg.querySelector('path, circle, rect')).not.toBeNull()
    })
    expect(
      container.querySelector('[fill="currentColor"], [stroke="currentColor"]')
    ).not.toBeNull()
  })
})
