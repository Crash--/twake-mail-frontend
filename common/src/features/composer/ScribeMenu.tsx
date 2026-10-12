import { Icon } from '@linagora/twake-icons'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement
} from 'react'

import { ActionIconButton } from '@/ds/ActionIconButton/ActionIconButton'
import { AiScribeBar } from '@/ds/AiScribeBar/AiScribeBar'
import {
  AiScribeMenu,
  type AiScribeMenuCategory
} from '@/ds/AiScribeMenu/AiScribeMenu'
import { AiScribePopover } from '@/ds/AiScribePopover/AiScribePopover'
import {
  AiScribeSuggestion,
  type AiScribeSuggestionState
} from '@/ds/AiScribeSuggestion/AiScribeSuggestion'
import {
  AiBullets,
  AiChangeTone,
  AiEmojify,
  AiGrammar,
  AiImprove,
  AiMoreCasual,
  AiMoreDetail,
  AiMorePolite,
  AiMoreProfessional,
  AiShorter,
  AiTranslate,
  AssistantColor,
  Bottom,
  CloseDialog,
  Copy,
  RetryArrows,
  SendArrow,
  Sparkle,
  Warning
} from '@/ds/FlutterIcons/FlutterIcons'
import { useAuthService } from '@common/features/auth/AuthProvider'
import { useScribePreference } from '@common/features/scribe/scribePreference'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import {
  actionMessages,
  askScribe,
  SCRIBE_ACTIONS,
  scribeEndpoint,
  writingMessages,
  type ScribeAction,
  type ScribeCategory,
  type ScribeMessage
} from '@common/features/scribe/scribe'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

const CATEGORY_LABELS: Record<ScribeCategory, TranslationKey> = {
  correct: 'composer.scribe.correct',
  improve: 'composer.scribe.improve',
  tone: 'composer.scribe.tone',
  translate: 'composer.scribe.translate'
}

/** tmail-flutter's order (`AIScribeMenuCategory.values`) and icons */
const CATEGORIES: readonly {
  id: ScribeCategory
  icon: AiScribeMenuCategory['icon']
}[] = [
  { id: 'correct', icon: AiGrammar },
  { id: 'translate', icon: AiTranslate },
  { id: 'tone', icon: AiChangeTone },
  { id: 'improve', icon: AiImprove }
]

/** The icons of the actions (`AIScribeMenuAction.getIcon`); none for a language */
const ACTION_ICONS: Partial<Record<string, AiScribeMenuCategory['icon']>> = {
  'make-shorter': AiShorter,
  'expand-context': AiMoreDetail,
  emojify: AiEmojify,
  'transform-to-bullets': AiBullets,
  'change-tone-professional': AiMoreProfessional,
  'change-tone-casual': AiMoreCasual,
  'change-tone-polite': AiMorePolite
}

/** What the assistant works on */
export interface ScribeInput {
  text: string
  /** The text is the selection: the answer can replace it */
  isSelection: boolean
}

export interface ScribeMenuProps {
  /** The selection, else what the user wrote */
  getInput: () => ScribeInput
  /** Replaces the selection with the answer */
  onReplace: (text: string) => void
  /** Inserts the answer where the caret is (after the selection) */
  onInsert: (text: string) => void
  /**
   * Another button (the one following the selection) the menu opens on, as
   * if the toolbar button had been pressed; null to leave it closed
   */
  externalAnchor?: HTMLElement | null
  /** The menu opened on `externalAnchor` closed */
  onExternalClose?: () => void
}

type Request =
  | { kind: 'action'; action: ScribeAction; input: ScribeInput }
  | { kind: 'write'; task: string; input: ScribeInput }

/**
 * The AI assistant of the composer, as tmail-flutter's scribe: its button
 * opens, above it, the menu of the actions on the selection or on what the
 * user wrote (correct, translate, change the tone, improve; the categories
 * of several actions open them beside) and the "Help me write" prompt (alone
 * when there is nothing written yet). The answer shows in a card above the
 * button, to insert, to replace the selection with, to improve again, to
 * copy, or to ask again. Offered only when the server has an assistant
 * (`com:linagora:params:jmap:aibot`).
 */
