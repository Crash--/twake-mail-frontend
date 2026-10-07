import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  TextField,
  Typography
} from '@linagora/twake-mui'
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
  const enableId = useId()
  const editorRef = useRef<Editor | null>(null)
  const start = toLocalInputs(vacation.fromDate)
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
      <FormControlLabel
        control={
          <Switch
            id={enableId}
            checked={isEnabled}
            disabled={isSaving}
            onChange={event => {
              setIsEnabled(event.target.checked)
              setProblem(null)
            }}
            data-testid="vacation-enable-toggle"
          />
        }
        label={t('vacation.enable')}
      />
      <Box className="u-flex u-flex-wrap u-mt-1">
        <TextField
          type="date"
          className="u-mr-1 u-mb-1"
          label={t('vacation.startDate')}
          value={startDate}
          disabled={isOff}
          required={isEnabled}
          onChange={event => {
            setStartDate(event.target.value)
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'vacation-start-date-input' }
          }}
        />
        <TextField
          type="time"
          className="u-mb-1"
          label={t('vacation.startTime')}
          value={startTime}
          disabled={isOff}
          onChange={event => {
            setStartTime(event.target.value)
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'vacation-start-time-input' }
          }}
        />
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={hasEnd}
            disabled={isOff}
            onChange={event => {
              setHasEnd(event.target.checked)
              if (!event.target.checked) {
                setEndDate('')
                setEndTime('')
              }
            }}
            data-testid="vacation-end-toggle"
          />
        }
        label={t('vacation.stops')}
      />
      <Box className="u-flex u-flex-wrap u-mt-1">
        <TextField
          type="date"
          className="u-mr-1 u-mb-1"
          label={t('vacation.endDate')}
          value={endDate}
          disabled={isOff || !hasEnd}
          onChange={event => {
            setEndDate(event.target.value)
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'vacation-end-date-input' }
          }}
        />
        <TextField
          type="time"
          className="u-mb-1"
          label={t('vacation.endTime')}
          value={endTime}
          disabled={isOff || !hasEnd}
          onChange={event => {
            setEndTime(event.target.value)
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'vacation-end-time-input' }
          }}
        />
      </Box>
      <TextField
        fullWidth
        className="u-mb-1"
        label={t('vacation.subject')}
        placeholder={t('vacation.subjectPlaceholder')}
        value={subject}
        disabled={isOff}
        onChange={event => {
          setSubject(event.target.value)
        }}
        slotProps={{ htmlInput: { 'data-testid': 'vacation-subject-input' } }}
      />
      <Typography
        variant="subtitle2"
        component="p"
        color="textPrimary"
        className="u-mb-half"
      >
        {t('vacation.message')}
      </Typography>
      <Box>
        <RichTextEditor
          key={editorKey}
          labels={{ ...labels, editor: t('vacation.message') }}
          content={vacation.htmlBody ?? ''}
          disabled={isOff}
          colors={colors}
          fontSizes={fontSizes}
          fontFamilies={fontFamilies}
          onReady={editor => {
            editorRef.current = editor
          }}
          testIds={EDITOR_TEST_IDS}
        />
      </Box>
      {problem === null ? null : (
        <Alert severity="error" className="u-mt-1" data-testid="vacation-error">
          {t(problem)}
        </Alert>
      )}
      <Box className="u-flex u-flex-justify-end u-mt-1">
        <Button
          variant="outlined"
          color="inherit"
          className="u-mr-half"
          disabled={isSaving}
          onClick={handleCancel}
          data-testid="vacation-cancel-button"
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSaving}
          startIcon={
            isSaving ? <CircularProgress size={16} color="inherit" /> : null
          }
          data-testid="vacation-save-button"
        >
          {t('vacation.save')}
        </Button>
      </Box>
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
