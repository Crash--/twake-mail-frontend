import { Icon } from '@linagora/twake-icons'
import { Alert, Box, Button, Tooltip } from '@linagora/twake-mui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import {
  Check,
  Cross,
  InfoCircle,
  Plus,
  Trash
} from '@/ds/FlutterIcons/FlutterIcons'
import { GradientAvatar } from '@/ds/GradientAvatar/GradientAvatar'
import { IconAction } from '@/ds/IconAction/IconAction'
import { SelectableAvatar } from '@/ds/SelectableAvatar/SelectableAvatar'
import { SettingsPrimaryButton } from '@/ds/SettingsButtons/SettingsButtons'
import {
  SettingsHeaderButton,
  SettingsListHeader,
  SettingsRecipientCard
} from '@/ds/SettingsCards/SettingsCards'
import {
  SettingsLabelPill,
  SettingsTextField
} from '@/ds/SettingsFields/SettingsFields'
import { SettingsSwitchRow } from '@/ds/SettingsOption/SettingsOption'
import { useFocusFallback } from '@/ds/useFocusFallback/useFocusFallback'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useAppConfig } from '@common/config/AppConfigProvider'
import {
  isValidEmail,
  parseRecipients
} from '@common/features/composer/recipients'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
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
 * outside the domain of the account (never the account's own address),
 * removed after a confirmation, and "Keep a copy in Inbox" once there is
 * one. The warning of the deployment (`FORWARD_WARNING_MESSAGE`) replaces
 * the default one.
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
  const focusFallbackRef = useFocusFallback<HTMLSpanElement>()
  const [selected, setSelected] = useState<readonly string[]>([])
  const recipientsTitleId = useId()
  const isPhone = useScreenSize() === 'mobile'
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState<TranslationKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const ownDomain = domainOf(session.username)
  const forwards = query.data?.forwards ?? []
  const isExternal = (email: string): boolean => domainOf(email) !== ownDomain
  const hasExternal = forwards.some(isExternal)
  // The selected ones still forwarded to
  const selection = selected.filter(email => forwards.includes(email))
  const isAllSelected =
    forwards.length > 0 && selection.length === forwards.length
  const isOwnAddress = (email: string): boolean =>
    email.toLowerCase() === session.username.toLowerCase()

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

  const handleAdd = (event: SubmitEvent): void => {
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
    if (emails.some(isOwnAddress)) {
      setProblem('forward.errors.ownAddress')
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

  const handleRemoveSelected = (): void => {
    const run = async (): Promise<void> => {
      const isConfirmed = await confirm({
        title: t('forward.delete.title'),
        message: t('forward.deleteAll.message'),
        confirmLabel: t('forward.remove'),
        isDestructive: true
      })
      if (!isConfirmed) return
      const isSaved = await change(
        { forwards: forwards.filter(email => !selection.includes(email)) },
        'forward.toasts.deleted',
        'forward.errors.delete'
      )
      if (isSaved) setSelected([])
    }
    run().catch((error: unknown) => {
      console.error('[forward] Cannot remove the recipients', error)
    })
  }

  const handleLocalCopy = (localCopy: boolean): void => {
    void change(
      { localCopy },
      localCopy ? 'forward.toasts.localCopyOn' : 'forward.toasts.localCopyOff',
      'forward.errors.localCopy'
    )
  }

  if (query.isPending) {
    return (
      <SettingsSectionLayout section={section}>
        <LoadingListSkeleton count={2} />
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
        <SettingsSwitchRow
          title={t('forward.localCopy')}
          description={t('forward.localCopyDescription')}
          isChecked={query.data.localCopy}
          isDisabled={isSaving}
          onChange={handleLocalCopy}
          data-testid="forward-local-copy-toggle"
        />
      ) : null}
      <SettingsLabelPill
        component="h2"
        id={recipientsTitleId}
        label={t('forward.recipients')}
        pill={t('forward.recipientCount', { smart_count: forwards.length })}
      />
      <Box
        component="form"
        onSubmit={handleAdd}
        noValidate
        // As tmail-flutter: on a phone the field and the button fill the
        // row, one under the other
        className={
          isPhone
            ? 'u-flex u-flex-column'
            : 'u-flex u-flex-items-start u-flex-wrap'
        }
      >
        <SettingsTextField
          className={isPhone ? 'u-mb-1' : 'u-mr-1 u-mb-half'}
          width={isPhone ? '100%' : undefined}
          inputRef={inputRef}
          label={t('forward.inputLabel')}
          placeholder={t('forward.inputPlaceholder')}
          value={typed}
          onChange={event => {
            setTyped(event.target.value)
            setProblem(null)
          }}
          error={problem !== null}
          helperText={problem === null ? undefined : t(problem)}
          inputMode="email"
          inputTestId="forward-input"
        />
        <SettingsPrimaryButton
          type="submit"
          label={t('forward.add')}
          icon={Plus}
          disabled={isSaving}
          isFullWidth={isPhone}
          data-testid="forward-add-button"
        />
      </Box>
      {forwards.length > 0 ? (
        <>
          {/* As tmail-flutter: "Select all", or once some are selected the
              cross leaving the selection with how many, and "Remove" */}
          <SettingsListHeader>
            {selection.length > 0 ? (
              <SettingsHeaderButton
                label={
                  isAllSelected
                    ? t('forward.deselectAll', { count: selection.length })
                    : t('forward.selectedCount', { count: selection.length })
                }
                icon={<Icon icon={Cross} size={20} aria-hidden="true" />}
                onClick={() => {
                  setSelected([])
                }}
                data-testid="forward-cancel-selection-button"
              />
            ) : null}
            {isAllSelected ? null : (
              <SettingsHeaderButton
                label={t('forward.selectAll')}
                onClick={() => {
                  setSelected(forwards)
                }}
                data-testid="forward-select-all-button"
              />
            )}
            {selection.length > 0 ? (
              <SettingsHeaderButton
                label={t('forward.remove')}
                tone="danger"
                onClick={handleRemoveSelected}
                data-testid="forward-remove-selected-button"
              />
            ) : null}
          </SettingsListHeader>
          <Box
            component="ul"
            aria-label={t('forward.listLabel')}
            className="u-m-0 u-p-0 u-pb-2"
            data-testid="forward-list"
          >
            {forwards.map(email => {
              const removeLabel = t('forward.removeOf', { email })
              const isSelected = selection.includes(email)
              return (
                <SettingsRecipientCard
                  key={email}
                  avatar={
                    <SelectableAvatar
                      size="small"
                      checked={isSelected}
                      label={t('forward.selectOf', { email })}
                      onClick={() => {
                        setSelected(current =>
                          current.includes(email)
                            ? current.filter(other => other !== email)
                            : [...current, email]
                        )
                      }}
                      avatar={
                        <GradientAvatar
                          text={email.slice(0, 2).toUpperCase()}
                          colorKey={email}
                          size={32}
                          fontSize={14}
                        />
                      }
                      data-testid="forward-select-checkbox"
                    />
                  }
                  name={email}
                  status={
                    isExternal(email) ? (
                      <Tooltip title={t('forward.external')}>
                        <span className="u-flex">
                          <Icon
                            icon={InfoCircle}
                            size={20}
                            role="img"
                            aria-label={t('forward.external')}
                          />
                        </span>
                      </Tooltip>
                    ) : (
                      <Icon icon={Check} size={20} aria-hidden="true" />
                    )
                  }
                  isSelected={isSelected}
                  actions={
                    selection.length > 0 ? null : (
                      <span ref={focusFallbackRef}>
                        <IconAction
                          label={removeLabel}
                          icon={Trash}
                          tone="steel"
                          size={36}
                          disabled={isSaving}
                          onClick={() => {
                            handleRemove(email)
                          }}
                          data-testid="forward-remove-button"
                        />
                      </span>
                    )
                  }
                  data-testid="forward-item"
                  dataAttributes={{ 'data-email': email }}
                />
              )
            })}
          </Box>
        </>
      ) : null}
    </SettingsSectionLayout>
  )
}
