import { AssistantColor, Copy, Icon } from '@linagora/twake-icons'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useEffect, useId, useRef, useState, type ReactElement } from 'react'

import { ActionIconButton } from '@/ds/ActionIconButton/ActionIconButton'
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

const CATEGORIES: readonly ScribeCategory[] = [
  'correct',
  'improve',
  'tone',
  'translate'
]

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
  | { kind: 'write'; input: ScribeInput }

type Answer =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'failed' }

/**
 * The AI assistant of the composer, as tmail-flutter's scribe: a menu of
 * actions on the selection or on what the user wrote (correct, improve,
 * change the tone, translate) and "Help me write"; the answer shows in a
 * dialog, to insert or to replace the selection with, or to cancel.
 * Offered only when the server has an assistant
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
  const menuId = useId()
  const titleId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [request, setRequest] = useState<Request | null>(null)
  const [task, setTask] = useState('')
  const [answer, setAnswer] = useState<Answer>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    []
  )

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
      : writingMessages(task.trim(), next.input.text)

  const handleAction = (action: ScribeAction): void => {
    closeMenu()
    const input = getInput()
    if (input.text.trim() === '') {
      notify({ message: t('composer.scribe.emptyText') })
      return
    }
    const next: Request = { kind: 'action', action, input }
    setRequest(next)
    ask(messagesOf(next))
  }

  const handleWrite = (): void => {
    closeMenu()
    setTask('')
    setAnswer({ status: 'idle' })
    setRequest({ kind: 'write', input: getInput() })
  }

  const menuAnchor = anchor ?? externalAnchor
  const closeMenu = (): void => {
    setAnchor(null)
    onExternalClose?.()
  }

  const handleCopy = (): void => {
    if (answer.status !== 'done') return
    navigator.clipboard
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
    setAnswer({ status: 'idle' })
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

  const title =
    request === null
      ? ''
      : request.kind === 'write'
        ? t('composer.scribe.helpMeWrite')
        : t(request.action.label)

  return (
    <>
      <ActionIconButton
        label={t('composer.scribe.assistant')}
        aria-haspopup="true"
        aria-controls={menuAnchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
        className="u-ml-half"
        data-testid="composer-scribe-button"
      >
        <Icon icon={AssistantColor} size={20} aria-hidden="true" />
      </ActionIconButton>
      <Menu
        id={menuId}
        anchorEl={menuAnchor}
        open={menuAnchor !== null}
        onClose={closeMenu}
        data-testid="composer-scribe-menu"
      >
        {CATEGORIES.flatMap(category => [
          <ListSubheader key={`header-${category}`} role="presentation">
            {t(CATEGORY_LABELS[category])}
          </ListSubheader>,
          ...SCRIBE_ACTIONS.filter(action => action.category === category).map(
            action => (
              <MenuItem
                key={action.id}
                onClick={() => {
                  handleAction(action)
                }}
                data-testid="composer-scribe-action"
                data-action={action.id}
              >
                {t(action.label)}
              </MenuItem>
            )
          )
        ])}
        <Divider />
        <MenuItem onClick={handleWrite} data-testid="composer-scribe-write">
          {t('composer.scribe.helpMeWrite')}
        </MenuItem>
      </Menu>
      <Dialog
        open={request !== null}
        onClose={handleClose}
        aria-labelledby={titleId}
        data-testid="composer-scribe-dialog"
      >
        <DialogTitle id={titleId}>
          {`${t('composer.scribe.assistant')} · ${title}`}
        </DialogTitle>
        <DialogContent>
          {request?.kind === 'write' ? (
            <Box className="u-flex u-flex-items-end u-mb-1">
              <TextField
                label={t('composer.scribe.task')}
                value={task}
                onChange={event => {
                  setTask(event.target.value)
                }}
                multiline
                fullWidth
                autoFocus
                data-testid="composer-scribe-task"
              />
              <Button
                variant="outlined"
                color="inherit"
                disabled={task.trim() === '' || answer.status === 'loading'}
                onClick={() => {
                  ask(messagesOf(request))
                }}
                className="u-ml-half"
                data-testid="composer-scribe-ask"
              >
                {t('composer.scribe.ask')}
              </Button>
            </Box>
          ) : null}
          <Box role="status" aria-live="polite">
            {answer.status === 'loading' ? (
              <Box className="u-flex u-flex-items-center">
                <CircularProgress size={20} aria-hidden="true" />
                <Typography className="u-ml-half">
                  {t('composer.scribe.generating')}
                </Typography>
              </Box>
            ) : null}
          </Box>
          {answer.status === 'failed' ? (
            <Alert severity="error" data-testid="composer-scribe-error">
              {t('composer.scribe.failed')}
            </Alert>
          ) : null}
          {answer.status === 'done' ? (
            <Box
              role="region"
              aria-label={t('composer.scribe.result')}
              tabIndex={0}
              className="u-p-1 u-breakword"
              data-testid="composer-scribe-result"
            >
              {answer.text.split('\n').map((line, index) => (
                // The lines of a fixed answer: their position is their identity
                <Typography key={`${index}-${line}`}>{line}</Typography>
              ))}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          {answer.status === 'failed' ? (
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleRetry}
              data-testid="composer-scribe-retry"
            >
              {t('composer.scribe.retry')}
            </Button>
          ) : null}
          {answer.status === 'done' && request?.input.isSelection === true ? (
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleReplace}
              data-testid="composer-scribe-replace"
            >
              {t('composer.scribe.replace')}
            </Button>
          ) : null}
          {answer.status === 'done' ? (
            <Tooltip title={t('composer.scribe.copy')}>
              <IconButton
                aria-label={t('composer.scribe.copy')}
                onClick={handleCopy}
                data-testid="composer-scribe-copy"
              >
                <Icon icon={Copy} size={20} aria-hidden="true" />
              </IconButton>
            </Tooltip>
          ) : null}
          {answer.status === 'done' ? (
            <Button
              variant="contained"
              onClick={handleInsert}
              autoFocus
              data-testid="composer-scribe-insert"
            >
              {t('composer.scribe.insert')}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  )
}
