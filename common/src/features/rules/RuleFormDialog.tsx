import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
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

import {
  Check,
  Eye,
  EyeClosed,
  InfoCircle,
  Plus,
  Trash
} from '@/ds/FlutterIcons/FlutterIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import {
  SettingsFormBox,
  SettingsFormDialog,
  SettingsFormFieldButton,
  SettingsFormLabel,
  SettingsFormSelect,
  SettingsFormStack,
  SettingsFormText,
  SettingsFormTextField,
  SettingsOutlinedButton,
  SettingsPreviewBanner,
  SettingsPreviewToggle
} from '@/ds/SettingsFormDialog/SettingsFormDialog'
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

/** Most action rows: move or spam, seen, star, forward (reject stays alone) */
const MAX_ACTIONS = 4

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

/**
 * Creates or edits a filtering rule, as tmail-flutter's rule creator: a
 * name, conditions on From, To, Cc, Recipient or Subject that must all or
 * any be met, and the actions (move to a folder, mark as seen, star,
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
  const { data: mailboxes = [] } = useMailboxes()
  const isPhone = useScreenSize() === 'mobile'
  const titleId = useId()
  const nameId = useId()
  const conditionsId = useId()
  const [isPreviewShown, setIsPreviewShown] = useState(false)
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
      actions: change.kind === 'reject' ? [actionDraft('reject')] : actions
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

  // The preview of tmail-flutter: `ALL of the conditions: From contains
  // "alice"`, then `Actions: Move message to folder: "Archive"`
  const conditionsPreview = t('rules.form.conditionsPreview', {
    combiner: t(`rules.combiners.${draft.combiner}`).toUpperCase(),
    conditions: draft.conditions
      .map(condition => {
        const field = ruleFieldLabel(condition.field)
        const comparator = ruleComparatorLabel(condition.comparator)
        return `${field === null ? condition.field : t(field)} ${(comparator === null ? condition.comparator : t(comparator)).toLowerCase()} "${condition.value}"`
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
        return action.kind === 'move'
          ? [
              `${label} ${t('rules.form.toFolder').toLowerCase()} "${folderName(action.mailboxId) ?? ''}"`
            ]
          : [label]
      })
      .join(', ')
  })

  // As tmail-flutter: the name above its field, then the conditions and
  // the actions each in a light grey box, the buttons adding them as
  // outlined pills
  return (
    <SettingsFormDialog
      title={t(
        rule === null ? 'rules.form.createTitle' : 'rules.form.editTitle'
      )}
      titleId={titleId}
      onClose={onClose}
      onSubmit={handleSubmit}
      isBusy={isSaving}
      labels={{
        close: t('common.close'),
        back: t('common.back'),
        cancel: t('common.cancel'),
        submit: t(rule === null ? 'rules.form.create' : 'rules.form.save')
      }}
      data-testid="rule-form-dialog"
      submitTestId="create-rule-button"
      cancelTestId="rule-cancel-button"
    >
      <SettingsFormLabel htmlFor={nameId} className="u-mb-1">
        {t('rules.form.name')}
      </SettingsFormLabel>
      <SettingsFormTextField
        id={nameId}
        inputRef={nameRef}
        autoFocus
        required
        placeholder={t('rules.form.namePlaceholder')}
        value={draft.name}
        onChange={event => {
          update({ name: event.target.value })
        }}
        error={isTouched && nameProblem !== null}
        helperText={
          isTouched && nameProblem !== null ? t(nameProblem) : undefined
        }
        inputTestId="rule-name-input"
      />
      <Box role="group" aria-labelledby={conditionsId}>
        {/* As tmail-flutter: "Preview" at the end of the label, on a
            desktop and a tablet, says what the rule does in words */}
        <Box className="u-flex u-flex-items-center u-flex-justify-between u-pv-1">
          <SettingsFormLabel component="h3" id={conditionsId}>
            {t('rules.form.conditions')}
          </SettingsFormLabel>
          {isPhone ? null : (
            <SettingsPreviewToggle
              label={t('rules.form.preview')}
              isOn={isPreviewShown}
              icons={{ on: EyeClosed, off: Eye }}
              onToggle={() => {
                setIsPreviewShown(shown => !shown)
              }}
              data-testid="rule-preview-toggle"
            />
          )}
        </Box>
        {isPreviewShown && !isPhone ? (
          <SettingsPreviewBanner
            kind="condition"
            icon={InfoCircle}
            title={`${t('rules.form.preview')}:`}
            message={conditionsPreview}
            className="u-mb-1"
            data-testid="rule-conditions-preview"
          />
        ) : null}
        {/* As tmail-flutter: on a phone the select fills the row and what
            follows it goes under it */}
        <Box className="u-flex u-flex-items-center u-flex-wrap">
          <SettingsFormText className="u-mr-1">
            {t('rules.form.combinerBefore')}
          </SettingsFormText>
          <SettingsFormSelect
            label={t('rules.form.combiner')}
            width={isPhone ? undefined : 158}
            value={draft.combiner}
            onChange={event => {
              update({ combiner: event.target.value === 'OR' ? 'OR' : 'AND' })
            }}
            inputTestId="rule-combiner-select"
          >
            <option value="AND">{t('rules.combiners.AND')}</option>
            <option value="OR">{t('rules.combiners.OR')}</option>
          </SettingsFormSelect>
          {isPhone ? null : (
            <SettingsFormText className="u-ml-1">
              {t('rules.form.combinerAfter')}
            </SettingsFormText>
          )}
        </Box>
        {isPhone ? (
          <SettingsFormText className="u-db u-mt-half">
            {t('rules.form.combinerAfter')}
          </SettingsFormText>
        ) : null}
        {draft.conditions.map((condition, index) => {
          const position = index + 1
          const fieldLabel = ruleFieldLabel(condition.field)
          const comparatorLabel = ruleComparatorLabel(condition.comparator)
          const problemKey = valueProblem(condition.value)
          return (
            <SettingsFormBox
              key={index}
              label={t('rules.form.condition', { position })}
              data-testid="rule-condition"
            >
              {/* As tmail-flutter: one under the other on a phone */}
              <SettingsFormStack isStacked={isPhone}>
                <SettingsFormSelect
                  label={t('rules.form.field')}
                  value={condition.field}
                  onChange={event => {
                    updateCondition(index, {
                      field:
                        RULE_FIELDS.find(
                          field => field === event.target.value
                        ) ?? condition.field
                    })
                  }}
                  inputTestId="rule-condition-field-select"
                >
                  {fieldLabel === null ? (
                    <option value={condition.field}>{condition.field}</option>
                  ) : null}
                  {RULE_FIELDS.map(field => (
                    <option key={field} value={field}>
                      {t(ruleFieldLabel(field) ?? 'rules.fields.from')}
                    </option>
                  ))}
                </SettingsFormSelect>
                <SettingsFormSelect
                  label={t('rules.form.comparator')}
                  value={condition.comparator}
                  onChange={event => {
                    updateCondition(index, {
                      comparator:
                        RULE_COMPARATORS.find(
                          comparator => comparator === event.target.value
                        ) ?? condition.comparator
                    })
                  }}
                  inputTestId="rule-condition-comparator-select"
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
                </SettingsFormSelect>
                <SettingsFormTextField
                  isInRow
                  required
                  label={t('rules.form.value')}
                  placeholder={t('rules.form.value')}
                  value={condition.value}
                  onChange={event => {
                    updateCondition(index, { value: event.target.value })
                  }}
                  error={problemKey !== null}
                  helperText={problemKey === null ? undefined : t(problemKey)}
                  inputTestId="rule-condition-value-input"
                />
              </SettingsFormStack>
              <IconAction
                label={t('rules.form.removeCondition', { position })}
                icon={Trash}
                tone="steel"
                size={36}
                onClick={() => {
                  update({
                    conditions: draft.conditions.filter(
                      (_condition, other) => other !== index
                    )
                  })
                }}
                data-testid="rule-condition-remove-button"
              />
            </SettingsFormBox>
          )
        })}
        <SettingsOutlinedButton
          label={t('rules.form.addCondition')}
          icon={Plus}
          className="u-mt-1"
          onClick={() => {
            update({ conditions: [...draft.conditions, emptyCondition()] })
          }}
          data-testid="rule-add-condition-button"
        />
      </Box>
      <Box component="fieldset" className="u-bdw-0 u-p-0 u-m-0 u-mt-1-half">
        <SettingsFormLabel component="legend" className="u-pb-half">
          {t('rules.form.actions')}
        </SettingsFormLabel>
        {isPreviewShown && !isPhone ? (
          <SettingsPreviewBanner
            kind="action"
            icon={Check}
            title={`${t('rules.form.preview')}:`}
            message={actionsPreview}
            className="u-mv-half"
            data-testid="rule-actions-preview"
          />
        ) : null}
        {draft.actions.map((action, index) => {
          const position = index + 1
          const folder = folderName(action.mailboxId)
          return (
            <SettingsFormBox
              key={index}
              label={t('rules.form.action', { position })}
              kind="action"
              data-testid="rule-action"
            >
              <SettingsFormSelect
                label={t('rules.form.action', { position })}
                value={action.kind ?? ''}
                onChange={event => {
                  const kind = RULE_ACTION_KINDS.find(
                    candidate => candidate === event.target.value
                  )
                  updateAction(index, actionDraft(kind ?? null))
                }}
                inputTestId="rule-action-select"
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
              </SettingsFormSelect>
              {action.kind === 'move' ? (
                <>
                  <SettingsFormText className="u-ellipsis">
                    {t('rules.form.toFolder')}
                  </SettingsFormText>
                  <SettingsFormFieldButton
                    value={folder}
                    hint={t('rules.form.chooseFolder')}
                    label={t('rules.form.chooseFolder')}
                    onClick={() => {
                      handleChooseFolder(index)
                    }}
                    data-testid="rule-action-folder-button"
                  />
                </>
              ) : null}
              {action.kind === 'forward' ? (
                <>
                  <SettingsFormTextField
                    isInRow
                    required
                    label={t('rules.form.forwardAddresses')}
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
                    inputMode="email"
                    inputTestId="rule-action-forward-input"
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
              <IconAction
                label={t('rules.form.removeAction', { position })}
                icon={Trash}
                tone="steel"
                size={36}
                onClick={() => {
                  update({
                    actions: draft.actions.filter(
                      (_action, other) => other !== index
                    )
                  })
                }}
                data-testid="rule-action-remove-button"
              />
            </SettingsFormBox>
          )
        })}
        {hasReject ? (
          <Typography variant="body2" color="textPrimary" className="u-mt-1">
            {t('rules.form.rejectAlone')}
          </Typography>
        ) : draft.actions.length < MAX_ACTIONS ? (
          <SettingsOutlinedButton
            label={t('rules.form.addAction')}
            icon={Plus}
            className="u-mt-1"
            onClick={() => {
              update({
                actions: [...draft.actions, actionDraft()]
              })
            }}
            data-testid="rule-add-action-button"
          />
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
    </SettingsFormDialog>
  )
}
