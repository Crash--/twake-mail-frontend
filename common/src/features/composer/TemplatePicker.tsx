import { Typography } from '@linagora/twake-mui'
import { useMemo, type ReactElement } from 'react'

import {
  FilterableListbox,
  type FilterableListboxOption
} from '@/ds/FilterableListbox/FilterableListbox'
import { Note } from '@/ds/FlutterIcons/FlutterIcons'
import { PickerSheet } from '@/ds/PickerSheet/PickerSheet'
import {
  isTeamTemplates,
  teamMailboxAddress
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import type { TemplateSummary } from '@common/features/templates/queries'
import { useTemplates } from '@common/features/templates/useTemplates'
import { useI18n } from '@common/i18n/useI18n'

import { listReadableTemplatesMailboxIds } from './templatesFolder'

export interface TemplatePickerProps {
  open: boolean
  onClose: () => void
  mailboxes: readonly MailboxSummary[]
  onPick: (template: TemplateSummary) => void
}

/**
 * "Insert template": the templates of the Templates folders (the user's and
 * the team mailboxes they read) in a filterable list, a sheet on phones, a
 * dialog elsewhere. Picking one hands it to `onPick`; what it does with the
 * message is up to the composer.
 */
export function TemplatePicker({
  open,
  onClose,
  mailboxes,
  onPick
}: TemplatePickerProps): ReactElement {
  const { t } = useI18n()
  const folderIds = useMemo(
    () => listReadableTemplatesMailboxIds(mailboxes),
    [mailboxes]
  )
  const templates = useTemplates(folderIds, open && folderIds.length > 0)
  const options = useMemo((): FilterableListboxOption[] => {
    const teamOf = new Map(
      mailboxes
        .filter(isTeamTemplates)
        .map(mailbox => [mailbox.id, teamMailboxAddress(mailbox)] as const)
    )
    return (templates.data ?? []).map(template => ({
      id: template.id,
      label:
        template.subject === ''
          ? t('composer.template.noSubject')
          : template.subject,
      secondary:
        [teamOf.get(template.mailboxId), template.preview]
          .filter(part => part !== undefined && part !== null && part !== '')
          .join(' · ') || null,
      icon: Note
    }))
  }, [templates.data, mailboxes, t])

  const handleSelect = (option: FilterableListboxOption): void => {
    const template = templates.data?.find(item => item.id === option.id)
    if (template) onPick(template)
  }
  const isEmpty = templates.data?.length === 0

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title={t('composer.template.pickerTitle')}
      closeLabel={t('common.close')}
      disableRestoreFocus
      data-testid="template-picker"
      closeButtonTestId="template-picker-close-button"
    >
      {templates.isError ? (
        <Typography role="alert" className="u-p-1">
          {t('common.errorOccurred')}
        </Typography>
      ) : templates.isPending && folderIds.length > 0 ? (
        <Typography role="status" className="u-p-1">
          {t('common.loading')}
        </Typography>
      ) : isEmpty || folderIds.length === 0 ? (
        <Typography
          role="status"
          className="u-p-1"
          data-testid="template-picker-none"
        >
          {t('composer.template.none')}
        </Typography>
      ) : (
        <FilterableListbox
          options={options}
          onSelect={handleSelect}
          filterLabel={t('composer.template.filter')}
          listLabel={t('composer.template.list')}
          emptyLabel={t('composer.template.empty')}
          resultsLabel={count =>
            t('composer.template.results', { smart_count: count })
          }
          testIds={{
            input: 'template-picker-search-input',
            listbox: 'template-picker-list',
            option: 'template-picker-item',
            results: 'template-picker-results'
          }}
        />
      )}
    </PickerSheet>
  )
}
