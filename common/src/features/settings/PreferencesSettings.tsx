import { useQueryClient } from '@tanstack/react-query'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import { useState, type ReactElement } from 'react'

import { useSentryReporting } from '@common/features/sentry/useSentryReporting'
import { useLabelVisibility } from '@common/features/labels/labelVisibility'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { PreferenceOption } from './PreferenceOption'
import type { SettingsSection } from './sections'
import { SettingsSectionLayout } from './SettingsSectionLayout'
import {
  canChangeServerSetting,
  isAlwaysRequestingReadReceipts,
  isShowingSenderPriority,
  serverSettingsKeys,
  type ServerSettingKey,
  updateServerSetting,
  useServerSettings
} from './serverSettings'
import { useThreadPreference } from './threadPreference'

export interface PreferencesSettingsProps {
  section: SettingsSection
}

/**
 * Settings > Preferences, as tmail-flutter: the read receipts asked for
 * every message, the important flag set by senders and the error reports
 * (settings of the account on the server, when it keeps them; the reports
 * only when error reporting is configured), the conversation view and the
 * labels (kept in this browser).
 */
export function PreferencesSettings({
  section
}: PreferencesSettingsProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, session } = useJmapSession()
  const { notify } = useNotify()
  const threadPreference = useThreadPreference()
  const [isLabelVisible, setLabelVisible] = useLabelVisibility()
  const hasLabels = LINAGORA_CAPABILITIES.labels in session.capabilities
  const { settings } = useServerSettings()
  const errorReporting = useSentryReporting()
  const [saving, setSaving] = useState<ServerSettingKey | null>(null)

  const changeServerSetting = (key: ServerSettingKey, isOn: boolean): void => {
    setSaving(key)
    updateServerSetting(client, accountId, key, String(isOn))
      .then(async isSaved => {
        if (!isSaved) throw new Error(`Settings/set refused ${key}`)
        await queryClient.invalidateQueries({
          queryKey: serverSettingsKeys.all(accountId)
        })
      })
      .catch((error: unknown) => {
        console.error('[settings] Cannot change a preference', error)
        notify({ message: t('common.errorOccurredShort'), severity: 'error' })
      })
      .finally(() => {
        setSaving(null)
      })
  }

  const serverOption = (key: ServerSettingKey): boolean =>
    settings !== null && canChangeServerSetting(session, key)

  return (
    <SettingsSectionLayout section={section}>
      {serverOption('read.receipts.always') && settings !== null ? (
        <PreferenceOption
          title={t('settings.preferences.readReceipts')}
          description={t('settings.preferences.readReceiptsDescription')}
          toggleLabel={t('settings.preferences.readReceiptsToggle')}
          isChecked={isAlwaysRequestingReadReceipts(settings)}
          isDisabled={saving === 'read.receipts.always'}
          onChange={isOn => {
            changeServerSetting('read.receipts.always', isOn)
          }}
          data-testid="read-receipts-setting-toggle"
        />
      ) : null}
      {serverOption('display.sender.priority') && settings !== null ? (
        <PreferenceOption
          title={t('settings.preferences.senderPriority')}
          description={t('settings.preferences.senderPriorityDescription')}
          toggleLabel={t('settings.preferences.senderPriorityToggle')}
          isChecked={isShowingSenderPriority(settings)}
          isDisabled={saving === 'display.sender.priority'}
          onChange={isOn => {
            changeServerSetting('display.sender.priority', isOn)
          }}
          data-testid="sender-priority-setting-toggle"
        />
      ) : null}
      {errorReporting.isConfigured && errorReporting.canChoose ? (
        <PreferenceOption
          title={t('settings.preferences.errorReporting')}
          description={t('settings.preferences.errorReportingDescription')}
          toggleLabel={t('settings.preferences.errorReportingToggle')}
          isChecked={errorReporting.isOptedIn}
          isDisabled={saving === 'sentry.user-opt-in'}
          onChange={isOn => {
            changeServerSetting('sentry.user-opt-in', isOn)
          }}
          data-testid="error-reporting-setting-toggle"
        />
      ) : null}
      <PreferenceOption
        title={t('settings.preferences.thread')}
        description={t('settings.preferences.threadDescription')}
        toggleLabel={t('settings.preferences.threadToggle')}
        isChecked={threadPreference.isEnabled}
        onChange={threadPreference.setEnabled}
        data-testid="thread-setting-toggle"
      />
      {hasLabels ? (
        <PreferenceOption
          title={t('settings.preferences.labels')}
          description={t('settings.preferences.labelsDescription')}
          toggleLabel={t('settings.preferences.labelsToggle')}
          isChecked={isLabelVisible}
          onChange={setLabelVisible}
          data-testid="label-visibility-setting-toggle"
        />
      ) : null}
    </SettingsSectionLayout>
  )
}
