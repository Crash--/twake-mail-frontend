import { Alert, Button } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { settingsSectionPath } from '@common/features/settings/sections'
import { formatFullDate } from '@common/features/thread/formatListDate'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  disabledVacation,
  saveVacation,
  useVacation,
  vacationKeys,
  vacationState
} from './vacation'

/**
 * Says that vacation responses are being sent, above every screen, with
 * "End now" and the way to its settings, as tmail-flutter does; on the
 * vacation settings, when they start later. A response whose end date
 * passed is turned off (tmail-flutter `syncVacationResponse`).
 */
export function VacationBanner(): ReactElement | null {
  const { t, lang } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId } = useJmapSession()
  const { notify } = useNotify()
  const { data: vacation } = useVacation()
  const [now] = useState(() => new Date())
  const [isEnding, setIsEnding] = useState(false)
  const isOnVacationSettings =
    useMatch(`${settingsSectionPath('vacation')}/*`) !== null
  const state = vacation ? vacationState(vacation, now) : 'off'

  const end = async (isAutomatic: boolean): Promise<void> => {
    if (!vacation) return
    const isSaved = await saveVacation(
      client,
      accountId,
      disabledVacation(vacation)
    )
    await queryClient.invalidateQueries({
      queryKey: vacationKeys.all(accountId)
    })
    if (!isAutomatic && isSaved) {
      notify({ message: t('vacation.toasts.ended'), severity: 'success' })
    }
  }

  useEffect(() => {
    if (state !== 'ended') return
    end(true).catch((error: unknown) => {
      console.warn('[vacation] Cannot turn off an ended response', error)
    })
    // Once per state reached
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const handleEndNow = (): void => {
    setIsEnding(true)
    end(false)
      .catch((error: unknown) => {
        console.error('[vacation] Cannot end it', error)
        notify({ message: t('common.errorOccurredShort'), severity: 'error' })
      })
      .finally(() => {
        setIsEnding(false)
      })
  }

  if (!vacation) return null

  if (state === 'scheduled' && isOnVacationSettings && vacation.fromDate) {
    return (
      <Alert severity="info" className="u-m-1" data-testid="vacation-banner">
        {t('vacation.banner.willStart', {
          startDate: formatFullDate(vacation.fromDate, lang)
        })}
      </Alert>
    )
  }

  if (state !== 'active') return null

  return (
    <Alert
      severity="warning"
      className="u-m-1"
      data-testid="vacation-banner"
      action={
        <>
          <Button
            color="inherit"
            disabled={isEnding}
            onClick={handleEndNow}
            data-testid="vacation-end-now-button"
          >
            {t('vacation.banner.endNow')}
          </Button>
          {isOnVacationSettings ? null : (
            <Button
              color="inherit"
              component={Link}
              to={settingsSectionPath('vacation')}
              data-testid="vacation-settings-button"
            >
              {t('vacation.banner.settings')}
            </Button>
          )}
        </>
      }
    >
      {t('vacation.banner.enabled')}
    </Alert>
  )
}
