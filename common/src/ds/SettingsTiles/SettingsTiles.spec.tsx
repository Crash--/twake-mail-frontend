import { screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import { Check } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsAccount,
  SettingsTile,
  SettingsTileList
} from './SettingsTiles'

function Anchor({
  to,
  children,
  ...props
}: {
  to: string
  children?: ReactNode
}): ReactElement {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  )
}

describe('SettingsTiles', () => {
  it('lists the sections as links named by their title and explanation', () => {
    renderDs(
      <>
        <SettingsAccount avatar={<span>BO</span>}>
          bob@example.com
        </SettingsAccount>
        <SettingsTileList>
          <SettingsTile
            icon={Check}
            title="Profiles"
            explanation="Select the identity"
            component={Anchor}
            to="/settings/profiles"
          />
          <SettingsTile
            icon={Check}
            title="Preferences"
            explanation={null}
            component={Anchor}
            to="/settings/preferences"
          />
        </SettingsTileList>
      </>
    )

    expect(screen.getByText('bob@example.com')).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByRole('link', { name: 'Profiles Select the identity' })
    ).toHaveAttribute('href', '/settings/profiles')
    expect(screen.getByRole('link', { name: 'Preferences' })).toHaveAttribute(
      'href',
      '/settings/preferences'
    )
  })
})
