import { Filter, Icon, Plus } from '@linagora/twake-icons'
import { Alert, Button, Empty, List, ListSkeleton } from '@linagora/twake-mui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Rule } from 'jmap-client-ts/linagora'
import { useEffect, useState, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { ruleKeys, rulesQueryOptions, saveRules } from './queries'
import { RuleFormDialog } from './RuleFormDialog'
import { useAddRule } from './useAddRule'
import { RuleListItem } from './RuleListItem'
import { newRuleDraft, type RuleDraft } from './rules'

/** Location state opening the creator on a rule for an address */
export interface NewRuleLocationState {
  newRuleFrom: string
}

function readNewRuleFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const { newRuleFrom } = state as Partial<NewRuleLocationState>
  return typeof newRuleFrom === 'string' ? newRuleFrom : null
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
 * tmail-flutter does. "Create a rule with this email" of an address opens
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

  const handleDelete = (index: number): void => {
    const rule = rules[index]
    if (!rule) return
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
    }
    run().catch((error: unknown) => {
      console.error('[rules] Cannot delete the rule', error)
      notify({ message: t('rules.errors.delete'), severity: 'error' })
    })
  }

  const openCreator = (): void => {
    setForm({ index: null, draft: newRuleDraft() })
  }

  return (
    <SettingsSectionLayout
      section={section}
      actions={
        rules.length > 0 ? (
          <Button
            variant="contained"
            startIcon={<Icon icon={Plus} />}
            onClick={openCreator}
            data-testid="add-rule-button"
          >
            {t('rules.add')}
          </Button>
        ) : null
      }
    >
      {query.isPending ? (
        <ListSkeleton count={3} />
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
        <Empty
          icon={Filter}
          title={t('rules.empty.title')}
          // The text of `Empty` lacks contrast (docs/twake-mui-gaps.md)
          text={<SecondaryText>{t('rules.empty.message')}</SecondaryText>}
          data-testid="email-rules-empty"
        >
          <Button
            variant="contained"
            startIcon={<Icon icon={Plus} />}
            onClick={openCreator}
            data-testid="add-rule-button"
          >
            {t('rules.empty.action')}
          </Button>
        </Empty>
      ) : (
        <List aria-label={t('rules.listLabel')} data-testid="email-rule-list">
          {rules.map((rule, index) => (
            <RuleListItem
              // Rules have no id: their position is theirs
              key={index}
              rule={rule}
              onEdit={() => {
                setForm({ index, draft: null })
              }}
              onDelete={() => {
                handleDelete(index)
              }}
            />
          ))}
        </List>
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