export function ScribeMenu({
  getInput,
  onReplace,
  onInsert,
  externalAnchor = null,
  onExternalClose
}: ScribeMenuProps): ReactElement | null {
  const { t } = useI18n()
  const { notify } = useNotify()
  const service = useAuthService()
  const { session, accountId } = useJmapSession()
  const endpoint = scribeEndpoint(session, accountId)
  const [isScribeOn] = useScribePreference()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  // What the menu works on, read when it opens
  const [menuInput, setMenuInput] = useState<ScribeInput | null>(null)
  const [request, setRequest] = useState<Request | null>(null)
  const [answer, setAnswer] = useState<AiScribeSuggestionState>({
    status: 'loading'
  })
  // The element the answer opened above
  const [answerAnchor, setAnswerAnchor] = useState<HTMLElement | null>(null)
  // "Improve": the menu again, on the answer
  const [improveAnchor, setImproveAnchor] = useState<HTMLElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    []
  )

  const menuAnchor = anchor ?? externalAnchor
  const isMenuOpen = menuAnchor !== null
  // The other button opened the menu: read what it works on, once
  const [lastExternal, setLastExternal] = useState<HTMLElement | null>(null)
  if (externalAnchor !== lastExternal) {
    setLastExternal(externalAnchor)
    if (externalAnchor !== null) setMenuInput(getInput())
  }

  // Offered when the server has an assistant and the user did not hide it
  if (endpoint === null || !isScribeOn) return null

  const ask = (messages: ScribeMessage[]): void => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAnswer({ status: 'loading' })
    service
      .getAuthorizationHeader()
      .then(authorization =>
        askScribe(endpoint, messages, authorization, {
          signal: controller.signal
        })
      )
      .then(result => {
        if (controller.signal.aborted) return
        setAnswer(
          result.ok
            ? { status: 'done', text: result.value }
            : { status: 'failed' }
        )
      })
      .catch((error: unknown) => {
        console.warn('[scribe] The assistant did not answer', error)
        if (!controller.signal.aborted) setAnswer({ status: 'failed' })
      })
  }

  const messagesOf = (next: Request): ScribeMessage[] =>
    next.kind === 'action'
      ? actionMessages(next.action, next.input.text)
      : writingMessages(next.task, next.input.text)

  const run = (next: Request): void => {
    setRequest(next)
    ask(messagesOf(next))
  }

  const closeMenu = (): void => {
    setAnchor(null)
    onExternalClose?.()
  }

  const findAction = (actionId: string): ScribeAction | null =>
    SCRIBE_ACTIONS.find(action => action.id === actionId) ?? null

  const handleAction = (actionId: string): void => {
    const action = findAction(actionId)
    const input = menuInput ?? getInput()
    setAnswerAnchor(menuAnchor)
    closeMenu()
    if (action !== null) run({ kind: 'action', action, input })
  }

  const handleWrite = (task: string): void => {
    const input = menuInput ?? getInput()
    setAnswerAnchor(menuAnchor)
    closeMenu()
    run({ kind: 'write', task, input })
  }

  // "Improve": the chosen action, on the answer
  const handleImproveAction = (actionId: string): void => {
    const action = findAction(actionId)
    setImproveAnchor(null)
    if (action === null || answer.status !== 'done' || request === null) {
      return
    }
    run({
      kind: 'action',
      action,
      input: { text: answer.text, isSelection: request.input.isSelection }
    })
  }

  // The clipboard of the window clicked in: the menu may be on the overlay of
  // TwakeSpace, and a window without the focus may not write to it
  const handleCopy = (event: MouseEvent<HTMLElement>): void => {
    if (answer.status !== 'done') return
    const view = event.currentTarget.ownerDocument.defaultView ?? window
    view.navigator.clipboard
      .writeText(answer.text)
      .then(() => {
        notify({ message: t('composer.scribe.copied') })
      })
      .catch((error: unknown) => {
        console.warn('[scribe] Cannot copy the suggestion', error)
        notify({ message: t('common.errorOccurredShort'), severity: 'error' })
      })
  }

  const handleClose = (): void => {
    abortRef.current?.abort()
    setRequest(null)
    setImproveAnchor(null)
    setAnswer({ status: 'loading' })
  }

  const handleRetry = (): void => {
    if (request !== null) ask(messagesOf(request))
  }

  const handleInsert = (): void => {
    if (answer.status === 'done') onInsert(answer.text)
    handleClose()
  }

  const handleReplace = (): void => {
    if (answer.status === 'done') onReplace(answer.text)
    handleClose()
  }

  const categories: AiScribeMenuCategory[] = CATEGORIES.map(category => ({
    id: category.id,
    label: t(CATEGORY_LABELS[category.id]),
    icon: category.icon,
    actions: SCRIBE_ACTIONS.filter(
      action => action.category === category.id
    ).map(action => ({
      id: action.id,
      label: t(action.label),
      icon: ACTION_ICONS[action.id] ?? null
    }))
  }))

  // tmail-flutter's `getFullLabel`: "Change tone > More casual"
  const titleOf = (next: Request): string => {
    if (next.kind === 'write') return t('composer.scribe.helpMeWrite')
    const { action } = next
    const isAlone =
      SCRIBE_ACTIONS.filter(other => other.category === action.category)
        .length < 2
    return isAlone
      ? t(action.label)
      : `${t(CATEGORY_LABELS[action.category])} > ${t(action.label)}`
  }

  const hasText = (menuInput?.text.trim() ?? '') !== ''
  const menuLabel = t('composer.scribe.assistant')

  return (
    <>
      <ActionIconButton
        label={menuLabel}
        aria-haspopup="true"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={event => {
          // Read once per opening: the selection may change while it is open
          setMenuInput(getInput())
          setAnchor(event.currentTarget)
        }}
        className="u-ml-half"
        data-testid="composer-scribe-button"
      >
        <Icon icon={AssistantColor} size={24} aria-hidden="true" />
      </ActionIconButton>
      <AiScribePopover
        open={isMenuOpen}
        anchorEl={menuAnchor}
        onClose={closeMenu}
        label={menuLabel}
        data-testid="composer-scribe-menu"
      >
        {/* As tmail-flutter: nothing to work on yet, only the prompt */}
        {hasText ? (
          <AiScribeMenu
            label={menuLabel}
            categories={categories}
            onSelect={handleAction}
            data-testid="composer-scribe-actions"
          />
        ) : null}
        <AiScribeBar
          label={t('composer.scribe.helpMeWrite')}
          sendLabel={t('composer.send')}
          sendIcon={SendArrow}
          onSubmit={handleWrite}
          autoFocus
          data-testid="composer-scribe-task"
        />
      </AiScribePopover>
      <AiScribeSuggestion
        open={request !== null}
        anchorEl={answerAnchor}
        title={request === null ? '' : titleOf(request)}
        state={answer}
        labels={{
          close: t('common.close'),
          generating: t('composer.scribe.generating'),
          failed: t('composer.scribe.failed'),
          result: t('composer.scribe.result'),
          copy: t('composer.scribe.copy'),
          retry: t('composer.scribe.retry'),
          improve: t('composer.scribe.improve'),
          replace: t('composer.scribe.replace'),
          insert: t('composer.scribe.insert')
        }}
        icons={{
          sparkle: Sparkle,
          warning: Warning,
          close: CloseDialog,
          copy: Copy,
          retry: RetryArrows,
          chevron: Bottom
        }}
        onClose={handleClose}
        onCopy={handleCopy}
        onRetry={handleRetry}
        onImprove={setImproveAnchor}
        onReplace={request?.input.isSelection === true ? handleReplace : null}
        onInsert={handleInsert}
        data-testid="composer-scribe-dialog"
      />
      <AiScribePopover
        open={improveAnchor !== null}
        anchorEl={improveAnchor}
        onClose={() => {
          setImproveAnchor(null)
        }}
        label={t('composer.scribe.improve')}
        data-testid="composer-scribe-improve-menu"
      >
        <AiScribeMenu
          label={t('composer.scribe.improve')}
          categories={categories}
          onSelect={handleImproveAction}
        />
      </AiScribePopover>
    </>
  )
}
