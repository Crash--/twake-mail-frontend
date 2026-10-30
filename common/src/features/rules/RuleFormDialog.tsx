import { Eye, EyeClosed, Icon, Plus, Trash } from '@linagora/twake-icons'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FixedDialog,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { Rule } from 'jmap-client-ts/linagora'
import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { validateIdentityName } from '@common/features/identities/identityForm'
import { usePickMailbox } from '@common/features/mailbox/MailboxPickerProvider'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import {
  actionDraft,
  draftFromRule,
  emptyCondition,
  headerField,
  headerNameProblem,
  isMoveWithoutFolder,
  RULE_ACTION_KINDS,
  RULE_ACTION_LABELS,
  RULE_COMPARATORS,
  RULE_FIELD_CHOICES,
  ruleComparatorLabel,
  ruleDraftProblem,
  ruleFieldChoice,
  ruleFieldLabel,
  ruleFieldText,
  ruleFromDraft,
  ruleHeaderName,
  type RuleActionDraft,
  type RuleActionKind,
  type RuleDraft,
  type RuleFieldChoice
} from './rules'

/** Most action rows: move or spam, seen, star, forward (reject stays alone) */
const MAX_ACTIONS = 4

/**
 * Folders a rule cannot file into (tmail-flutter#4871): an email in the
 * Outbox can be picked up for sending
 */
const RULE_EXCLUDED_ROLES: readonly string[] = ['outbox', 'drafts', 'templates']

const FORWARD_PROBLEMS: readonly TranslationKey[] = [
  'rules.errors.noForwardAddress',
  'rules.errors.invalidForwardAddress'
]

export interface RuleFormDialogProps {
  /** The rule to edit, null to create one */
  rule: Rule | null
  /** The draft of a new rule (from an address) */
  initialDraft: RuleDraft
  /** Saves the rule; resolves false when the server refused it */
  onSubmit: (rule: Rule) => Promise<boolean>
  onClose: () => void
}

function isKindTaken(
  actions: readonly RuleActionDraft[],
  kind: RuleActionKind,
  index: number
): boolean {
  return actions.some(
    (action, other) =>
      other !== index &&
      (action.kind === kind ||
        // Moving and marking as spam both choose the folder
        (kind === 'move' && action.kind === 'spam') ||
        (kind === 'spam' && action.kind === 'move'))
  )
}

const RULE_ROW_PROPS = {
  role: 'group',
  direction: 'row',
  spacing: 1,
  useFlexGap: true,
  className: 'u-flex-items-center u-mt-half u-p-half',
  // Grey in the Figma, and twake-mui has no prop for it
  sx: { bgcolor: 'background.default' }
} as const

const RULE_FIELD_PROPS = {
  size: 'small',
  // White and body2 in the Figma, and twake-mui has no prop for it
  sx: {
    '& .MuiInputBase-root': { bgcolor: 'background.paper', typography: 'body2' }
  }
} as const

/** The field a condition gets when `choice` is picked in its field select */
function fieldOfChoice(
  choice: RuleFieldChoice,
  current: RuleDraft['conditions'][number]['field']
): RuleDraft['conditions'][number]['field'] {
  if (choice !== 'header') return choice
  return headerField(ruleHeaderName(current) ?? '')
}

/**
 * Creates or edits a filtering rule, as tmail-flutter's rule creator: a
 * name, conditions on From, To, Cc, Recipient, Subject or another header
 * (`header:<name>`, the Linagora `Filter` extension) that must all or any
 * be met, and the actions (move to a folder, mark as seen, star,
 * reject, mark as spam, forward). Rejecting asks for a confirmation.
 */
