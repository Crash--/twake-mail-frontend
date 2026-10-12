import { Box } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { SettingsMenuSelect } from '@/ds/SettingsFields/SettingsFields'
import { useLanguage } from '@common/i18n/I18nProvider'
import {
  LANGUAGE_NATIVE_NAMES,
  SUPPORTED_LANGUAGES,
  toSupportedLanguage
} from '@common/i18n/languages'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { SettingsSection } from './sections'
import { SettingsSectionLayout } from './SettingsSectionLayout'
import {
  canChangeServerSetting,
  serverSettingsKeys,
  updateServerSetting
} from './serverSettings'

export interface LanguageSettingsProps {
  section: SettingsSection
}

/**
 * Settings > Language: the language of the app, applied at once, kept in
 * this browser and, when the server keeps settings, in the `language` of
 * the account, which follows the user on every device (tmail-flutter).
 */
export function LanguageSettings({
  section
}: LanguageSettingsProps): ReactElement {
  const { t } = useI18n()
  const { lang, setLanguage } = useLanguage()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, session } = useJmapSession()

  const handleChange = (value: string): void => {
    const next = toSupportedLanguage(value)
    if (next === null || next === lang) return
    setLanguage(next)
    if (!canChangeServerSetting(session, 'language')) return
    // As tmail-flutter, a failure only leaves the other devices as they are
    updateServerSetting(client, accountId, 'language', next)
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: serverSettingsKeys.all(accountId)
        })
      )
      .catch((error: unknown) => {
        console.warn('[settings] Language not kept on the server', error)
      })
  }

  return (
    <SettingsSectionLayout section={section}>
      {/* As tmail-flutter: 39 px under the header, the field names the
          language picked, its menu each language in the language of the
          app and in its own */}
      <Box className="u-mt-1">
        <SettingsMenuSelect
          label={t('settings.language.label')}
          value={lang}
          options={SUPPORTED_LANGUAGES.map(language => ({
            value: language,
            label: `${t(`settings.language.names.${language}`)} - ${LANGUAGE_NATIVE_NAMES[language]}`,
            shortLabel: t(`settings.language.names.${language}`),
            lang: language
          }))}
          onChange={handleChange}
          inputTestId="language-select"
        />
      </Box>
    </SettingsSectionLayout>
  )
}
