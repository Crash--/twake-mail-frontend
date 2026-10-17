import type {
  Rule,
  RuleAction,
  RuleCondition,
  RuleConditionComparator,
  RuleConditionField,
  RuleUpdate
} from 'jmap-client-ts/linagora'

import {
  isValidEmail,
  parseRecipients
} from '@common/features/composer/recipients'
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

/** What a `header:<name>` field starts with (the Linagora `Filter` extension) */
const HEADER_PREFIX = 'header:'

/**
 * The choices of the field select: the fields of tmail-flutter, then any
 * other header (`header:<name>`, its name typed beside it)
 */
export type RuleFieldChoice = RuleConditionField | 'header'

export const RULE_FIELD_CHOICES: readonly RuleFieldChoice[] = [
  ...RULE_FIELDS,
  'header'
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
  subject: 'rules.fields.subject',
  header: 'rules.fields.header'
}

const COMPARATOR_LABELS: Partial<Record<string, TranslationKey>> = {
  contains: 'rules.comparators.contains',
  'not-contains': 'rules.comparators.notContains',
  'exactly-equals': 'rules.comparators.exactlyEquals',
  'not-exactly-equals': 'rules.comparators.notExactlyEquals'
}

/** The header a `header:<name>` field tests, null for another field */
export function ruleHeaderName(field: string): string | null {
  return field.startsWith(HEADER_PREFIX)
    ? field.slice(HEADER_PREFIX.length)
    : null
}

/** The field testing the header `name` */
export function headerField(name: string): RuleConditionField {
  return `${HEADER_PREFIX}${name}`
}

/** The choice of the field select showing `field`; null for an unknown one */
export function ruleFieldChoice(field: string): RuleFieldChoice | null {
  if (ruleHeaderName(field) !== null) return 'header'
  return RULE_FIELDS.find(known => known === field) ?? null
}

/** The label of a field, null for one the creator does not offer (`sentDate`…) */
export function ruleFieldLabel(field: string): TranslationKey | null {
  return FIELD_LABELS[ruleFieldChoice(field) ?? field] ?? null
}

/**
 * A field in words: its label ("From"), followed by the header name for a
 * header ("Header List-Id"), the field itself when the creator does not
 * offer it
 */
export function ruleFieldText(
  field: string,
  t: (key: TranslationKey) => string
): string {
  const label = ruleFieldLabel(field)
  if (label === null) return field
  const header = ruleHeaderName(field)
  return header === null ? t(label) : `${t(label)} ${header}`
}

export function ruleComparatorLabel(comparator: string): TranslationKey | null {
  return COMPARATOR_LABELS[comparator] ?? null
}

/**
 * A header name as RFC 5322 defines it (`field-name`): printable US-ASCII
 * characters, the colon and the space excepted
 */
const HEADER_NAME = /^[\x21-\x39\x3b-\x7e]+$/

export function isValidHeaderName(name: string): boolean {
  return HEADER_NAME.test(name)
}

/** What is wrong with the header name of a condition, null when none */
export function headerNameProblem(
  condition: RuleCondition
): 'rules.errors.noHeaderName' | 'rules.errors.invalidHeaderName' | null {
  const header = ruleHeaderName(condition.field)
  if (header === null) return null
  const name = header.trim()
  if (name === '') return 'rules.errors.noHeaderName'
  return isValidHeaderName(name) ? null : 'rules.errors.invalidHeaderName'
}

/**
 * The rules with the one at `from` moved to `to` (the first matching rule
 * wins: the order matters); the same rules when either is out of the list
 */
export function moveRule<T>(
  rules: readonly T[],
  from: number,
  to: number
): T[] {
  const moved = rules[from]
  if (moved === undefined || to < 0 || to >= rules.length) return [...rules]
  const others = rules.filter((_rule, index) => index !== from)
  return [...others.slice(0, to), moved, ...others.slice(to)]
}

/**
 * The actions of the rule creator, as tmail-flutter defines them: move to a
 * folder, mark as seen, star (`markAsImportant`), reject, mark as spam
 * (moved to the spam folder), or forward to addresses (`forwardTo`, which
 * tmail-flutter hides but James applies)
 */
export type RuleActionKind =
  'move' | 'seen' | 'star' | 'reject' | 'spam' | 'forward'

export const RULE_ACTION_KINDS: readonly RuleActionKind[] = [
  'move',
  'seen',
  'star',
  'reject',
  'spam',
  'forward'
]

