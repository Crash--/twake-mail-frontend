import type { Rule } from 'jmap-client-ts/linagora'

import {
  actionDraft,
  draftFromRule,
  headerField,
  isMoveWithoutFolder,
  isValidHeaderName,
  moveRule,
  newRuleDraft,
  ruleDraftProblem,
  ruleFieldChoice,
  ruleFieldLabel,
  ruleFieldText,
  ruleFromDraft,
  ruleHeaderName,
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
      actions: [actionDraft()]
    })
  })

  it('starts a rule from a folder with the action moving to it', () => {
    expect(newRuleDraft(null, { id: 'work', role: null }).actions).toEqual([
      actionDraft('move', { mailboxId: 'work' })
    ])
  })

  it('starts a rule from Spam with the action marking as spam', () => {
    expect(newRuleDraft(null, { id: 'spam', role: 'junk' }).actions).toEqual([
      actionDraft('spam')
    ])
  })

  it('edits a rule and keeps what the creator does not show', () => {
    const draft = draftFromRule(ARCHIVE_RULE, SPAM)
    expect(draft.actions).toEqual([
      actionDraft('move', { mailboxId: 'mailbox-archive' }),
      actionDraft('seen')
    ])

    const saved = ruleFromDraft(
      {
        ...draft,
        actions: [...draft.actions, actionDraft('star')]
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
        withKeywords: ['list'],
        forwardTo: null
      }
    })
  })

  it('marks as spam by moving to the spam folder', () => {
    const rule = ruleFromDraft(
      {
        ...newRuleDraft('spammer@example.com'),
        name: ' Spam ',
        actions: [actionDraft('spam')]
      },
      SPAM
    )
    expect(rule.name).toBe('Spam')
    expect(rule.action.appendIn.mailboxIds).toEqual([SPAM])
    expect(draftFromRule(rule, SPAM).actions).toEqual([actionDraft('spam')])
  })

  it('forwards to the typed addresses, keeping a copy or not', () => {
    const rule = ruleFromDraft(
      {
        ...newRuleDraft('boss@example.com'),
        name: 'Boss',
        actions: [
          actionDraft('forward', {
            forwardAddresses: 'alice@example.com, Bob <bob@example.com>',
            keepACopy: false
          })
        ]
      },
      SPAM
    )
    expect(rule.action.forwardTo).toEqual({
      addresses: ['alice@example.com', 'bob@example.com'],
      keepACopy: false
    })
    expect(draftFromRule(rule, SPAM).actions).toEqual([
      actionDraft('forward', {
        forwardAddresses: 'alice@example.com, bob@example.com',
        keepACopy: false
      })
    ])
  })

  it('drops the forward of a rule when its action is removed', () => {
    const forwarding: Rule = {
      ...ARCHIVE_RULE,
      action: {
        ...ARCHIVE_RULE.action,
        forwardTo: { addresses: ['alice@example.com'], keepACopy: true }
      }
    }
    const saved = ruleFromDraft(
      { ...draftFromRule(forwarding, SPAM), actions: [actionDraft('seen')] },
      SPAM,
      forwarding
    )
    expect(saved.action.forwardTo).toBe(null)
  })

  it('rejects without any other action', () => {
    const rule = ruleFromDraft(
      {
        ...newRuleDraft('x@example.com'),
        actions: [
          actionDraft('reject'),
          actionDraft('seen'),
          actionDraft('forward', { forwardAddresses: 'alice@example.com' })
        ]
      },
      SPAM
    )
    expect(rule.action).toMatchObject({
      appendIn: { mailboxIds: [] },
      markAsSeen: false,
      markAsImportant: false,
      reject: true,
      forwardTo: null
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

  it('refuses a move to a folder deleted since (tmail-flutter#2668)', () => {
    const gone = actionDraft('move', { mailboxId: 'mailbox-gone' })
    const kept = actionDraft('move', { mailboxId: 'mailbox-archive' })
    const folders = new Set(['mailbox-archive'])
    expect(isMoveWithoutFolder(gone, folders)).toBe(true)
    expect(isMoveWithoutFolder(kept, folders)).toBe(false)
    expect(isMoveWithoutFolder(actionDraft('move'), null)).toBe(true)
    // The folders not loaded yet: the folder is taken as it is
    expect(isMoveWithoutFolder(gone, null)).toBe(false)
    expect(isMoveWithoutFolder(actionDraft('seen'), folders)).toBe(false)
    const draft = newRuleDraft('x@example.com')
    expect(ruleDraftProblem({ ...draft, actions: [gone] }, SPAM, folders)).toBe(
      'rules.errors.noFolder'
    )
    expect(ruleDraftProblem({ ...draft, actions: [kept] }, SPAM, folders)).toBe(
      null
    )
  })

  it('names what keeps a draft from being saved', () => {
    const draft = newRuleDraft('x@example.com')
    expect(ruleDraftProblem({ ...draft, conditions: [] }, SPAM)).toBe(
      'rules.errors.noCondition'
    )
    expect(ruleDraftProblem(draft, SPAM)).toBe('rules.errors.noAction')
    expect(
      ruleDraftProblem({ ...draft, actions: [actionDraft('move')] }, SPAM)
    ).toBe('rules.errors.noFolder')
    expect(
      ruleDraftProblem({ ...draft, actions: [actionDraft('spam')] }, null)
    ).toBe('rules.errors.noSpam')
    expect(
      ruleDraftProblem({ ...draft, actions: [actionDraft('forward')] }, SPAM)
    ).toBe('rules.errors.noForwardAddress')
    expect(
      ruleDraftProblem(
        {
          ...draft,
          actions: [
            actionDraft('forward', {
              forwardAddresses: 'alice@example.com, bob'
            })
          ]
        },
        SPAM
      )
    ).toBe('rules.errors.invalidForwardAddress')
    expect(
      ruleDraftProblem({ ...draft, actions: [actionDraft('seen')] }, SPAM)
    ).toBe(null)
  })

  it('tests another header with a header:<name> field', () => {
    expect(headerField('List-Id')).toBe('header:List-Id')
    expect(ruleHeaderName('header:List-Id')).toBe('List-Id')
    expect(ruleHeaderName('subject')).toBe(null)
    expect(ruleFieldChoice('header:List-Id')).toBe('header')
    expect(ruleFieldChoice('subject')).toBe('subject')
    expect(ruleFieldChoice('sentDate')).toBe(null)
    expect(ruleFieldLabel('header:List-Id')).toBe('rules.fields.header')
    expect(ruleFieldLabel('sentDate')).toBe(null)
  })

  it('says a field in words, with its header name', () => {
    const t = (key: string): string =>
      key === 'rules.fields.header' ? 'Header' : 'From'
    expect(ruleFieldText('header:List-Id', t)).toBe('Header List-Id')
    expect(ruleFieldText('from', t)).toBe('From')
    expect(ruleFieldText('sentDate', t)).toBe('sentDate')
  })

  it('takes a header name without space nor colon', () => {
    expect(isValidHeaderName('List-Id')).toBe(true)
    expect(isValidHeaderName('X-Spam_Flag.1')).toBe(true)
    expect(isValidHeaderName('List Id')).toBe(false)
    expect(isValidHeaderName('List-Id:')).toBe(false)
    expect(isValidHeaderName('Liste-Identité')).toBe(false)
    expect(isValidHeaderName('')).toBe(false)
  })

  it('saves a header condition with its trimmed name and edits it back', () => {
    const rule = ruleFromDraft(
      {
        ...newRuleDraft(),
        name: 'Lists',
        conditions: [
          {
            field: headerField(' List-Id '),
            comparator: 'contains',
            value: ' team.example.com '
          }
        ],
        actions: [actionDraft('seen')]
      },
      SPAM
    )
    expect(rule.conditionGroup.conditions).toEqual([
      {
        field: 'header:List-Id',
        comparator: 'contains',
        value: 'team.example.com'
      }
    ])
    expect(draftFromRule(rule, SPAM).conditions).toEqual(
      rule.conditionGroup.conditions
    )
  })

  it('wants a valid header name in a header condition', () => {
    const draft = {
      ...newRuleDraft(),
      actions: [actionDraft('seen')]
    }
    const withHeader = (name: string): typeof draft => ({
      ...draft,
      conditions: [
        { field: headerField(name), comparator: 'contains', value: 'x' }
      ]
    })
    expect(ruleDraftProblem(withHeader(' '), SPAM)).toBe(
      'rules.errors.noHeaderName'
    )
    expect(ruleDraftProblem(withHeader('List Id'), SPAM)).toBe(
      'rules.errors.invalidHeaderName'
    )
    expect(ruleDraftProblem(withHeader('List-Id'), SPAM)).toBe(null)
  })

  it('moves a rule up or down, the others keeping their order', () => {
    expect(moveRule(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    expect(moveRule(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveRule(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveRule(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveRule(['a', 'b', 'c'], 2, 3)).toEqual(['a', 'b', 'c'])
    expect(moveRule(['a', 'b', 'c'], 5, 0)).toEqual(['a', 'b', 'c'])
  })
})