export function RuleFormDialog({
  rule,
  initialDraft,
  onSubmit,
  onClose
}: RuleFormDialogProps): ReactElement {
  const { t } = useI18n()
  const confirm = useConfirm()
  const pickMailbox = usePickMailbox()
  const getMailboxName = useMailboxName()
  const { data: loadedMailboxes } = useMailboxes()
  const mailboxes = loadedMailboxes ?? []
  const isPhone = useScreenSize() === 'mobile'
  const formId = useId()
  const nameId = useId()
  const conditionsId = useId()
  const folderErrorId = useId()
  const folderRef = useRef<{ focus: () => void }>(null)
  const [isPreviewShown, setIsPreviewShown] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const spamId = mailboxes.find(mailbox => mailbox.role === 'junk')?.id ?? null
  // The folders a rule can move to, null until they are loaded: a rule
  // moving to a folder deleted since cannot be saved as is (tmail-flutter)
  const folderIds =
    loadedMailboxes === undefined
      ? null
      : new Set(loadedMailboxes.map(mailbox => mailbox.id))
  const [draft, setDraft] = useState<RuleDraft>(() =>
    rule === null ? initialDraft : draftFromRule(rule, spamId)
  )
  const [isTouched, setIsTouched] = useState(false)
  const [problem, setProblem] = useState<TranslationKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const nameProblem = validateIdentityName(draft.name)
  const valueProblem = (value: string): TranslationKey | null =>
    isTouched ? validateIdentityName(value) : null
  const hasReject = draft.actions.some(action => action.kind === 'reject')

  const update = (change: Partial<RuleDraft>): void => {
    setDraft(current => ({ ...current, ...change }))
    setProblem(null)
  }

  const updateCondition = (
    index: number,
    change: Partial<RuleDraft['conditions'][number]>
  ): void => {
    update({
      conditions: draft.conditions.map((condition, other) =>
        other === index ? { ...condition, ...change } : condition
      )
    })
  }

  const updateAction = (
    index: number,
    change: Partial<RuleActionDraft>
  ): void => {
    const actions = draft.actions.map((action, other) =>
      other === index ? { ...action, ...change } : action
    )
    // A rejected email gets no other action (tmail-flutter)
    update({
      actions: change.kind === 'reject' ? [actionDraft('reject')] : actions
    })
  }

  const handleChooseFolder = (index: number): void => {
    pickMailbox({
      title: t('rules.form.chooseFolder'),
      excludedRoles: RULE_EXCLUDED_ROLES,
      canCreateFolder: true
    })
      .then(mailbox => {
        if (mailbox !== null && typeof mailbox !== 'string') {
          updateAction(index, { mailboxId: mailbox.id })
        }
      })
      .catch((error: unknown) => {
        console.error('[rules] Cannot pick a folder', error)
      })
  }

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    setIsTouched(true)
    if (nameProblem !== null) {
      nameRef.current?.focus()
      return
    }
    if (
      draft.conditions.some(
        condition =>
          validateIdentityName(condition.value) !== null ||
          headerNameProblem(condition) !== null
      )
    ) {
      return
    }
    const draftProblem = ruleDraftProblem(draft, spamId, folderIds)
    if (draftProblem !== null) {
      setProblem(draftProblem)
      // The error is under the folder field: the focus goes to it
      if (draftProblem === 'rules.errors.noFolder') folderRef.current?.focus()
      return
    }
    const run = async (): Promise<void> => {
      if (hasReject) {
        const isConfirmed = await confirm({
          title: t('rules.reject.title'),
          message: t('rules.reject.message'),
          confirmLabel: t('common.confirm'),
          isDestructive: true
        })
        if (!isConfirmed) return
      }
      setIsSaving(true)
      const isSaved = await onSubmit(ruleFromDraft(draft, spamId, rule))
      if (!isSaved) {
        setIsSaving(false)
        setProblem('rules.errors.save')
      }
    }
    run().catch((error: unknown) => {
      console.error('[rules] Cannot save the rule', error)
      setIsSaving(false)
      setProblem('rules.errors.save')
    })
  }

  const folderName = (mailboxId: string | null): string | null => {
    const mailbox = mailboxes.find(candidate => candidate.id === mailboxId)
    return mailbox ? getMailboxName(mailbox) : null
  }

  // The preview of tmail-flutter: `ALL of the conditions: From contains
  // "alice"`, then `Actions: Move message to folder: "Archive"`
  const conditionsPreview = t('rules.form.conditionsPreview', {
    combiner: t(`rules.combiners.${draft.combiner}`).toUpperCase(),
    conditions: draft.conditions
      .map(condition => {
        const comparator = ruleComparatorLabel(condition.comparator)
        return `${ruleFieldText(condition.field, t)} ${(comparator === null ? condition.comparator : t(comparator)).toLowerCase()} "${condition.value}"`
      })
      .join(', ')
  })
  const actionsPreview = t('rules.form.actionsPreview', {
    actions: draft.actions
      .flatMap(action => {
        if (action.kind === null) return []
        const label = t(RULE_ACTION_LABELS[action.kind])
        if (action.kind === 'forward') {
          return [`${label} "${action.forwardAddresses.trim()}"`]
        }
        if (action.kind !== 'move') return [label]
        // No folder (none picked, or deleted since): the action alone,
        // rather than tmail-flutter's empty quotes
        const folder = folderName(action.mailboxId)
        return [
          folder === null
            ? label
            : `${label} ${t('rules.form.toFolder').toLowerCase()} "${folder}"`
        ]
      })
      .join(', ')
  })

  return (
    <FixedDialog
      open
      title={t(
        rule === null ? 'rules.form.createTitle' : 'rules.form.editTitle'
      )}
      fullScreen={isPhone}
      // While saving: the dialog stays and its buttons wait
      onClose={isSaving ? () => undefined : onClose}
      actions={
        <>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={isSaving}
            data-testid="rule-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={isSaving}
            data-testid="create-rule-button"
          >
            {t(rule === null ? 'rules.form.create' : 'rules.form.save')}
          </Button>
        </>
      }
      data-testid="rule-form-dialog"
      content={
        <form id={formId} onSubmit={handleSubmit} noValidate>
          <TextField
            id={nameId}
            inputRef={nameRef}
            autoFocus
            required
            fullWidth
            size="small"
            label={t('rules.form.name')}
            placeholder={t('rules.form.namePlaceholder')}
            value={draft.name}
            onChange={event => {
              update({ name: event.target.value })
            }}
            error={isTouched && nameProblem !== null}
            helperText={
              isTouched && nameProblem !== null ? t(nameProblem) : undefined
            }
            slotProps={{ htmlInput: { 'data-testid': 'rule-name-input' } }}
          />
          <Box role="group" aria-labelledby={conditionsId}>
            {/* As tmail-flutter: "Preview" at the end of the label, on a
            desktop and a tablet, says what the rule does in words */}
            <Box className="u-flex u-flex-items-center u-flex-justify-between u-pv-1">
              <Typography component="h3" variant="body2" id={conditionsId}>
                {t('rules.form.conditions')}
              </Typography>
              {isPhone ? null : (
                <Button
                  variant="text"
                  size="small"
                  aria-pressed={isPreviewShown}
                  onClick={() => {
                    setIsPreviewShown(shown => !shown)
                  }}
                  startIcon={
                    <Icon
                      icon={isPreviewShown ? EyeClosed : Eye}
                      aria-hidden="true"
                    />
                  }
                  data-testid="rule-preview-toggle"
                >
                  {t('rules.form.preview')}
                </Button>
              )}
            </Box>
            {isPreviewShown && !isPhone ? (
              // A part of the form, not an event: no live region
              <Alert
                severity="info"
                role="none"
                className="u-mb-1"
                data-testid="rule-conditions-preview"
              >
                <strong>{`${t('rules.form.preview')}:`}</strong>{' '}
                {conditionsPreview}
              </Alert>
            ) : null}
            {/* On a phone the select fills the row and what follows it goes
            under it; elsewhere the sentence stays on one line */}
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              className={`u-flex-items-center${isPhone ? ' u-flex-wrap' : ''}`}
            >
              <Typography component="span" noWrap>
                {t('rules.form.combinerBefore')}
              </Typography>
              <TextField
                select
                {...RULE_FIELD_PROPS}
                fullWidth={isPhone}
                value={draft.combiner}
                onChange={event => {
                  update({
                    combiner: event.target.value === 'OR' ? 'OR' : 'AND'
                  })
                }}
                slotProps={{
                  select: { native: true },
                  htmlInput: {
                    'aria-label': t('rules.form.combiner'),
                    'data-testid': 'rule-combiner-select'
                  }
                }}
              >
                <option value="AND">{t('rules.combiners.AND')}</option>
                <option value="OR">{t('rules.combiners.OR')}</option>
              </TextField>
              {isPhone ? null : (
                <Typography component="span" noWrap>
                  {t('rules.form.combinerAfter')}
                </Typography>
              )}
            </Stack>
            {isPhone ? (
              <Typography component="span" className="u-db u-mt-half">
                {t('rules.form.combinerAfter')}
              </Typography>
            ) : null}
            {draft.conditions.map((condition, index) => {
              const position = index + 1
              const fieldLabel = ruleFieldLabel(condition.field)
              const comparatorLabel = ruleComparatorLabel(condition.comparator)
              const problemKey = valueProblem(condition.value)
              const headerName = ruleHeaderName(condition.field)
              const headerProblem = isTouched
                ? headerNameProblem(condition)
                : null
              const removeButton = (
                <Tooltip
                  title={t('rules.form.removeCondition', { position })}
                  disableInteractive
                >
                  <IconButton
                    size="medium"
                    onClick={() => {
                      update({
                        conditions: draft.conditions.filter(
                          (_condition, other) => other !== index
                        )
                      })
                    }}
                    data-testid="rule-condition-remove-button"
                  >
                    <Icon icon={Trash} aria-hidden="true" />
                  </IconButton>
                </Tooltip>
              )
              return (
                <Stack
                  key={index}
                  {...RULE_ROW_PROPS}
                  aria-label={t('rules.form.condition', { position })}
                  data-testid="rule-condition"
                >
                  <Stack useFlexGap spacing={1} className="u-flex-auto">
                    {/* One under the other on a phone */}
                    <Stack
                      direction={isPhone ? 'column' : 'row'}
                      useFlexGap
                      spacing={1}
                    >
                      <TextField
                        select
                        fullWidth
                        {...RULE_FIELD_PROPS}
                        value={
                          ruleFieldChoice(condition.field) ?? condition.field
                        }
                        onChange={event => {
                          const choice = RULE_FIELD_CHOICES.find(
                            candidate => candidate === event.target.value
                          )
                          if (choice === undefined) return
                          updateCondition(index, {
                            field: fieldOfChoice(choice, condition.field)
                          })
                        }}
                        slotProps={{
                          select: { native: true },
                          htmlInput: {
                            'aria-label': t('rules.form.field'),
                            'data-testid': 'rule-condition-field-select'
                          }
                        }}
                      >
                        {fieldLabel === null ? (
                          <option value={condition.field}>
                            {condition.field}
                          </option>
                        ) : null}
                        {RULE_FIELD_CHOICES.map(choice => (
                          <option key={choice} value={choice}>
                            {t(ruleFieldLabel(choice) ?? 'rules.fields.from')}
                          </option>
                        ))}
                      </TextField>
                      {headerName === null ? null : (
                        <TextField
                          required
                          fullWidth
                          {...RULE_FIELD_PROPS}
                          placeholder={t('rules.form.headerNamePlaceholder')}
                          value={headerName}
                          onChange={event => {
                            updateCondition(index, {
                              field: headerField(event.target.value)
                            })
                          }}
                          error={headerProblem !== null}
                          helperText={
                            headerProblem === null
                              ? undefined
                              : t(headerProblem)
                          }
                          slotProps={{
                            htmlInput: {
                              'aria-label': t('rules.form.headerName'),
                              'data-testid': 'rule-condition-header-input'
                            }
                          }}
                        />
                      )}
                      <TextField
                        select
                        fullWidth
                        {...RULE_FIELD_PROPS}
                        value={condition.comparator}
                        onChange={event => {
                          updateCondition(index, {
                            comparator:
                              RULE_COMPARATORS.find(
                                comparator => comparator === event.target.value
                              ) ?? condition.comparator
                          })
                        }}
                        slotProps={{
                          select: { native: true },
                          htmlInput: {
                            'aria-label': t('rules.form.comparator'),
                            'data-testid': 'rule-condition-comparator-select'
                          }
                        }}
                      >
                        {comparatorLabel === null ? (
                          <option value={condition.comparator}>
                            {condition.comparator}
                          </option>
                        ) : null}
                        {RULE_COMPARATORS.map(comparator => (
                          <option key={comparator} value={comparator}>
                            {t(
                              ruleComparatorLabel(comparator) ??
                                'rules.comparators.contains'
                            )}
                          </option>
                        ))}
                      </TextField>
                    </Stack>
                    <Stack
                      direction="row"
                      useFlexGap
                      spacing={1}
                      className="u-flex-items-center"
                    >
                      <TextField
                        required
                        fullWidth
                        {...RULE_FIELD_PROPS}
                        placeholder={t('rules.form.value')}
                        value={condition.value}
                        onChange={event => {
                          updateCondition(index, { value: event.target.value })
                        }}
                        error={problemKey !== null}
                        helperText={
                          problemKey === null ? undefined : t(problemKey)
                        }
                        slotProps={{
                          htmlInput: {
                            'aria-label': t('rules.form.value'),
                            'data-testid': 'rule-condition-value-input'
                          }
                        }}
                      />
                      {isPhone ? null : removeButton}
                    </Stack>
                  </Stack>
                  {isPhone ? removeButton : null}
                </Stack>
              )
            })}
            <Button
              variant="text"
              className="u-mt-1"
              startIcon={<Icon icon={Plus} aria-hidden="true" />}
              onClick={() => {
                update({ conditions: [...draft.conditions, emptyCondition()] })
              }}
              data-testid="rule-add-condition-button"
            >
              {t('rules.form.addCondition')}
            </Button>
          </Box>
          <Box component="fieldset" className="u-bdw-0 u-p-0 u-m-0 u-mt-1-half">
            <Typography
              component="legend"
              variant="body2"
              className="u-pb-half"
            >
              {t('rules.form.actions')}
            </Typography>
            {isPreviewShown && !isPhone ? (
              <Alert
                severity="success"
                role="none"
                className="u-mv-half"
                data-testid="rule-actions-preview"
              >
                <strong>{`${t('rules.form.preview')}:`}</strong>{' '}
                {actionsPreview}
              </Alert>
            ) : null}
            {draft.actions.map((action, index) => {
              const position = index + 1
              const folder = folderName(action.mailboxId)
              const folderProblem =
                problem === 'rules.errors.noFolder' &&
                isMoveWithoutFolder(action, folderIds)
                  ? t(problem)
                  : null
              return (
                <Stack
                  key={index}
                  {...RULE_ROW_PROPS}
                  // The folder goes to a next line when a language lacks room
                  className={
                    action.kind === 'move'
                      ? `${RULE_ROW_PROPS.className} u-flex-wrap`
                      : RULE_ROW_PROPS.className
                  }
                  aria-label={t('rules.form.action', { position })}
                  data-testid="rule-action"
                >
                  <TextField
                    select
                    // As wide as its text next to a folder, as the Figma
                    fullWidth={action.kind !== 'move'}
                    className={
                      action.kind === 'move' ? 'u-flex-auto' : undefined
                    }
                    {...RULE_FIELD_PROPS}
                    value={action.kind ?? ''}
                    onChange={event => {
                      const kind = RULE_ACTION_KINDS.find(
                        candidate => candidate === event.target.value
                      )
                      updateAction(index, actionDraft(kind ?? null))
                    }}
                    slotProps={{
                      select: { native: true },
                      htmlInput: {
                        'aria-label': t('rules.form.action', { position }),
                        'data-testid': 'rule-action-select'
                      }
                    }}
                  >
                    <option value="" disabled>
                      {t('rules.form.selectAction')}
                    </option>
                    {RULE_ACTION_KINDS.filter(
                      kind => !isKindTaken(draft.actions, kind, index)
                    ).map(kind => (
                      <option key={kind} value={kind}>
                        {t(RULE_ACTION_LABELS[kind])}
                      </option>
                    ))}
                  </TextField>
                  {action.kind === 'move' ? (
                    <>
                      <Typography
                        component="span"
                        noWrap
                        className="u-flex-shrink-0"
                      >
                        {t('rules.form.toFolder')}
                      </Typography>
                      {/* Never opens its own menu: opening it asks for the
                          picker */}
                      <TextField
                        id={folderErrorId}
                        select
                        className="u-flex-auto"
                        {...RULE_FIELD_PROPS}
                        value={folder ?? ''}
                        inputRef={folderRef}
                        error={folderProblem !== null}
                        helperText={folderProblem ?? undefined}
                        slotProps={{
                          select: {
                            open: false,
                            displayEmpty: true,
                            onOpen: () => {
                              handleChooseFolder(index)
                            },
                            renderValue: () =>
                              folder ?? t('rules.form.chooseFolder'),
                            SelectDisplayProps: {
                              'aria-label':
                                folder === null
                                  ? t('rules.form.chooseFolder')
                                  : `${t('rules.form.chooseFolder')}: ${folder}`,
                              'aria-haspopup': 'dialog',
                              'data-testid': 'rule-action-folder-button'
                            } as Record<string, string>
                          }
                        }}
                      >
                        <MenuItem value={folder ?? ''}>{folder ?? ''}</MenuItem>
                      </TextField>
                    </>
                  ) : null}
                  {action.kind === 'forward' ? (
                    <>
                      <TextField
                        required
                        fullWidth
                        {...RULE_FIELD_PROPS}
                        placeholder={t('rules.form.forwardPlaceholder')}
                        value={action.forwardAddresses}
                        onChange={event => {
                          updateAction(index, {
                            forwardAddresses: event.target.value
                          })
                        }}
                        error={
                          problem !== null && FORWARD_PROBLEMS.includes(problem)
                        }
                        slotProps={{
                          htmlInput: {
                            'aria-label': t('rules.form.forwardAddresses'),
                            inputMode: 'email',
                            'data-testid': 'rule-action-forward-input'
                          }
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={action.keepACopy}
                            onChange={event => {
                              updateAction(index, {
                                keepACopy: event.target.checked
                              })
                            }}
                          />
                        }
                        label={t('rules.form.keepACopy')}
                        data-testid="rule-action-forward-keep-copy-checkbox"
                      />
                    </>
                  ) : null}
                  {/* As tmail-flutter: an action can always be taken out, the
                  last one too */}
                  <Tooltip
                    title={t('rules.form.removeAction', { position })}
                    disableInteractive
                  >
                    <IconButton
                      size="medium"
                      onClick={() => {
                        update({
                          actions: draft.actions.filter(
                            (_action, other) => other !== index
                          )
                        })
                      }}
                      data-testid="rule-action-remove-button"
                    >
                      <Icon icon={Trash} aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )
            })}
            {hasReject ? (
              <Typography
                variant="body2"
                color="textPrimary"
                className="u-mt-1"
              >
                {t('rules.form.rejectAlone')}
              </Typography>
            ) : draft.actions.length < MAX_ACTIONS ? (
              <Button
                variant="text"
                className="u-mt-1"
                startIcon={<Icon icon={Plus} aria-hidden="true" />}
                onClick={() => {
                  update({
                    actions: [...draft.actions, actionDraft()]
                  })
                }}
                data-testid="rule-add-action-button"
              >
                {t('rules.form.addAction')}
              </Button>
            ) : null}
          </Box>
          {problem === null || problem === 'rules.errors.noFolder' ? null : (
            <Alert
              severity="error"
              className="u-mt-1"
              data-testid="rule-form-error"
            >
              {t(problem)}
            </Alert>
          )}
        </form>
      }
    />
  )
}