export const RULE_ACTION_LABELS: Record<RuleActionKind, TranslationKey> = {
  move: 'rules.actions.move',
  seen: 'rules.actions.seen',
  star: 'rules.actions.star',
  reject: 'rules.actions.reject',
  spam: 'rules.actions.spam',
  forward: 'rules.actions.forward'
}

/** An action row of the creator; `kind` null until one is picked */
export interface RuleActionDraft {
  kind: RuleActionKind | null
  /** The folder of `move` */
  mailboxId: string | null
  /** The addresses of `forward`, as typed (separated by commas) */
  forwardAddresses: string
  /** Whether `forward` also keeps the email for the user */
  keepACopy: boolean
}

export function actionDraft(
  kind: RuleActionKind | null = null,
  change: Partial<Omit<RuleActionDraft, 'kind'>> = {}
): RuleActionDraft {
  return {
    kind,
    mailboxId: null,
    forwardAddresses: '',
    keepACopy: true,
    ...change
  }
}

/** The addresses of a `forward` action, invalid ones included */
export function forwardAddresses(action: RuleActionDraft): string[] {
  return parseRecipients(action.forwardAddresses).map(
    recipient => recipient.email
  )
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
      ? actionDraft()
      : folder.role === 'junk'
        ? actionDraft('spam')
        : actionDraft('move', { mailboxId: folder.id })
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
        ? actionDraft('spam')
        : actionDraft('move', { mailboxId: folderId })
    )
  }
  if (rule.action.markAsSeen === true) actions.push(actionDraft('seen'))
  if (rule.action.markAsImportant === true) actions.push(actionDraft('star'))
  if (rule.action.reject === true) actions.push(actionDraft('reject'))
  const forward = rule.action.forwardTo
  if (forward && forward.addresses.length > 0) {
    actions.push(
      actionDraft('forward', {
        forwardAddresses: forward.addresses.join(', '),
        keepACopy: forward.keepACopy
      })
    )
  }
  return {
    name: rule.name,
    combiner: rule.conditionGroup.conditionCombiner,
    conditions: ruleConditions(rule).map(condition => ({ ...condition })),
    actions: actions.length > 0 ? actions : [actionDraft()]
  }
}

/**
 * The rule a draft saves. What the creator does not show (keywords,
 * `moveTo` set by another client) is kept from `original`; a rejected email
 * gets no other action.
 */
export function ruleFromDraft(
  draft: RuleDraft,
  spamId: string | null,
  original: Rule | null = null
): Rule {
  const kinds = new Set(draft.actions.map(action => action.kind))
  const isRejected = kinds.has('reject')
  const move = draft.actions.find(action => action.kind === 'move')
  const forward = draft.actions.find(action => action.kind === 'forward')
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
    reject: isRejected,
    forwardTo:
      isRejected || forward === undefined
        ? null
        : {
            addresses: forwardAddresses(forward),
            keepACopy: forward.keepACopy
          }
  }
  return {
    name: draft.name.trim(),
    conditionGroup: {
      conditionCombiner: draft.combiner,
      conditions: draft.conditions.map(condition => {
        const header = ruleHeaderName(condition.field)
        return {
          ...condition,
          field: header === null ? condition.field : headerField(header.trim()),
          value: condition.value.trim()
        }
      })
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
  | 'rules.errors.noForwardAddress'
  | 'rules.errors.invalidForwardAddress'
  | 'rules.errors.noHeaderName'
  | 'rules.errors.invalidHeaderName'

function forwardProblem(action: RuleActionDraft): RuleProblem | null {
  const addresses = forwardAddresses(action)
  if (addresses.length === 0) return 'rules.errors.noForwardAddress'
  return addresses.every(isValidEmail)
    ? null
    : 'rules.errors.invalidForwardAddress'
}

/** What stops a draft from being saved, beyond its fields (tmail-flutter) */
export function ruleDraftProblem(
  draft: RuleDraft,
  spamId: string | null
): RuleProblem | null {
  if (draft.conditions.length === 0) return 'rules.errors.noCondition'
  const headerProblem =
    draft.conditions.map(headerNameProblem).find(problem => problem !== null) ??
    null
  if (headerProblem !== null) return headerProblem
  const actions = draft.actions.filter(action => action.kind !== null)
  if (actions.length === 0) return 'rules.errors.noAction'
  if (actions.some(action => action.kind === 'move' && !action.mailboxId)) {
    return 'rules.errors.noFolder'
  }
  if (actions.some(action => action.kind === 'spam') && spamId === null) {
    return 'rules.errors.noSpam'
  }
  const forward = actions.find(action => action.kind === 'forward')
  return forward === undefined ? null : forwardProblem(forward)
}
