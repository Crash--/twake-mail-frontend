import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsDescription,
  SettingsPane,
  SettingsSubheading,
  SettingsTitle
} from './SettingsHeading'

describe('SettingsHeading', () => {
  it('names the section by its focusable title, then its description and headings', () => {
    renderDs(
      <SettingsPane labelledBy="title">
        <SettingsTitle id="title">Profiles</SettingsTitle>
        <SettingsDescription>Who you send as</SettingsDescription>
        <SettingsSubheading>Signatures</SettingsSubheading>
      </SettingsPane>
    )

    expect(screen.getByRole('region', { name: 'Profiles' })).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Profiles' })
    ).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('Who you send as')).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Signatures' })
    ).toBeVisible()
  })
})
