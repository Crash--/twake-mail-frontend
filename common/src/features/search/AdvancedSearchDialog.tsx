import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField
} from '@linagora/twake-mui'
import { useState, type FormEvent, type ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useLabels, useLabelsAvailable } from '@common/features/labels/queries'
import { useI18n } from '@common/i18n/useI18n'

import {
  DATE_RANGES,
  EMPTY_SEARCH_FILTER,
  SORT_ORDERS,
  splitWords,
  type SearchFilter
} from './searchFilter'
import { DATE_LABELS, SORT_LABELS } from './searchLabels'
import { useMailboxOptions } from './useMailboxOptions'

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
  from: string
  to: string
  subject: string
  text: string
  notWords: string
}

function toTextFields(filter: SearchFilter): TextFields {
  return {
    from: filter.from.join(', '),
    to: filter.to.join(', '),
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
    from: splitWords(fields.from),
    to: splitWords(fields.to),
    subject: fields.subject.trim(),
    text: fields.text.trim(),
    notWords: splitWords(fields.notWords)
  }
}

export interface AdvancedSearchDialogProps {
  /** The search being typed, quick filters included */
  filter: SearchFilter
  onClose: () => void
  /** Runs the search of the form */
  onSubmit: (filter: SearchFilter) => void
}

/**
 * The advanced search of tmail-flutter: from, to, subject, words the email
 * has and has not, folder, date, order, and the attachment, unread and
 * starred filters. It opens on the search being typed (the quick filters
 * picked under the field are checked here) and runs it on submit; "Clear
 * filter" empties it, the order excepted, "Cancel" leaves it unchanged.
 */
