import { Alert, Box, Button } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import type { VacationResponse } from 'jmap-client-ts'
import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { RichTextEditor } from '@/ds/RichTextEditor/RichTextEditor'
import {
  SettingsPrimaryButton,
  SettingsTextButton
} from '@/ds/SettingsButtons/SettingsButtons'
import {
  SettingsFormColumn,
  SettingsFormField,
  SettingsFormPair,
  SettingsFormRow,
  SettingsTextField
} from '@/ds/SettingsFields/SettingsFields'
import { SettingsSwitchRow } from '@/ds/SettingsOption/SettingsOption'
import { useEditorLabels } from '@common/features/composer/useEditorLabels'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  disabledVacation,
  fromLocalInputs,
  saveVacation,
  startInputs,
  toLocalInputs,
  useVacation,
  vacationKeys
} from './vacation'

export interface VacationSettingsProps {
  section: SettingsSection
}

interface VacationFormProps {
  vacation: VacationResponse
}

const EDITOR_TEST_IDS = { editor: 'vacation-message-editor' }

/** The form, filled with the vacation response of the server */
function VacationForm({ vacation }: VacationFormProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId } = useJmapSession()
  const { notify } = useNotify()
  const { labels, colors, fontSizes, fontFamilies } = useEditorLabels()
  const startDateId = useId()
  const startTimeId = useId()
  const endDateId = useId()
  const endTimeId = useId()
  const subjectId = useId()
  const editorRef = useRef<Editor | null>(null)
  const [start] = useState(() => startInputs(vacation.fromDate, new Date()))
  const end = toLocalInputs(vacation.toDate)
  const [isEnabled, setIsEnabled] = useState(vacation.isEnabled)
  const [startDate, setStartDate] = useState(start.date)
  const [startTime, setStartTime] = useState(start.time)
  const [hasEnd, setHasEnd] = useState(vacation.toDate !== null)
  const [endDate, setEndDate] = useState(end.date)
  const [endTime, setEndTime] = useState(end.time)
  const [subject, setSubject] = useState(vacation.subject ?? '')
  const [problem, setProblem] = useState<TranslationKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const isOff = !isEnabled || isSaving

  const values = (): VacationResponse | TranslationKey => {
    if (!isEnabled) return { id: 'singleton', ...disabledVacation(vacation) }
    const fromDate = fromLocalInputs(startDate, startTime)
    if (fromDate === null) return 'vacation.errors.noStart'
    const toDate = hasEnd ? fromLocalInputs(endDate, endTime) : null
    if (hasEnd && toDate === null) return 'vacation.errors.noEnd'
    if (toDate !== null && Date.parse(toDate) < Date.parse(fromDate)) {
      return 'vacation.errors.endBeforeStart'
    }
    const editor = editorRef.current
    if (!editor || editor.isEmpty) return 'vacation.errors.noMessage'
    return {
      id: 'singleton',
      isEnabled: true,
      fromDate,
      toDate,
      subject: subject.trim() === '' ? null : subject.trim(),
      textBody: editor.getText({ blockSeparator: '\n' }).trim(),
      htmlBody: editor.getHTML()
    }
  }

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    const result = values()
    if (typeof result === 'string') {
      setProblem(result)
      return
    }
    const { id: _id, ...next } = result
    setIsSaving(true)
    setProblem(null)
    saveVacation(client, accountId, next)
      .then(async isSaved => {
        if (!isSaved) throw new Error('VacationResponse/set refused')
        await queryClient.invalidateQueries({
          queryKey: vacationKeys.all(accountId)
        })
        notify({ message: t('vacation.toasts.saved'), severity: 'success' })
      })
      .catch((error: unknown) => {
        console.error('[vacation] Cannot save', error)
        notify({ message: t('common.errorOccurredShort'), severity: 'error' })
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  const handleCancel = (): void => {
    setIsEnabled(vacation.isEnabled)
    setStartDate(start.date)
    setStartTime(start.time)
    setHasEnd(vacation.toDate !== null)
    setEndDate(end.date)
    setEndTime(end.time)
    setSubject(vacation.subject ?? '')
    setProblem(null)
    setEditorKey(key => key + 1)
  }

  return (
    <form onSubmit={handleSubmit} noValidate data-testid="vacation-form">
      <SettingsSwitchRow
        title={t('vacation.enable')}
        isChecked={isEnabled}
        isDisabled={isSaving}
        onChange={checked => {
          setIsEnabled(checked)
          setProblem(null)
        }}
        data-testid="vacation-enable-toggle"
      />
      {/* As tmail-flutter: a column of labelled rows, 660 px wide at most */}
      <SettingsFormColumn>
        <SettingsFormPair
          isDisabled={isOff}
          first={{
            label: `${t('vacation.startDate')}:`,
            htmlFor: startDateId,
            field: (
              <SettingsTextField
                id={startDateId}
                type="date"
                size="form"
                width={150}
                label={t('vacation.startDate')}
                value={startDate}
                disabled={isOff}
                required={isEnabled}
                onChange={event => {
                  setStartDate(event.target.value)
                }}
                inputTestId="vacation-start-date-input"
              />
            )
          }}
          second={{
            label: `${t('vacation.startTime')}:`,
            htmlFor: startTimeId,
            field: (
              <SettingsTextField
                id={startTimeId}
                type="time"
                size="form"
                width={130}
                label={t('vacation.startTime')}
                value={startTime}
                disabled={isOff}
                onChange={event => {
                  setStartTime(event.target.value)
                }}
                inputTestId="vacation-start-time-input"
              />
            )
          }}
        />
        {/* As tmail-flutter: apart from the start */}
        <Box className="u-mt-1">
          <SettingsSwitchRow
            title={t('vacation.stops')}
            isChecked={hasEnd}
            isDisabled={isOff}
            onChange={checked => {
              setHasEnd(checked)
              // Safari shows today in an empty date input: fill the end with
              // the start, so that what is shown is what gets saved
              setEndDate(checked ? startDate : '')
              setEndTime(checked ? startTime : '')
            }}
            data-testid="vacation-end-toggle"
          />
        </Box>
        <SettingsFormPair
          isDisabled={isOff || !hasEnd}
          first={{
            label: `${t('vacation.endDate')}:`,
            htmlFor: endDateId,
            field: (
              <SettingsTextField
                id={endDateId}
                type="date"
                size="form"
                width={150}
                label={t('vacation.endDate')}
                value={endDate}
                disabled={isOff || !hasEnd}
                onChange={event => {
                  setEndDate(event.target.value)
                }}
                inputTestId="vacation-end-date-input"
              />
            )
          }}
          second={{
            label: `${t('vacation.endTime')}:`,
            htmlFor: endTimeId,
            field: (
              <SettingsTextField
                id={endTimeId}
                type="time"
                size="form"
                width={130}
                label={t('vacation.endTime')}
                value={endTime}
                disabled={isOff || !hasEnd}
                onChange={event => {
                  setEndTime(event.target.value)
                }}
                inputTestId="vacation-end-time-input"
              />
            )
          }}
        />
        <SettingsFormRow
          label={`${t('vacation.subject')}:`}
          htmlFor={subjectId}
          isDisabled={isOff}
        >
          <SettingsFormField>
            <SettingsTextField
              id={subjectId}
              size="form"
              width="100%"
              label={t('vacation.subject')}
              placeholder={t('vacation.subjectPlaceholder')}
              value={subject}
              disabled={isOff}
              onChange={event => {
                setSubject(event.target.value)
              }}
              inputTestId="vacation-subject-input"
            />
          </SettingsFormField>
        </SettingsFormRow>
        <SettingsFormRow
          label={`${t('vacation.message')}:`}
          alignTop
          isDisabled={isOff}
        >
          <SettingsFormField>
            <RichTextEditor
              key={editorKey}
              labels={{ ...labels, editor: t('vacation.message') }}
              content={vacation.htmlBody ?? ''}
              disabled={isOff}
              colors={colors}
              fontSizes={fontSizes}
              fontFamilies={fontFamilies}
              // As tmail-flutter: one box, its buttons at the bottom
              look="settings"
              onReady={editor => {
                editorRef.current = editor
              }}
              testIds={EDITOR_TEST_IDS}
            />
          </SettingsFormField>
        </SettingsFormRow>
        {problem === null ? null : (
          <Alert
            severity="error"
            className="u-mt-1"
            data-testid="vacation-error"
          >
            {t(problem)}
          </Alert>
        )}
        <Box className="u-flex u-flex-justify-end u-flex-items-center u-mt-1">
          <SettingsTextButton
            label={t('common.cancel')}
            disabled={isSaving}
            onClick={handleCancel}
            data-testid="vacation-cancel-button"
          />
          <SettingsPrimaryButton
            type="submit"
            label={t('vacation.save')}
            disabled={isSaving}
            data-testid="vacation-save-button"
          />
        </Box>
      </SettingsFormColumn>
    </form>
  )
}

/**
 * Settings > Vacation (`VacationResponse`), as tmail-flutter: on or off,
 * from a date and time, until another one if wanted, with a subject and a
 * rich message
 */
export function VacationSettings({
  section
}: VacationSettingsProps): ReactElement {
  const { t } = useI18n()
  const query = useVacation()

  return (
    <SettingsSectionLayout section={section}>
      {query.isPending ? (
        <LoadingListSkeleton count={3} />
      ) : query.isError ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => {
                void query.refetch()
              }}
            >
              {t('common.retry')}
            </Button>
          }
        >
          {t('common.errorOccurredShort')}
        </Alert>
      ) : (
        <VacationForm key={query.dataUpdatedAt} vacation={query.data} />
      )}
    </SettingsSectionLayout>
  )
}
