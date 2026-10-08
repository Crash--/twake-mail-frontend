import { ClockOutline, Icon, StarOutline } from '@linagora/twake-icons'
import { useMemo } from 'react'

import type {
  SearchComboboxGroup,
  SearchComboboxOption
} from '@/ds/SearchCombobox/SearchCombobox'
import { useAiNeedsActionEnabled } from '@common/features/ai/aiNeedsAction'
import { LabelIcon } from '@common/features/labels/LabelIcon'
import { labelPath } from '@common/features/labels/labelPaths'
import { useLabels, useLabelsAvailable } from '@common/features/labels/queries'
import { ACTION_REQUIRED_PATH } from '@common/features/mailbox/ActionRequiredTreeItem'
import { getMailboxIcon } from '@common/features/mailbox/mailboxDisplay'
import {
  isTeamRoot,
  teamMailboxAddress
} from '@common/features/mailbox/mailboxTree'
import {
  nameMatches,
  searchMailboxes
} from '@common/features/mailbox/searchMailboxes'
import { STARRED_PATH } from '@common/features/mailbox/StarredTreeItem'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useI18n } from '@common/i18n/useI18n'

/** An option that goes to a page: the path follows */
const GO_PREFIX = 'go:'

/** The page an option of `useDestinationOptions` goes to, else null */
export function destinationPath(optionId: string): string | null {
  return optionId.startsWith(GO_PREFIX)
    ? optionId.slice(GO_PREFIX.length)
    : null
}

/**
 * The pages whose name holds `text`, as options of a search: Starred, Action
 * required (when the deployment has it), the folders and team mailboxes as
 * the search of the sidebar finds them, then the labels.
 */
export function useDestinationOptions(text: string): SearchComboboxGroup[] {
  const { t } = useI18n()
  const getName = useMailboxName()
  const { data: mailboxes } = useMailboxes()
  // The cache keeps the labels the user has since hidden
  const { data } = useLabels()
  const labels = useLabelsAvailable() ? data : undefined
  const withActionRequired = useAiNeedsActionEnabled()

  return useMemo(() => {
    const views = [
      { path: STARRED_PATH, name: t('mailbox.starred'), icon: StarOutline },
      ...(withActionRequired
        ? [
            {
              path: ACTION_REQUIRED_PATH,
              name: t('mailbox.actionRequired'),
              icon: ClockOutline
            }
          ]
        : [])
    ].filter(view => nameMatches(view.name, text))
    const folders: SearchComboboxOption[] = [
      ...views.map(view => ({
        id: `${GO_PREFIX}${view.path}`,
        label: view.name,
        icon: <Icon icon={view.icon} className="u-flex-shrink-0" />,
        'data-testid': 'spotmail-folder'
      })),
      ...searchMailboxes(mailboxes ?? [], text, getName).map(
        ({ row: { mailbox }, path }) => ({
          id: `${GO_PREFIX}/mailbox/${encodeURIComponent(mailbox.id)}`,
          label: getName(mailbox),
          // The root of a team mailbox says its address
          secondary:
            path ??
            (isTeamRoot(mailbox) ? teamMailboxAddress(mailbox) : null) ??
            undefined,
          icon: (
            <Icon icon={getMailboxIcon(mailbox)} className="u-flex-shrink-0" />
          ),
          'data-testid': 'spotmail-folder'
        })
      )
    ]
    const labelOptions = (labels?.list ?? [])
      .filter(label => nameMatches(label.displayName, text))
      .map(label => ({
        id: `${GO_PREFIX}${labelPath(label.id)}`,
        label: label.displayName,
        icon: <LabelIcon color={label.color} />,
        'data-testid': 'spotmail-label'
      }))
    return [
      { id: 'folders', label: t('spotMail.folders'), options: folders },
      { id: 'labels', label: t('labels.title'), options: labelOptions }
    ]
  }, [t, text, mailboxes, labels, getName, withActionRequired])
}
