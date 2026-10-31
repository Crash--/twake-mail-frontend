import { Plus } from '@linagora/twake-icons'
import { Alert, Button } from '@linagora/twake-mui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Rule } from 'jmap-client-ts/linagora'
import { useEffect, useState, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { NoRules } from '@/ds/FlutterIcons/FlutterIcons'
import { SettingsPrimaryButton } from '@/ds/SettingsButtons/SettingsButtons'
import { SettingsCardList } from '@/ds/SettingsCards/SettingsCards'
import { SettingsEmptyState } from '@/ds/SettingsEmptyState/SettingsEmptyState'
import { SettingsCount } from '@/ds/SettingsFields/SettingsFields'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import {
  focusTargetsAround,
  keepFocusInPage
} from '@common/utils/keepFocusInPage'

import { ruleKeys, rulesQueryOptions, saveRules } from './queries'
import { RuleFormDialog } from './RuleFormDialog'
import { useAddRule } from './useAddRule'
import { RuleListItem } from './RuleListItem'
import { moveRule, newRuleDraft, type RuleDraft } from './rules'

/** Location state opening the creator on a rule for an address */
export interface NewRuleLocationState {
  newRuleFrom: string
}

function readNewRuleFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const { newRuleFrom } = state as Partial<NewRuleLocationState>
  return typeof newRuleFrom === 'string' ? newRuleFrom : null
}

/** The move buttons of a rule card, the one a move came from first */
const MOVE_BUTTONS = {
  up: [
    'email-rule-move-up-button',
    'email-rule-move-down-button',
    'email-rule-more-button'
  ],
  down: [
    'email-rule-move-down-button',
    'email-rule-move-up-button',
    'email-rule-more-button'
  ]
} as const

/** How long a moved rule keeps the focus from what its menu gives it back */
const MOVE_FOCUS_MS = 500

/**
 * Gives the focus to the card of `list` at `to` once it is drawn: its move
 * button the same way, else the other way (the moved rule is now first or
 * last), else "More" (a phone). For a while, it takes it back when the
 * focus falls on the body or in the card at `from` (the sheet of a phone
 * gives it back to the "More" it was opened from).
 */
function focusMovedRule(
  list: Element | null,
  from: number,
  to: number,
  direction: keyof typeof MOVE_BUTTONS
): void {
  const deadline = performance.now() + MOVE_FOCUS_MS
  const focus = (): void => {
    const card = list?.children.item(to) ?? null
    const button = MOVE_BUTTONS[direction]
      .map(testId =>
        card?.querySelector<HTMLButtonElement>(
          `button[data-testid="${testId}"]:not(:disabled)`
        )
      )
      .find(candidate => candidate !== null && candidate !== undefined)
    const active = document.activeElement
    const isElsewhere =
      active === null ||
      active === document.body ||
      list?.children.item(from)?.contains(active) === true
    if (isElsewhere) button?.focus()
    if (performance.now() < deadline) requestAnimationFrame(focus)
  }
  requestAnimationFrame(focus)
}

/** The creator: closed, a new rule (with its draft) or the rule at `index` */
type FormState =
  { index: null; draft: RuleDraft } | { index: number; draft: null } | null

export interface EmailRulesSettingsProps {
  section: SettingsSection
}

/**
 * Settings > Email rules: the filtering rules (`Filter/get`, `Filter/set`
 * of the whole list), created at the top, edited and deleted in place, as
 * tmail-flutter does, and moved up or down (the first matching rule wins). "Create a rule with this email" of an address opens
 * the creator here (`newRuleFrom` in the location state).
 */
