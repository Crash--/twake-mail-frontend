import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
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
import { FormRow } from '@/ds/FormRow/FormRow'
import { LabeledCheckbox } from '@/ds/LabeledCheckbox/LabeledCheckbox'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { RecipientFieldDnd } from '@/ds/RecipientField/RecipientField'
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
  isReversedDateRange,
  SORT_ORDERS,
  splitWords,
  type SearchFilter
} from './searchFilter'
import { DATE_LABELS, SORT_LABELS } from './searchLabels'
import { useMailboxOptions } from './useMailboxOptions'

type AddressKind = 'from' | 'to'

/** `<select>` values of the scope: default, everywhere, or a mailbox id */
const SCOPE_DEFAULT = ''
const SCOPE_EVERYWHERE = '*'

function scopeValue(filter: SearchFilter): string {
  if (filter.scope.kind === 'mailbox') return filter.scope.mailboxId
  return filter.scope.kind === 'everywhere' ? SCOPE_EVERYWHERE : SCOPE_DEFAULT
}

function toScope(value: string): SearchFilter['scope'] {
  if (value === SCOPE_DEFAULT) return { kind: 'default' }
  if (value === SCOPE_EVERYWHERE) return { kind: 'everywhere' }
  return { kind: 'mailbox', mailboxId: value }
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
 * order excepted; Escape (and "Cancel" on a phone) leaves it unchanged. A
 * custom range ending before it starts is refused: the problem shows under
 * the end date, tied to it, and the focus goes there.
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
  const mailboxes = useMailboxOptions()
  const [draft, setDraft] = useState(filter)
  const [fields, setFields] = useState(() => toTextFields(filter))
  // The range problem shows once the user tried to search: typing a year
  // goes through earlier ones, it must not flash meanwhile
  const [isSubmitted, setIsSubmitted] = useState(false)
  const endDateRef = useRef<HTMLInputElement>(null)
  const isReversedRangeShown = isSubmitted && isReversedDateRange(draft)
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
  const moveAddress = (from: AddressKind, entry: string): void => {
    const to: AddressKind = from === 'from' ? 'to' : 'from'
    setDraft(current => ({
      ...current,
      [to]: mergeEntries(current[to], [entry]),
      [from]: current[from].filter(other => other !== entry)
    }))
  }
  const dndOf = (kind: AddressKind): RecipientFieldDnd => ({
    group: id,
    field: kind,
    onMoveIn: (from, entry) => {
      if (from === 'from' || from === 'to') moveAddress(from, entry)
    },
    onMoveBy: (entry, delta) => {
      if ((kind === 'from') !== (delta === 1)) return null
      moveAddress(kind, entry)
      return t('composer.recipients.moved', {
        address: entry,
        field: t(kind === 'from' ? 'search.fields.to' : 'search.fields.from')
      })
    },
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
    setIsSubmitted(true)
    if (isReversedDateRange(draft)) {
      endDateRef.current?.focus()
      return
    }
    onSubmit(withTextFields(draft, fields))
  }

  const titleId = `${id}-title`
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
      <FormRow label={t('search.fields.folder')} htmlFor={fieldId('folder')}>
        <TextField
          select
          id={fieldId('folder')}
          variant="standard"
          fullWidth
          value={scopeValue(draft)}
          onChange={event => {
            setDraft({ ...draft, scope: toScope(event.target.value) })
          }}
          slotProps={{
            select: { native: true },
            htmlInput: { 'data-testid': 'advanced-search-folder-select' }
          }}
        >
          <option value={SCOPE_DEFAULT}>{t('search.scope.default')}</option>
          <option value={SCOPE_EVERYWHERE}>
            {t('search.scope.everywhere')}
          </option>
          {mailboxes.map(mailbox => (
            <option key={mailbox.id} value={mailbox.id}>
              {mailbox.label}
            </option>
          ))}
        </TextField>
      </FormRow>
      {labels.length > 0 ? (
        <FormRow label={t('search.labels.label')} htmlFor={fieldId('label')}>
          <TextField
            select
            id={fieldId('label')}
            variant="standard"
            fullWidth
            value={draft.label ?? ''}
            onChange={event => {
              setDraft({
                ...draft,
                label: event.target.value === '' ? null : event.target.value
              })
            }}
            slotProps={{
              select: { native: true },
              htmlInput: { 'data-testid': 'advanced-search-label-select' }
            }}
          >
            <option value="">{t('search.labels.all')}</option>
            {labels.map(label => (
              <option key={label.id} value={label.keyword}>
                {label.displayName}
              </option>
            ))}
          </TextField>
        </FormRow>
      ) : null}
      <FormRow label={t('search.fields.date')} htmlFor={fieldId('date')}>
        <TextField
          select
          id={fieldId('date')}
          variant="standard"
          fullWidth
          value={draft.dateRange}
          onChange={event => {
            const dateRange =
              DATE_RANGES.find(range => range === event.target.value) ??
              'allTime'
            setDraft({ ...draft, dateRange })
          }}
          slotProps={{
            select: { native: true },
            htmlInput: { 'data-testid': 'advanced-search-date-select' }
          }}
        >
          {DATE_RANGES.map(range => (
            <option key={range} value={range}>
              {t(DATE_LABELS[range])}
            </option>
          ))}
        </TextField>
      </FormRow>
      {draft.dateRange === 'custom' ? (
        <>
          <FormRow
            label={t('search.fields.startDate')}
            htmlFor={fieldId('start')}
          >
            <TextField
              id={fieldId('start')}
              type="date"
              variant="standard"
              fullWidth
              value={draft.startDate ?? ''}
              onChange={event => {
                setDraft({ ...draft, startDate: event.target.value || null })
              }}
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-start-date-input' }
              }}
            />
          </FormRow>
          <FormRow label={t('search.fields.endDate')} htmlFor={fieldId('end')}>
            <TextField
              id={fieldId('end')}
              inputRef={endDateRef}
              type="date"
              variant="standard"
              fullWidth
              value={draft.endDate ?? ''}
              onChange={event => {
                setDraft({ ...draft, endDate: event.target.value || null })
              }}
              error={isReversedRangeShown}
              helperText={
                isReversedRangeShown ? t('search.errors.endBeforeStart') : null
              }
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-end-date-input' }
              }}
            />
          </FormRow>
        </>
      ) : null}
      <FormRow label={t('search.fields.sort')} htmlFor={fieldId('sort')}>
        <TextField
          select
          id={fieldId('sort')}
          variant="standard"
          fullWidth
          value={draft.sort}
          onChange={event => {
            const sort =
              SORT_ORDERS.find(order => order === event.target.value) ??
              draft.sort
            setDraft({ ...draft, sort })
          }}
          slotProps={{
            select: { native: true },
            htmlInput: { 'data-testid': 'advanced-search-sort-select' }
          }}
        >
          {SORT_ORDERS.map(order => (
            <option key={order} value={order}>
              {t(SORT_LABELS[order])}
            </option>
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
        onClose={onClose}
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
    </Dialog>
  )
}
