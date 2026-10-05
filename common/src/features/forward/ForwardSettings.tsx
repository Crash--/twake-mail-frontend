import { Attention, Icon, Trash } from '@linagora/twake-icons'
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListSkeleton,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement
} from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useAppConfig } from '@common/config/AppConfigProvider'
import {
  isValidEmail,
  parseRecipients
} from '@common/features/composer/recipients'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  domainOf,
  forwardKeys,
  forwardQueryOptions,
  updateForward
} from './queries'

export interface ForwardSettingsProps {
  section: SettingsSection
}

/**
 * Settings > Forwarding (`Forward/get`, `Forward/set`), as tmail-flutter:
 * the addresses every email goes to, added after a warning when they are
 * outside the domain of the account, removed after a confirmation, and
 * "Keep a copy in Inbox" once there is one. The warning of the deployment
 * (`FORWARD_WARNING_MESSAGE`) replaces the default one.
 */
export function ForwardSettings({
  section
}: ForwardSettingsProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, session } = useJmapSession()
  const { notify } = useNotify()
  const confirm = useConfirm()
  const configuredWarning = useAppConfig()?.forwardWarningMessage ?? null
  const query = useQuery(forwardQueryOptions(client, accountId))
  const inputRef = useRef<HTMLInputElement>(null)
  const localCopyDescriptionId = useId()
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState<TranslationKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const ownDomain = domainOf(session.username)
  const forwards = query.data?.forwards ?? []
  const isExternal = (email: string): boolean => domainOf(email) !== ownDomain
  const hasExternal = forwards.some(isExternal)

  const change = async (
    next: Partial<Parameters<typeof updateForward>[2]>,
    success: TranslationKey,
    failure: TranslationKey
  ): Promise<boolean> => {
    setIsSaving(true)
    try {
      const isSaved = await updateForward(client, accountId, {
        forwards,
        localCopy: query.data?.localCopy ?? true,
        ...next
      })
      await queryClient.invalidateQueries({
        queryKey: forwardKeys.all(accountId)
      })
      notify(
        isSaved
          ? { message: t(success), severity: 'success' }
          : { message: t(failure), severity: 'error' }
      )
      return isSaved
    } catch (error: unknown) {
      console.error('[forward] Cannot change the forwarding', error)
      notify({ message: t(failure), severity: 'error' })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleAdd = (event: FormEvent): void => {
    event.preventDefault()
    const emails = parseRecipients(typed).map(recipient => recipient.email)
    if (emails.length === 0) {
      setProblem('forward.errors.empty')
      inputRef.current?.focus()
      return
    }
    if (emails.some(email => !isValidEmail(email))) {
      setProblem('forward.errors.invalid')
      inputRef.current?.focus()
      return
    }
    const added = emails.filter(
      email =>
        !forwards.some(other => other.toLowerCase() === email.toLowerCase())
    )
    const run = async (): Promise<void> => {
      if (added.some(isExternal)) {
        const isConfirmed = await confirm({
          title: t('forward.externalWarning.title'),
          message: configuredWarning ?? t('forward.externalWarning.message'),
          confirmLabel: t('common.yes')
        })
        if (!isConfirmed) return
      }
      const isSaved = await change(
        { forwards: [...forwards, ...added] },
        'forward.toasts.added',
        'forward.errors.add'
      )
      if (isSaved) setTyped('')
    }
    run().catch((error: unknown) => {
      console.error('[forward] Cannot add the recipients', error)
    })
  }

  const handleRemove = (email: string): void => {
    const run = async (): Promise<void> => {
      const isConfirmed = await confirm({
        title: t('forward.delete.title'),
        message: t('forward.delete.message', { emailAddress: email }),
        confirmLabel: t('common.remove'),
        isDestructive: true
      })
      if (!isConfirmed) return
      await change(
        { forwards: forwards.filter(other => other !== email) },
        'forward.toasts.deleted',
        'forward.errors.delete'
      )
    }
    run().catch((error: unknown) => {
      console.error('[forward] Cannot remove the recipient', error)
    })
  }

  const handleLocalCopy = (event: ChangeEvent<HTMLInputElement>): void => {
    const localCopy = event.target.checked
    void change(
      { localCopy },
      localCopy ? 'forward.toasts.localCopyOn' : 'forward.toasts.localCopyOff',
      'forward.errors.localCopy'
    )
  }

  if (query.isPending) {
    return (
      <SettingsSectionLayout section={section}>
        <ListSkeleton count={2} />
      </SettingsSectionLayout>
    )
  }

  if (query.isError) {
    return (
      <SettingsSectionLayout section={section}>
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
          {t('forward.errors.load')}
        </Alert>
      </SettingsSectionLayout>
    )
  }

  return (
    <SettingsSectionLayout section={section}>
      {hasExternal ? (
        <Alert
          severity="warning"
          className="u-mb-1"
          data-testid="forward-warning-banner"
        >
          {configuredWarning ?? t('forward.externalBanner')}
        </Alert>
      ) : null}
      {forwards.length > 0 ? (
        <Box className="u-mb-1">
          <FormControlLabel
            control={
              <Switch
                checked={query.data.localCopy}
                disabled={isSaving}
                onChange={handleLocalCopy}
                slotProps={{
                  input: { 'aria-describedby': localCopyDescriptionId }
                }}
                data-testid="forward-local-copy-toggle"
              />
            }
            label={t('forward.localCopy')}
          />
          <SecondaryText
            id={localCopyDescriptionId}
            variant="body2"
            component="p"
          >
            {t('forward.localCopyDescription')}
          </SecondaryText>
        </Box>
      ) : null}
      <Box
        component="form"
        onSubmit={handleAdd}
        noValidate
        className="u-flex u-flex-items-start u-flex-wrap"
      >
        <TextField
          inputRef={inputRef}
          size="small"
          className="u-flex-auto u-mr-half"
          label={t('forward.inputLabel')}
          placeholder={t('forward.inputPlaceholder')}
          value={typed}
          onChange={event => {
            setTyped(event.target.value)
            setProblem(null)
          }}
          error={problem !== null}
          helperText={problem === null ? ' ' : t(problem)}
          slotProps={{
            htmlInput: { inputMode: 'email', 'data-testid': 'forward-input' }
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={isSaving}
          data-testid="forward-add-button"
        >
          {t('forward.add')}
        </Button>
      </Box>
      {forwards.length > 0 ? (
        <>
          <Typography
            variant="subtitle1"
            component="h2"
            color="textPrimary"
            className="u-fw-bold u-mt-1"
          >
            {t('forward.recipients')}
          </Typography>
          <List aria-label={t('forward.listLabel')} data-testid="forward-list">
            {forwards.map(email => {
              const removeLabel = t('forward.removeOf', { email })
              return (
                <ListItem
                  key={email}
                  divider
                  data-testid="forward-item"
                  data-email={email}
                >
                  <Box className="u-flex-auto u-ov-hidden">
                    <Typography className="u-breakword">{email}</Typography>
                    {isExternal(email) ? (
                      <Box className="u-flex u-flex-items-center">
                        <Icon icon={Attention} size={12} aria-hidden />
                        <SecondaryText variant="caption" className="u-ml-half">
                          {t('forward.external')}
                        </SecondaryText>
                      </Box>
                    ) : null}
                  </Box>
                  <Tooltip title={removeLabel}>
                    <IconButton
                      aria-label={removeLabel}
                      disabled={isSaving}
                      onClick={() => {
                        handleRemove(email)
                      }}
                      data-testid="forward-remove-button"
                    >
                      <Icon icon={Trash} />
                    </IconButton>
                  </Tooltip>
                </ListItem>
              )
            })}
          </List>
        </>
      ) : null}
    </SettingsSectionLayout>
  )
}