export function AdvancedSearchDialog({
  filter,
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(withTextFields(draft, fields))
  }

  const titleId = 'advanced-search-title'
  const isPhone = useScreenSize() === 'mobile'
  const clearButton = (
    <Button
      variant="text"
      className="u-flex-shrink-0"
      onClick={handleClear}
      data-testid="advanced-search-clear-button"
    >
      {t('search.clearFilter')}
    </Button>
  )

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
        {isPhone ? (
          // Three buttons do not fit under a phone screen: "Clear filter"
          // goes up beside the title, out of its accessible name
          <Box className="u-flex u-flex-items-center u-pr-1">
            {/* DialogTitle does not shrink (flex: 0 0 auto) */}
            <Box className="u-flex-auto">
              <DialogTitle id={titleId}>{t('search.advanced')}</DialogTitle>
            </Box>
            {clearButton}
          </Box>
        ) : (
          <DialogTitle id={titleId}>{t('search.advanced')}</DialogTitle>
        )}
        <DialogContent>
          <Box className="u-flex u-flex-column u-pt-half">
            <TextField
              label={t('search.fields.from')}
              placeholder={t('search.hints.address')}
              value={fields.from}
              onChange={handleText('from')}
              margin="dense"
              autoFocus
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-from-input' }
              }}
            />
            <TextField
              label={t('search.fields.to')}
              placeholder={t('search.hints.address')}
              value={fields.to}
              onChange={handleText('to')}
              margin="dense"
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-to-input' }
              }}
            />
            <TextField
              label={t('search.fields.subject')}
              placeholder={t('search.hints.subject')}
              value={fields.subject}
              onChange={handleText('subject')}
              margin="dense"
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-subject-input' }
              }}
            />
            <TextField
              label={t('search.fields.text')}
              placeholder={t('search.hints.words')}
              value={fields.text}
              onChange={handleText('text')}
              margin="dense"
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-text-input' }
              }}
            />
            <TextField
              label={t('search.fields.notWords')}
              placeholder={t('search.wordsHint')}
              value={fields.notWords}
              onChange={handleText('notWords')}
              margin="dense"
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-not-words-input' }
              }}
            />
            <TextField
              select
              label={t('search.fields.folder')}
              value={scopeValue(draft)}
              onChange={event => {
                setDraft({ ...draft, scope: toScope(event.target.value) })
              }}
              margin="dense"
              slotProps={{
                select: { native: true },
                // A native select always shows a value, even the empty one
                // of the default folder: the label stays above it
                inputLabel: { shrink: true },
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
            {labels.length > 0 ? (
              <TextField
                select
                label={t('search.labels.label')}
                value={draft.label ?? ''}
                onChange={event => {
                  setDraft({
                    ...draft,
                    label: event.target.value === '' ? null : event.target.value
                  })
                }}
                margin="dense"
                slotProps={{
                  select: { native: true },
                  inputLabel: { shrink: true },
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
            ) : null}
            <TextField
              select
              label={t('search.fields.date')}
              value={draft.dateRange}
              onChange={event => {
                const dateRange =
                  DATE_RANGES.find(range => range === event.target.value) ??
                  'allTime'
                setDraft({ ...draft, dateRange })
              }}
              margin="dense"
              slotProps={{
                select: { native: true },
                // A native select always shows a value, even the empty one
                // of the default folder: the label stays above it
                inputLabel: { shrink: true },
                htmlInput: { 'data-testid': 'advanced-search-date-select' }
              }}
            >
              {DATE_RANGES.map(range => (
                <option key={range} value={range}>
                  {t(DATE_LABELS[range])}
                </option>
              ))}
            </TextField>
            {draft.dateRange === 'custom' ? (
              <Box className="u-flex u-flex-wrap">
                <TextField
                  type="date"
                  label={t('search.fields.startDate')}
                  value={draft.startDate ?? ''}
                  onChange={event => {
                    setDraft({
                      ...draft,
                      startDate: event.target.value || null
                    })
                  }}
                  margin="dense"
                  className="u-mr-1"
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: {
                      'data-testid': 'advanced-search-start-date-input'
                    }
                  }}
                />
                <TextField
                  type="date"
                  label={t('search.fields.endDate')}
                  value={draft.endDate ?? ''}
                  onChange={event => {
                    setDraft({ ...draft, endDate: event.target.value || null })
                  }}
                  margin="dense"
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: {
                      'data-testid': 'advanced-search-end-date-input'
                    }
                  }}
                />
              </Box>
            ) : null}
            <TextField
              select
              label={t('search.fields.sort')}
              value={draft.sort}
              onChange={event => {
                const sort =
                  SORT_ORDERS.find(order => order === event.target.value) ??
                  draft.sort
                setDraft({ ...draft, sort })
              }}
              margin="dense"
              slotProps={{
                select: { native: true },
                // A native select always shows a value, even the empty one
                // of the default folder: the label stays above it
                inputLabel: { shrink: true },
                htmlInput: { 'data-testid': 'advanced-search-sort-select' }
              }}
            >
              {SORT_ORDERS.map(order => (
                <option key={order} value={order}>
                  {t(SORT_LABELS[order])}
                </option>
              ))}
            </TextField>
            <FormControlLabel
              label={t('search.filters.hasAttachment')}
              control={
                <Checkbox
                  checked={draft.hasAttachment}
                  onChange={event => {
                    setDraft({ ...draft, hasAttachment: event.target.checked })
                  }}
                />
              }
            />
            <FormControlLabel
              label={t('search.filters.unread')}
              control={
                <Checkbox
                  checked={draft.unread}
                  onChange={event => {
                    setDraft({ ...draft, unread: event.target.checked })
                  }}
                />
              }
            />
            <FormControlLabel
              label={t('search.filters.starred')}
              control={
                <Checkbox
                  checked={draft.starred}
                  onChange={event => {
                    setDraft({ ...draft, starred: event.target.checked })
                  }}
                />
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          {isPhone ? null : clearButton}
          {/* Full screen on a phone: no backdrop nor Escape key to close it */}
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            data-testid="advanced-search-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            data-testid="advanced-search-submit-button"
          >
            {t('search.submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