export function EmailRulesSettings({
  section
}: EmailRulesSettingsProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId } = useJmapSession()
  const { notify } = useNotify()
  const confirm = useConfirm()
  const addRule = useAddRule()
  const location = useLocation()
  const navigate = useNavigate()
  const query = useQuery(rulesQueryOptions(client, accountId))
  const rules = query.data ?? []
  const [form, setForm] = useState<FormState>(null)
  const newRuleFrom = readNewRuleFrom(location.state)
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (newRuleFrom !== null && openedFor !== location.key) {
    setOpenedFor(location.key)
    setForm({ index: null, draft: newRuleDraft(newRuleFrom) })
  }

  useEffect(() => {
    // Once: a reload or going back does not open the creator again
    if (newRuleFrom !== null) {
      void navigate(location.pathname, { replace: true, state: null })
    }
  }, [newRuleFrom, navigate, location.pathname])

  const save = async (next: readonly Rule[]): Promise<boolean> => {
    const isSaved = await saveRules(client, accountId, next)
    await queryClient.invalidateQueries({ queryKey: ruleKeys.all(accountId) })
    return isSaved
  }

  const handleSubmit = async (rule: Rule): Promise<boolean> => {
    if (form === null) return false
    if (form.index === null) {
      const isAdded = await addRule(rule)
      if (isAdded) setForm(null)
      return isAdded
    }
    const next = rules.map((other, index) =>
      index === form.index ? rule : other
    )
    const isSaved = await save(next)
    if (isSaved) {
      notify({ message: t('rules.toasts.updated'), severity: 'success' })
      setForm(null)
    }
    return isSaved
  }

  const handleDelete = (index: number, opener: HTMLElement): void => {
    const rule = rules[index]
    if (!rule) return
    const focusTargets = focusTargetsAround(opener)
    const run = async (): Promise<void> => {
      const isConfirmed = await confirm({
        title: t('rules.delete.title'),
        message: t('rules.delete.message', { ruleName: rule.name }),
        confirmLabel: t('common.delete'),
        isDestructive: true
      })
      if (!isConfirmed) return
      const isSaved = await save(
        rules.filter((_rule, other) => other !== index)
      )
      notify(
        isSaved
          ? { message: t('rules.toasts.deleted'), severity: 'success' }
          : { message: t('rules.errors.delete'), severity: 'error' }
      )
      if (isSaved) keepFocusInPage(focusTargets)
    }
    run().catch((error: unknown) => {
      console.error('[rules] Cannot delete the rule', error)
      notify({ message: t('rules.errors.delete'), severity: 'error' })
    })
  }

  const handleMove = (
    index: number,
    direction: keyof typeof MOVE_BUTTONS,
    opener: HTMLElement
  ): void => {
    const rule = rules[index]
    if (!rule) return
    const target = direction === 'up' ? index - 1 : index + 1
    const next = moveRule(rules, index, target)
    const list = opener.closest('ul')
    // At once: the server takes the whole list again (`Filter/set`)
    queryClient.setQueryData(ruleKeys.all(accountId), next)
    focusMovedRule(list, index, target, direction)
    save(next)
      .then(isSaved => {
        // A live region: the new place is announced
        notify(
          isSaved
            ? {
                message: t('rules.toasts.moved', {
                  name: rule.name,
                  position: target + 1,
                  count: next.length
                }),
                severity: 'success'
              }
            : { message: t('rules.errors.move'), severity: 'error' }
        )
        if (!isSaved) focusMovedRule(list, target, index, direction)
      })
      .catch((error: unknown) => {
        console.error('[rules] Cannot move the rule', error)
        notify({ message: t('rules.errors.move'), severity: 'error' })
      })
  }

  const openCreator = (): void => {
    setForm({ index: null, draft: newRuleDraft() })
  }

  return (
    <SettingsSectionLayout
      section={section}
      actions={
        // As tmail-flutter: there with or without rules
        <SettingsPrimaryButton
          label={t('rules.add')}
          icon={Plus}
          iconSize={12}
          onClick={openCreator}
          data-testid="add-rule-button"
        />
      }
    >
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
          {t('rules.errors.load')}
        </Alert>
      ) : rules.length === 0 ? (
        <>
          <SettingsCount label={t('rules.nameOfRules')} count={0} />
          <SettingsEmptyState
            icon={NoRules}
            title={t('rules.empty.title')}
            text={t('rules.empty.message')}
            action={{
              label: t('rules.empty.action'),
              icon: Plus,
              onClick: openCreator,
              'data-testid': 'create-first-rule-button'
            }}
            data-testid="email-rules-empty"
          />
        </>
      ) : (
        <>
          <SettingsCount label={t('rules.nameOfRules')} count={rules.length} />
          <SettingsCardList
            label={t('rules.listLabel')}
            data-testid="email-rule-list"
          >
            {rules.map((rule, index) => (
              <RuleListItem
                // Rules have no id: their position is theirs
                key={index}
                rule={rule}
                onEdit={() => {
                  setForm({ index, draft: null })
                }}
                onDelete={opener => {
                  handleDelete(index, opener)
                }}
                onMoveUp={
                  index === 0
                    ? null
                    : opener => {
                        handleMove(index, 'up', opener)
                      }
                }
                onMoveDown={
                  index === rules.length - 1
                    ? null
                    : opener => {
                        handleMove(index, 'down', opener)
                      }
                }
              />
            ))}
          </SettingsCardList>
        </>
      )}
      {form === null ? null : (
        <RuleFormDialog
          rule={form.index === null ? null : (rules[form.index] ?? null)}
          initialDraft={form.draft ?? newRuleDraft()}
          onSubmit={handleSubmit}
          onClose={() => {
            setForm(null)
          }}
        />
      )}
    </SettingsSectionLayout>
  )
}
