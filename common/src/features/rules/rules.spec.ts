import type { Rule } from 'jmap-client-ts/linagora'

import {
  draftFromRule,
  newRuleDraft,
  ruleDraftProblem,
  ruleFromDraft,
  rulesForUpdate
} from './rules'

const SPAM = 'mailbox-spam'

const ARCHIVE_RULE: Rule = {
  name: 'Lists',
  conditionGroup: {
    conditionCombiner: 'OR',
    conditions: [{ field: 'to', comparator: 'contains', value: 'list@' }]
  },
  condition: { field: 'to', comparator: 'contains', value: 'list@' },
  action: {
    appendIn: { mailboxIds: ['mailbox-archive'] },
    markAsSeen: true,
    markAsImportant: false,
    reject: false,
    withKeywords: ['list']
  }
}

describe('rules', () => {
  it('starts a rule from an address with "From contains <address>"', () => {
    expect(newRuleDraft('bob@example.com')).toEqual({
      name: '',
      combiner: 'AND',
      conditions: [
        { field: 'from', comparator: 'contains', value: 'bob@example.com' }
      ],
      actions: [{ kind: null, mailboxId: null }]
    })
  })

  it('edits a rule and keeps what the creator does not show', () => {
    const draft = draftFromRule(ARCHIVE_RULE, SPAM)
    expect(draft.actions).toEqual([
      { kind: 'move', mailboxId: 'mailbox-archive' },
      { kind: 'seen', mailboxId: null }
    ])

    const saved = ruleFromDraft(
      {
        ...draft,
        actions: [...draft.actions, { kind: 'star', mailboxId: null }]
      },
      SPAM,
      ARCHIVE_RULE
    )

    expect(saved).toEqual({
      name: 'Lists',
      conditionGroup: ARCHIVE_RULE.conditionGroup,
      action: {
        appendIn: { mailboxIds: ['mailbox-archive'] },
        markAsSeen: true,
        markAsImportant: true,
        reject: false,
        withKeywords: ['list']
      }
    })
  })

  it('marks as spam by moving to the spam folder', () => {
    const rule = ruleFromDraft(
      {
        ...newRuleDraft('spammer@example.com'),
        name: ' Spam ',
        actions: [{ kind: 'spam', mailboxId: null }]
      },
      SPAM
    )
    expect(rule.name).toBe('Spam')
    expect(rule.action.appendIn.mailboxIds).toEqual([SPAM])
    expect(draftFromRule(rule, SPAM).actions).toEqual([
      { kind: 'spam', mailboxId: null }
    ])
  })

  it('rejects without any other action', () => {
    const rule = ruleFromDraft(
      {
        ...newRuleDraft('x@example.com'),
        actions: [
          { kind: 'reject', mailboxId: null },
          { kind: 'seen', mailboxId: null }
        ]
      },
      SPAM
    )
    expect(rule.action).toMatchObject({
      appendIn: { mailboxIds: [] },
      markAsSeen: false,
      markAsImportant: false,
      reject: true
    })
  })

  it('numbers the rules for Filter/set, without the legacy condition', () => {
    expect(rulesForUpdate([ARCHIVE_RULE, ARCHIVE_RULE])).toEqual([
      {
        id: '0',
        name: 'Lists',
        conditionGroup: ARCHIVE_RULE.conditionGroup,
        action: ARCHIVE_RULE.action
      },
      {
        id: '1',
        name: 'Lists',
        conditionGroup: ARCHIVE_RULE.conditionGroup,
        action: ARCHIVE_RULE.action
      }
    ])
  })

  it('names what keeps a draft from being saved', () => {
    const draft = newRuleDraft('x@example.com')
    expect(ruleDraftProblem({ ...draft, conditions: [] }, SPAM)).toBe(
      'rules.errors.noCondition'
    )
    expect(ruleDraftProblem(draft, SPAM)).toBe('rules.errors.noAction')
    expect(
      ruleDraftProblem(
        { ...draft, actions: [{ kind: 'move', mailboxId: null }] },
        SPAM
      )
    ).toBe('rules.errors.noFolder')
    expect(
      ruleDraftProblem(
        { ...draft, actions: [{ kind: 'spam', mailboxId: null }] },
        null
      )
    ).toBe('rules.errors.noSpam')
    expect(
      ruleDraftProblem(
        { ...draft, actions: [{ kind: 'seen', mailboxId: null }] },
        SPAM
      )
    ).toBe(null)
  })
})
