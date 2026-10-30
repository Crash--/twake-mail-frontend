import { Calendar, Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Tooltip
} from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { AnchoredDialog } from '@/ds/AnchoredDialog/AnchoredDialog'
import { formatDayText } from '@/ds/DateRangePicker/calendarDays'
import { FormRow } from '@/ds/FormRow/FormRow'
import { LabeledCheckbox } from '@/ds/LabeledCheckbox/LabeledCheckbox'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { RecipientFieldDnd } from '@/ds/RecipientField/RecipientField'
import { DayRangeDialog } from '@common/features/dateRange/DayRangeDialog'
import type { DayRange } from '@common/features/dateRange/dayRange'
import { labelDisplayName } from '@common/features/labels/labelDisplayName'
import { useLabels, useLabelsAvailable } from '@common/features/labels/queries'
import { fetchEmailSenders } from '@common/features/thread/emailSenders'
import {
  DRAGGED_EMAILS_TYPE,
  readDraggedEmails
} from '@common/features/thread/useEmailListActions'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { AddressFilterField, mergeEntries } from './AddressFilterField'

import {
  DATE_RANGES,
  EMPTY_SEARCH_FILTER,
  formatDay,
  SORT_ORDERS,
  splitWords,
  type SearchFilter
} from './searchFilter'
import { DATE_LABELS, SORT_LABELS } from './searchLabels'
import { usePickSearchScope, useSearchScopeLabel } from './usePickSearchScope'

type AddressKind = 'from' | 'to'

/** The value of "All labels" in its list: a keyword holds no space */
const ALL_LABELS = 'all labels'

/** The days of the custom range of a filter, null without both */
function customRange(filter: SearchFilter): DayRange | null {
  return filter.dateRange === 'custom' &&
    filter.startDate !== null &&
    filter.endDate !== null
    ? { start: filter.startDate, end: filter.endDate }
    : null
}

/** The text fields, as typed: lists are split when the form is submitted */
interface TextFields {
  subject: string
  text: string
  notWords: string
}

function toTextFields(filter: SearchFilter): TextFields {
  return {
    subject: filter.subject,
    text: filter.text,
    notWords: filter.notWords.join(', ')
  }
}

function withTextFields(
  filter: SearchFilter,
  fields: TextFields
): SearchFilter {
  return {
    ...filter,
    subject: fields.subject.trim(),
    text: fields.text.trim(),
    notWords: splitWords(fields.notWords)
  }
}

export interface AdvancedSearchDialogProps {
  /** The search being typed, quick filters included */
  filter: SearchFilter
  /** The search field: on a desktop the form opens over it */
  anchorEl: HTMLElement | null
  onClose: () => void
  /** Runs the search of the form */
  onSubmit: (filter: SearchFilter) => void
}

/**
 * The advanced search of tmail-flutter: from, to, subject, words the email
 * has and has not, folder, label, date, order, and the attachment, unread,
 * starred and events filters. On a desktop it is the white card of the
 * design opening over the search field, on a phone a full screen dialog. It
 * opens on the search being typed (the quick filters picked under the field
 * are checked here) and runs it on submit; "Clear filter" empties it, the
 * order excepted; Escape (and "Cancel" on a phone) leaves it unchanged.
 *
 * As tmail-flutter's `AdvancedSearchInputForm`: the folder opens the
 * destination picker, the label, the date and the order are lists dropping
 * under their field (`DateDropDownButton`, `LabelDropDownButton`,
 * `SortByDropDownButton`), and "Custom range", like the calendar button
 * beside the date, opens the date range picker; the date then shows the
 * range chosen.
 */
