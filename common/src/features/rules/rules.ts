import type {
  Rule,
  RuleAction,
  RuleCondition,
  RuleConditionComparator,
  RuleConditionField,
  RuleUpdate
} from 'jmap-client-ts/linagora'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import type { TranslationKey } from '@common/i18n/useI18n'

/** The fields tmail-flutter offers in a condition, in its order */
export const RULE_FIELDS: readonly RuleConditionField[] = [
  'from',
  'to',
  'cc',
  'recipient',
  'subject'
]

/** The comparators tmail-flutter offers, in its order */
export const RULE_COMPARATORS: readonly RuleConditionComparator[] = [
  'contains',
  'not-contains',
  'exactly-equals',
  'not-exactly-equals'
]

const FIELD_LABELS: Partial<Record<string, TranslationKey>> = {
  from: 'rules.fields.from',
  to: 'rules.fields.to',
  cc: 'rules.fields.cc',
  recipient: 'rules.fields.recipient',
  subject: 'rules.fields.subject'
}

const COMPARATOR_LABELS: Partial<Record<string, TranslationKey>> = {
  contains: 'rules.comparators.contains',
  'not-contains': 'rules.comparators.notContains',
  'exactly-equals': 'rules.comparators.exactlyEquals',
  'not-exactly-equals': 'rules.comparators.notExactlyEquals'
}

/** The label of a field, null for one tmail-flutter does not offer (`header:X`…) */
export function ruleFieldLabel(field: string): TranslationKey | null {
  return FIELD_LABELS[field] ?? null
}

export function ruleComparatorLabel(comparator: string): TranslationKey | null {
  return COMPARATOR_LABELS[comparator] ?? null
}

/**
 * The actions of the rule creator, as tmail-flutter offers them: move to a
 * folder, mark as seen, star (`markAsImportant`), reject, or mark as spam
 * (moved to the spam folder)
 */
export type RuleActionKind = 'move' | 'seen' | 'star' | 'reject' | 'spam'

export const RULE_ACTION_KINDS: readonly RuleActionKind[] = [
  'move',
  'seen',
  'star',
  'reject',
  'spam'
]

export const RULE_ACTION_LABELS: Record<RuleActionKind, TranslationKey> = {
  move: 'rules.actions.move',
  seen: 'rules.actions.seen',
  star: 'rules.actions.star',
  reject: 'rules.actions.reject',
  spam: 'rules.actions.spam'
}

/** An action row of the creator; `kind` null until one is picked */
export interface RuleActionDraft {
  kind: RuleActionKind | null
  /** The folder of `move` */
  mailboxId: string | null
}

export interface RuleDraft {
  name: string
  combiner: 'AND' | 'OR'
  conditions: RuleCondition[]
  actions: RuleActionDraft[]
}

export function emptyCondition(value = ''): RuleCondition {
  return { field: 'from', comparator: 'contains', value }
}

/**
 * A new rule; from an address, its condition is "From contains <address>";
 * for a folder, its action moves to it ("Mark as spam" for the Spam folder),
 * as tmail-flutter's rule creator opened from a folder menu
 */
export function newRuleDraft(
  fromAddress: string | null = null,
  folder: Pick<MailboxSummary, 'id' | 'role'> | null = null
): RuleDraft {
  const action: RuleActionDraft =
    folder === null
      ? { kind: null, mailboxId: null }
      : folder.role === 'junk'
        ? { kind: 'spam', mailboxId: null }
        : { kind: 'move', mailboxId: folder.id }
  return {
    name: '',
    combiner: 'AND',
    conditions: [emptyCondition(fromAddress ?? '')],
    actions: [action]
  }
}

/** The conditions of a rule, from its group or its legacy single condition */
export function ruleConditions(rule: Rule): RuleCondition[] {
  if (rule.conditionGroup.conditions.length > 0) {
    return rule.conditionGroup.conditions
  }
  return rule.condition ? [rule.condition] : []
}

/** The creator's view of a rule */
export function draftFromRule(rule: Rule, spamId: string | null): RuleDraft {
  const actions: RuleActionDraft[] = []
  const [folderId = null] = rule.action.appendIn.mailboxIds
  if (folderId !== null) {
    actions.push(
      folderId === spamId
        ? { kind: 'spam', mailboxId: null }
        : { kind: 'move', mailboxId: folderId }
    )
  }
  if (rule.action.markAsSeen === true)
    actions.push({ kind: 'seen', mailboxId: null })
  if (rule.action.markAsImportant === true) {
    actions.push({ kind: 'star', mailboxId: null })
  }
  if (rule.action.reject === true)
    actions.push({ kind: 'reject', mailboxId: null })
  return {
    name: rule.name,
    combiner: rule.conditionGroup.conditionCombiner,
    conditions: ruleConditions(rule).map(condition => ({ ...condition })),
    actions: actions.length > 0 ? actions : [{ kind: null, mailboxId: null }]
  }
}

/**
 * The rule a draft saves. What the creator does not show (keywords,
 * forwards, `moveTo` set by another client) is kept from `original`; a
 * rejected email gets no other action.
 */
export function ruleFromDraft(
  draft: RuleDraft,
  spamId: string | null,
  original: Rule | null = null
): Rule {
  const kinds = new Set(draft.actions.map(action => action.kind))
  const isRejected = kinds.has('reject')
  const move = draft.actions.find(action => action.kind === 'move')
  const mailboxIds = isRejected
    ? []
    : move?.mailboxId
      ? [move.mailboxId]
      : kinds.has('spam') && spamId !== null
        ? [spamId]
        : []
  const action: RuleAction = {
    ...original?.action,
    appendIn: { mailboxIds },
    markAsSeen: !isRejected && kinds.has('seen'),
    markAsImportant: !isRejected && kinds.has('star'),
    reject: isRejected
  }
  return {
    name: draft.name.trim(),
    conditionGroup: {
      conditionCombiner: draft.combiner,
      conditions: draft.conditions.map(condition => ({
        ...condition,
        value: condition.value.trim()
      }))
    },
    action
  }
}

/**
 * The rules as `Filter/set` takes them: each with an id (its position, as
 * tmail-flutter numbers them; `Filter/get` gives none) and its conditions
 * as a group, without the legacy single condition
 */
export function rulesForUpdate(rules: readonly Rule[]): RuleUpdate[] {
  return rules.map((rule, index) => ({
    id: String(index),
    name: rule.name,
    conditionGroup: rule.conditionGroup,
    action: rule.action
  }))
}

export type RuleProblem =
  | 'rules.errors.noCondition'
  | 'rules.errors.noAction'
  | 'rules.errors.noFolder'
  | 'rules.errors.noSpam'

/** What stops a draft from being saved, beyond its fields (tmail-flutter) */
export function ruleDraftProblem(
  draft: RuleDraft,
  spamId: string | null
): RuleProblem | null {
  if (draft.conditions.length === 0) return 'rules.errors.noCondition'
  const actions = draft.actions.filter(action => action.kind !== null)
  if (actions.length === 0) return 'rules.errors.noAction'
  if (actions.some(action => action.kind === 'move' && !action.mailboxId)) {
    return 'rules.errors.noFolder'
  }
  if (actions.some(action => action.kind === 'spam') && spamId === null) {
    return 'rules.errors.noSpam'
  }
  return null
}
