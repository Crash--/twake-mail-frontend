import {
  Account,
  Calendar,
  Forbidden,
  FolderOutlined,
  LabelOutlined,
  Magnifier,
  Text,
  Swap,
  type IconProps
} from '@linagora/twake-icons'
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
import { useId, useState, type SubmitEvent, type ReactElement } from 'react'

import { AnchoredDialog } from '@/ds/AnchoredDialog/AnchoredDialog'
import { FormRow } from '@/ds/FormRow/FormRow'
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
  const id = useId()
  const fieldId = (name: string): string => `${id}-${name}`

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

  const titleId = `${id}-title`
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
  const submitButton = (
    <Button
      type="submit"
      variant="contained"
      data-testid="advanced-search-submit-button"
    >
      {t('search.submit')}
    </Button>
  )

  const textRow = (
    name: keyof TextFields,
    label: string,
    placeholder: string,
    icon: IconProps['icon'],
    testId: string,
    autoFocus = false
  ): ReactElement => (
    <FormRow label={label} htmlFor={fieldId(name)} icon={icon}>
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

  const rows = (
    <Box className="u-flex u-flex-column">
      {textRow(
        'from',
        t('search.fields.from'),
        t('search.hints.address'),
        Account,
        'advanced-search-from-input',
        true
      )}
      {textRow(
        'to',
        t('search.fields.to'),
        t('search.hints.address'),
        Account,
        'advanced-search-to-input'
      )}
      {textRow(
        'subject',
        t('search.fields.subject'),
        t('search.hints.subject'),
        Text,
        'advanced-search-subject-input'
      )}
      {textRow(
        'text',
        t('search.fields.text'),
        t('search.hints.words'),
        Magnifier,
        'advanced-search-text-input'
      )}
      {textRow(
        'notWords',
        t('search.fields.notWords'),
        t('search.wordsHint'),
        Forbidden,
        'advanced-search-not-words-input'
      )}
      <FormRow
        label={t('search.fields.folder')}
        htmlFor={fieldId('folder')}
        icon={FolderOutlined}
      >
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
        <FormRow
          label={t('search.labels.label')}
          htmlFor={fieldId('label')}
          icon={LabelOutlined}
        >
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
      <FormRow
        label={t('search.fields.date')}
        htmlFor={fieldId('date')}
        icon={Calendar}
      >
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
              type="date"
              variant="standard"
              fullWidth
              value={draft.endDate ?? ''}
              onChange={event => {
                setDraft({ ...draft, endDate: event.target.value || null })
              }}
              slotProps={{
                htmlInput: { 'data-testid': 'advanced-search-end-date-input' }
              }}
            />
          </FormRow>
        </>
      ) : null}
      <FormRow
        label={t('search.fields.sort')}
        htmlFor={fieldId('sort')}
        icon={Swap}
      >
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
          <FormControlLabel
            key={name}
            label={t(label)}
            control={
              <Checkbox
                checked={draft[name]}
                onChange={event => {
                  setDraft({ ...draft, [name]: event.target.checked })
                }}
              />
            }
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
        <form onSubmit={handleSubmit} noValidate className="u-p-2">
          {rows}
          <Box className="u-flex u-flex-justify-end u-flex-items-center u-mt-1">
            {clearButton}
            <Box className="u-ml-1">{submitButton}</Box>
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