export function AdvancedSearchDialog({
  filter,
  anchorEl,
  onClose,
  onSubmit
}: AdvancedSearchDialogProps): ReactElement {
  const { t } = useI18n()
  const labelsAvailable = useLabelsAvailable()
  const labelList = useLabels().data?.list
  const labels = labelsAvailable ? (labelList ?? []) : []
  const scopeLabelOf = useSearchScopeLabel()
  const pickSearchScope = usePickSearchScope()
  const [draft, setDraft] = useState(filter)
  const [fields, setFields] = useState(() => toTextFields(filter))
  const [isRangeOpen, setIsRangeOpen] = useState(false)
  const dateRef = useRef<{ focus: () => void }>(null)
  /** What gets the focus back once the range picker is gone */
  const rangeOpenerRef = useRef<{ focus: () => void } | null>(null)
  /**
   * The folder picker is open: it is not inside the card, a click there
   * must not close it as a click outside
   */
  const isPickingRef = useRef(false)
  const id = useId()
  const fieldId = (name: string): string => `${id}-${name}`
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  /** The addresses now, for the senders of dropped emails, read later */
  const latest = useRef(draft)
  useEffect(() => {
    latest.current = draft
  }, [draft])

  /**
   * As tmail-flutter: a tag dragged to the other field moves there (Alt +
   * ArrowUp or ArrowDown from the keyboard), joining it unless already
   * there; emails dragged from the list add their senders
   */
  const moveAddress = (from: AddressKind, entry: string): string => {
    const to: AddressKind = from === 'from' ? 'to' : 'from'
    setDraft(current => ({
      ...current,
      [to]: mergeEntries(current[to], [entry]),
      [from]: current[from].filter(other => other !== entry)
    }))
    return t('composer.recipients.moved', {
      address: entry,
      field: t(to === 'from' ? 'search.fields.from' : 'search.fields.to')
    })
  }
  const dndOf = (kind: AddressKind): RecipientFieldDnd => ({
    group: id,
    field: kind,
    onMoveIn: (from, entry) =>
      from === 'from' || from === 'to' ? moveAddress(from, entry) : null,
    onMoveBy: (entry, delta) =>
      (kind === 'from') === (delta === 1) ? moveAddress(kind, entry) : null,
    accepts: types => types.includes(DRAGGED_EMAILS_TYPE),
    onDrop: dataTransfer => {
      const dragged = readDraggedEmails(dataTransfer)
      if (dragged === null) return
      fetchEmailSenders(client, accountId, dragged.emailIds)
        .then(senders => {
          setDraft({
            ...latest.current,
            [kind]: mergeEntries(
              latest.current[kind],
              senders.map(sender => sender.email)
            )
          })
        })
        .catch((error: unknown) => {
          console.warn('[search] Cannot read the senders of the emails', error)
        })
    }
  })

  const handleText =
    (name: keyof TextFields) =>
    (event: { target: { value: string } }): void => {
      setFields(current => ({ ...current, [name]: event.target.value }))
    }

  const handleClear = (): void => {
    const cleared = { ...EMPTY_SEARCH_FILTER, sort: draft.sort }
    setDraft(cleared)
    setFields(toTextFields(cleared))
  }

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(withTextFields(draft, fields))
  }

  const handleClickOutside = (): void => {
    if (!isPickingRef.current) onClose()
  }

  // As tmail-flutter (`selectedMailBox`): the destination picker
  const pickFolder = (): void => {
    isPickingRef.current = true
    // The click picking a folder reaches the page after the picker resolved
    const endPicking = (): void => {
      window.setTimeout(() => {
        isPickingRef.current = false
      }, 0)
    }
    pickSearchScope(draft.scope)
      .then(picked => {
        endPicking()
        if (picked !== null) {
          setDraft(current => ({ ...current, scope: picked }))
        }
      })
      .catch((error: unknown) => {
        endPicking()
        console.warn('[search] Cannot pick the folder', error)
      })
  }

  const openRange = (opener: { focus: () => void } | null): void => {
    rangeOpenerRef.current = opener
    setIsRangeOpen(true)
  }

  const confirmRange = (range: DayRange): void => {
    setDraft(current => ({
      ...current,
      dateRange: 'custom',
      startDate: range.start,
      endDate: range.end
    }))
  }

  const titleId = `${id}-title`
  const range = customRange(draft)
  // As tmail-flutter (`showMultipleViewDateRangePicker`): it opens on the
  // range chosen, the quick ranges end today
  const rangeDialog = isRangeOpen ? (
    <DayRangeDialog
      initial={range}
      today={formatDay(new Date())}
      onConfirm={confirmRange}
      onExited={() => {
        setIsRangeOpen(false)
        rangeOpenerRef.current?.focus()
      }}
      testIdPrefix="advanced-search-range"
    />
  ) : null
  const isPhone = useScreenSize() === 'mobile'
  const clearButton = (
    <Button
      variant="text"
      size="large"
      className="u-flex-shrink-0"
      onClick={handleClear}
      data-testid="advanced-search-clear-button"
    >
      {t('search.clearFilter')}
    </Button>
  )
  const submitButton = (
    <Button
      type="submit"
      variant="contained"
      size="large"
      data-testid="advanced-search-submit-button"
    >
      {t('search.submit')}
    </Button>
  )

  const textRow = (
    name: keyof TextFields,
    label: string,
    placeholder: string,
    testId: string,
    autoFocus = false
  ): ReactElement => (
    <FormRow label={label} htmlFor={fieldId(name)}>
      <TextField
        id={fieldId(name)}
        variant="standard"
        fullWidth
        placeholder={placeholder}
        value={fields[name]}
        onChange={handleText(name)}
        autoFocus={autoFocus}
        slotProps={{ htmlInput: { 'data-testid': testId } }}
      />
    </FormRow>
  )

  const addressRow = (kind: AddressKind, label: string): ReactElement => (
    <FormRow label={label} htmlFor={fieldId(kind)}>
      <AddressFilterField
        label={label}
        inputId={fieldId(kind)}
        placeholder={t('search.hints.address')}
        values={draft[kind]}
        onChange={values => {
          setDraft(current => ({ ...current, [kind]: values }))
        }}
        dnd={dndOf(kind)}
        autoFocus={kind === 'from'}
        field={kind}
      />
    </FormRow>
  )

  const rows = (
    <Box className="u-flex u-flex-column">
      {addressRow('from', t('search.fields.from'))}
      {addressRow('to', t('search.fields.to'))}
      {textRow(
        'subject',
        t('search.fields.subject'),
        t('search.hints.subject'),
        'advanced-search-subject-input'
      )}
      {textRow(
        'text',
        t('search.fields.text'),
        t('search.hints.words'),
        'advanced-search-text-input'
      )}
      {textRow(
        'notWords',
        t('search.fields.notWords'),
        t('search.wordsHint'),
        'advanced-search-not-words-input'
      )}
      <FormRow label={t('search.fields.folder')} id={fieldId('folder-label')}>
        {/* Never opens its own menu: opening it asks for the picker */}
        <TextField
          select
          fullWidth
          size="small"
          value={scopeLabelOf(draft.scope)}
          slotProps={{
            select: {
              open: false,
              onOpen: pickFolder,
              labelId: fieldId('folder-label'),
              displayEmpty: true,
              renderValue: () => scopeLabelOf(draft.scope),
              SelectDisplayProps: {
                id: fieldId('folder'),
                // Named "Folder" then the folder chosen
                'aria-labelledby': `${fieldId('folder-label')} ${fieldId('folder')}`,
                'aria-haspopup': 'dialog',
                'data-testid': 'advanced-search-folder-select'
              } as Record<string, string>
            }
          }}
        >
          <MenuItem value={scopeLabelOf(draft.scope)}>
            {scopeLabelOf(draft.scope)}
          </MenuItem>
        </TextField>
      </FormRow>
      {labels.length > 0 ? (
        <FormRow label={t('search.labels.label')} id={fieldId('label')}>
          <TextField
            select
            fullWidth
            size="small"
            value={draft.label ?? ALL_LABELS}
            onChange={event => {
              const value = event.target.value
              setDraft(current => ({
                ...current,
                label: value === ALL_LABELS ? null : value
              }))
            }}
            slotProps={{
              select: {
                labelId: fieldId('label'),
                SelectDisplayProps: {
                  'data-testid': 'advanced-search-label-select'
                } as Record<string, string>
              }
            }}
          >
            <MenuItem value={ALL_LABELS}>{t('search.labels.all')}</MenuItem>
            {/* A keyword no label has (e.g. a deleted one) still filters */}
            {draft.label !== null &&
            !labels.some(label => label.keyword === draft.label) ? (
              <MenuItem value={draft.label}>
                {t('search.labels.unknown')}
              </MenuItem>
            ) : null}
            {labels.map(label => (
              <MenuItem key={label.keyword} value={label.keyword}>
                {labelDisplayName(label, t)}
              </MenuItem>
            ))}
          </TextField>
        </FormRow>
      ) : null}
      <FormRow label={t('search.fields.date')} id={fieldId('date')}>
        {/* As tmail-flutter's `DefaultDateDropDownFieldWidget`: the list,
            and 8 px after it the calendar opening the range picker */}
        <Box className="u-flex u-flex-items-center">
          <TextField
            select
            fullWidth
            size="small"
            value={draft.dateRange}
            inputRef={dateRef}
            slotProps={{
              select: {
                labelId: fieldId('date'),
                renderValue: () =>
                  range === null
                    ? t(DATE_LABELS[draft.dateRange])
                    : t('search.dates.range', {
                        startDate: formatDayText(range.start),
                        endDate: formatDayText(range.end)
                      }),
                SelectDisplayProps: {
                  'data-testid': 'advanced-search-date-select'
                } as Record<string, string>
              }
            }}
          >
            {DATE_RANGES.map(dateRange => (
              <MenuItem
                key={dateRange}
                value={dateRange}
                // On each pick: a custom range reopens when picked again
                onClick={() => {
                  if (dateRange === 'custom') {
                    openRange(dateRef.current)
                    return
                  }
                  setDraft(current => ({ ...current, dateRange }))
                }}
              >
                {t(DATE_LABELS[dateRange])}
              </MenuItem>
            ))}
          </TextField>
          <Box className="u-ml-half u-flex">
            <Tooltip title={t('dateRange.selectDate')}>
              <IconButton
                aria-label={t('dateRange.selectDate')}
                aria-haspopup="dialog"
                aria-describedby={fieldId('date')}
                onClick={() => {
                  // The dialog gives the focus back to the button by itself
                  openRange(null)
                }}
                data-testid="advanced-search-date-button"
              >
                <Icon icon={Calendar} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </FormRow>
      <FormRow label={t('search.fields.sort')} id={fieldId('sort')}>
        <TextField
          select
          fullWidth
          size="small"
          value={draft.sort}
          onChange={event => {
            const sort = SORT_ORDERS.find(order => order === event.target.value)
            if (sort !== undefined) {
              setDraft(current => ({ ...current, sort }))
            }
          }}
          slotProps={{
            select: {
              labelId: fieldId('sort'),
              SelectDisplayProps: {
                'data-testid': 'advanced-search-sort-select'
              } as Record<string, string>
            }
          }}
        >
          {SORT_ORDERS.map(order => (
            <MenuItem key={order} value={order}>
              {t(SORT_LABELS[order])}
            </MenuItem>
          ))}
        </TextField>
      </FormRow>
      <Box className="u-flex u-flex-wrap u-mt-1">
        {(
          [
            ['hasAttachment', 'search.filters.hasAttachment'],
            ['unread', 'search.filters.unread'],
            ['starred', 'search.filters.starred'],
            ['notIncludeEvents', 'search.filters.notIncludeEvents']
          ] as const
        ).map(([name, label]) => (
          <LabeledCheckbox
            key={name}
            label={t(label)}
            checked={draft[name]}
            onChange={checked => {
              setDraft({ ...draft, [name]: checked })
            }}
          />
        ))}
      </Box>
    </Box>
  )

  if (!isPhone) {
    return (
      <AnchoredDialog
        open
        anchorEl={anchorEl}
        onClose={handleClickOutside}
        title={t('search.advanced')}
        data-testid="advanced-search-dialog"
      >
        {/* tmail-flutter: 24 px above and below, 32 px on the sides */}
        <form onSubmit={handleSubmit} noValidate className="u-pv-1-half u-ph-2">
          {rows}
          <Box className="u-flex u-flex-justify-end u-flex-items-center u-mt-1-half">
            {clearButton}
            <Box className="u-ml-half">{submitButton}</Box>
          </Box>
        </form>
        {/* Out of the form (its own would submit this one), in the card
            (a click in it is no click outside) */}
        {rangeDialog}
      </AnchoredDialog>
    )
  }

  return (
    <Dialog
      open
      size="medium"
      onClose={onClose}
      aria-labelledby={titleId}
      data-testid="advanced-search-dialog"
    >
      {/* A flex column that does not grow past the dialog: only the fields
          scroll, the title and the buttons stay in view */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="u-flex u-flex-column u-ov-hidden"
      >
        {/* Three buttons do not fit under a phone screen: "Clear filter"
            goes up beside the title, out of its accessible name */}
        <Box className="u-flex u-flex-items-center u-pr-1">
          {/* DialogTitle does not shrink (flex: 0 0 auto) */}
          <Box className="u-flex-auto">
            <DialogTitle id={titleId}>{t('search.advanced')}</DialogTitle>
          </Box>
          {clearButton}
        </Box>
        <DialogContent>{rows}</DialogContent>
        <DialogActions>
          {/* Full screen on a phone: no backdrop nor Escape key to close it */}
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            data-testid="advanced-search-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          {submitButton}
        </DialogActions>
      </form>
      {rangeDialog}
    </Dialog>
  )
}
