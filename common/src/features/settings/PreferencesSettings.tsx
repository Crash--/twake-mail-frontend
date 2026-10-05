import { FormControlLabel, Switch } from '@linagora/twake-mui'
import { useId, type ChangeEvent, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import type { SettingsSection } from './sections'
import { SettingsSectionLayout } from './SettingsSectionLayout'
import { useThreadPreference } from './threadPreference'

export interface PreferencesSettingsProps {
  section: SettingsSection
}

/** Settings > Preferences: the conversation view (kept in this browser) */
export function PreferencesSettings({
  section
}: PreferencesSettingsProps): ReactElement {
  const { t } = useI18n()
  const threadPreference = useThreadPreference()
  const threadDescriptionId = useId()

  const handleThreadChange = (event: ChangeEvent<HTMLInputElement>): void => {
    threadPreference.setEnabled(event.target.checked)
  }

  return (
    <SettingsSectionLayout section={section}>
      <FormControlLabel
        control={
          <Switch
            checked={threadPreference.isEnabled}
            onChange={handleThreadChange}
            slotProps={{
              input: { 'aria-describedby': threadDescriptionId }
            }}
            data-testid="thread-setting-toggle"
          />
        }
        label={t('settings.preferences.thread')}
      />
      <SecondaryText id={threadDescriptionId} variant="body2" component="p">
        {t('settings.preferences.threadDescription')}
      </SecondaryText>
    </SettingsSectionLayout>
  )
}
