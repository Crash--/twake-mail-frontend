import { Icon } from '@linagora/twake-icons'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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

import { Cross, Plus } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { validateIdentityName } from '@common/features/identities/identityForm'
import { usePickMailbox } from '@common/features/mailbox/MailboxPickerProvider'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import {
  draftFromRule,
  emptyCondition,
  RULE_ACTION_KINDS,
  RULE_ACTION_LABELS,
  RULE_COMPARATORS,
  RULE_FIELDS,
  ruleComparatorLabel,
  ruleDraftProblem,
  ruleFieldLabel,
  ruleFromDraft,
  type RuleActionDraft,
  type RuleActionKind,
  type RuleDraft
} from './rules'

/** Most action rows: move or spam, seen, star, reject */
const MAX_ACTIONS = 4

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

/**
 * Creates or edits a filtering rule, as tmail-flutter's rule creator: a
 * name, conditions on From, To, Cc, Recipient or Subject that must all or
 * any be met, and the actions (move to a folder, mark as seen, star,
 * reject, mark as spam). Rejecting asks for a confirmation.
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
  const { data: mailboxes = [] } = useMailboxes()
  const isMobile = useScreenSize() === 'mobile'
  const titleId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const spamId = mailboxes.find(mailbox => mailbox.role === 'junk')?.id ?? null
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
      actions:
        change.kind === 'reject'
          ? [{ kind: 'reject', mailboxId: null }]
          : actions
    })
  }

  const handleChooseFolder = (index: number): void => {
    pickMailbox({ title: t('rules.form.chooseFolder') })
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
        condition => validateIdentityName(condition.value) !== null
      )
    ) {
      return
    }
    const draftProblem = ruleDraftProblem(draft, spamId)
    if (draftProblem !== null) {
      setProblem(draftProblem)
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

  return (
    <Dialog
      open
      onClose={isSaving ? undefined : onClose}
      size="large"
      fullScreen={isMobile}
      aria-labelledby={titleId}
      data-testid="rule-form-dialog"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId}>
          {t(rule === null ? 'rules.form.createTitle' : 'rules.form.editTitle')}
        </DialogTitle>
        <DialogContent>
          <TextField
            inputRef={nameRef}
            autoFocus
            required
            fullWidth
            margin="dense"
            label={t('rules.form.name')}
            placeholder={t('rules.form.namePlaceholder')}
            value={draft.name}
            onChange={event => {
              update({ name: event.target.value })
            }}
            error={isTouched && nameProblem !== null}
            helperText={
              isTouched && nameProblem !== null ? t(nameProblem) : ' '
            }
            slotProps={{ htmlInput: { 'data-testid': 'rule-name-input' } }}
          />
          <Box component="fieldset" className="u-bdw-0 u-p-0 u-m-0 u-mt-1">
            <Typography
              component="legend"
              variant="subtitle1"
              color="textPrimary"
              className="u-fw-bold"
            >
              {t('rules.form.conditions')}
            </Typography>
            <Box className="u-flex u-flex-items-center u-flex-wrap u-mv-half">
              <Typography component="span" className="u-mr-half">
                {t('rules.form.combinerBefore')}
              </Typography>
              <TextField
                select
                size="small"
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
              <Typography component="span" className="u-ml-half">
                {t('rules.form.combinerAfter')}
              </Typography>
            </Box>
            {draft.conditions.map((condition, index) => {
              const position = index + 1
              const fieldLabel = ruleFieldLabel(condition.field)
              const comparatorLabel = ruleComparatorLabel(condition.comparator)
              const problemKey = valueProblem(condition.value)
              const removeLabel = t('rules.form.removeCondition', { position })
              return (
                <Box
                  key={index}
                  role="group"
                  aria-label={t('rules.form.condition', { position })}
                  className="u-flex u-flex-items-start u-flex-wrap u-mt-half"
                  data-testid="rule-condition"
                >
                  <TextField
                    select
                    size="small"
                    className="u-mr-half"
                    value={condition.field}
                    onChange={event => {
                      updateCondition(index, {
                        field:
                          RULE_FIELDS.find(
                            field => field === event.target.value
                          ) ?? condition.field
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
                      <option value={condition.field}>{condition.field}</option>
                    ) : null}
                    {RULE_FIELDS.map(field => (
                      <option key={field} value={field}>
                        {t(ruleFieldLabel(field) ?? 'rules.fields.from')}
                      </option>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    className="u-mr-half"
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
                  <TextField
                    size="small"
                    required
                    className="u-flex-auto"
                    label={t('rules.form.value')}
                    value={condition.value}
                    onChange={event => {
                      updateCondition(index, { value: event.target.value })
                    }}
                    error={problemKey !== null}
                    helperText={problemKey === null ? undefined : t(problemKey)}
                    slotProps={{
                      htmlInput: { 'data-testid': 'rule-condition-value-input' }
                    }}
                  />
                  <Tooltip title={removeLabel}>
                    <IconButton
                      aria-label={removeLabel}
                      onClick={() => {
                        update({
                          conditions: draft.conditions.filter(
                            (_condition, other) => other !== index
                          )
                        })
                      }}
                      data-testid="rule-condition-remove-button"
                    >
                      <Icon icon={Cross} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )
            })}
            <Button
              variant="text"
              color="inherit"
              className="u-mt-half"
              startIcon={<Icon icon={Plus} />}
              onClick={() => {
                update({ conditions: [...draft.conditions, emptyCondition()] })
              }}
              data-testid="rule-add-condition-button"
            >
              {t('rules.form.addCondition')}
            </Button>
          </Box>
          <Box component="fieldset" className="u-bdw-0 u-p-0 u-m-0 u-mt-1">
            <Typography
              component="legend"
              variant="subtitle1"
              color="textPrimary"
              className="u-fw-bold"
            >
              {t('rules.form.actions')}
            </Typography>
            {draft.actions.map((action, index) => {
              const position = index + 1
              const removeLabel = t('rules.form.removeAction', { position })
              const folder = folderName(action.mailboxId)
              return (
                <Box
                  key={index}
                  role="group"
                  aria-label={t('rules.form.action', { position })}
                  className="u-flex u-flex-items-center u-flex-wrap u-mt-half"
                  data-testid="rule-action"
                >
                  <TextField
                    select
                    size="small"
                    className="u-mr-half"
                    value={action.kind ?? ''}
                    onChange={event => {
                      const kind = RULE_ACTION_KINDS.find(
                        candidate => candidate === event.target.value
                      )
                      updateAction(index, {
                        kind: kind ?? null,
                        mailboxId: null
                      })
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
                    <Button
                      variant="outlined"
                      color="inherit"
                      className="u-mr-half"
                      onClick={() => {
                        handleChooseFolder(index)
                      }}
                      data-testid="rule-action-folder-button"
                    >
                      {folder === null
                        ? t('rules.form.chooseFolder')
                        : `${t('rules.form.toFolder')} ${folder}`}
                    </Button>
                  ) : null}
                  {draft.actions.length > 1 ? (
                    <Tooltip title={removeLabel}>
                      <IconButton
                        aria-label={removeLabel}
                        onClick={() => {
                          update({
                            actions: draft.actions.filter(
                              (_action, other) => other !== index
                            )
                          })
                        }}
                        data-testid="rule-action-remove-button"
                      >
                        <Icon icon={Cross} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Box>
              )
            })}
            {hasReject ? (
              <Typography
                variant="body2"
                color="textPrimary"
                className="u-mt-half"
              >
                {t('rules.form.rejectAlone')}
              </Typography>
            ) : draft.actions.length < MAX_ACTIONS ? (
              <Button
                variant="text"
                color="inherit"
                className="u-mt-half"
                startIcon={<Icon icon={Plus} />}
                onClick={() => {
                  update({
                    actions: [...draft.actions, { kind: null, mailboxId: null }]
                  })
                }}
                data-testid="rule-add-action-button"
              >
                {t('rules.form.addAction')}
              </Button>
            ) : null}
          </Box>
          {problem === null ? null : (
            <Alert
              severity="error"
              className="u-mt-1"
              data-testid="rule-form-error"
            >
              {t(problem)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            disabled={isSaving}
            data-testid="rule-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={
              isSaving ? <CircularProgress size={16} color="inherit" /> : null
            }
            data-testid="create-rule-button"
          >
            {t(rule === null ? 'rules.form.create' : 'rules.form.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
