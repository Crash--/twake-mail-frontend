import { Icon } from '@linagora/twake-icons'
import { IconButton, Tooltip, Typography } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router'

import {
  AppTopBar,
  type AppTopBarSearchActions
} from '@/ds/AppTopBar/AppTopBar'
import { ArrowBack, Cancel } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useCurrentMailboxName } from '@common/features/mailbox/useCurrentMailboxName'
import { LABEL_PATH } from '@common/features/labels/labelPaths'
import { useLabels } from '@common/features/labels/queries'
import {
  SETTINGS_PATH,
  SETTINGS_SECTIONS
} from '@common/features/settings/sections'
import {
  isSettingsExitState,
  SETTINGS_EXIT_STATE,
  useSettingsExitPath
} from '@common/features/settings/SettingsExitProvider'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import {
  ListFilterSlot,
  useSelectionBarSlotRef
} from '@common/features/thread/ListFilterProvider'
import { usePlatformStatus } from '@common/features/platform/PlatformProvider'
import { useI18n } from '@common/i18n/useI18n'

import { HelpButton } from './HelpButton'
import { MailSearchBar } from './MailSearchBar'
import { SettingsButton } from './SettingsButton'

export interface TopBarProps {
  /** Opens the folder drawer */
  onOpenFolders: () => void
}

/**
 * The bar of the mail below the desktop size, as tmail-flutter's: a button
 * opening the folders, the current folder, the filter of the list (and the
 * help and the settings under the bar of Twake Workplace; without it the
 * drawer holds them), and the search under it (not in the settings)
 */
export function TopBar({ onOpenFolders }: TopBarProps): ReactElement {
  const { t } = useI18n()
  const screenSize = useScreenSize()
  const isDesktop = screenSize === 'desktop'
  const isPlatformActive = usePlatformStatus() !== 'public'
  const mailboxName = useCurrentMailboxName()
  const isSearch = useMatch('/search/*') !== null
  // As tmail-flutter's search view: the back button and the search fill
  // the bar while results show
  const isSearchView = useMatch('/search') !== null
  const navigate = useNavigate()
  const isSettings = useMatch(`${SETTINGS_PATH}/*`) !== null
  // As tmail-flutter: the menu of the settings closes with a cross, its
  // title in the middle of the bar
  const isSettingsMenu = useMatch(SETTINGS_PATH) !== null
  // A section of them: the arrow back to that menu, its name
  const sectionId = useMatch(`${SETTINGS_PATH}/:sectionId/*`)?.params.sectionId
  const section =
    SETTINGS_SECTIONS.find(candidate => candidate.id === sectionId) ?? null
  const settingsExitPath = useSettingsExitPath()
  const labelId = useMatch(`${LABEL_PATH}/:labelId/*`)?.params.labelId
  const labelName =
    useLabels().data?.list.find(label => label.id === labelId)?.displayName ??
    null
  const folderName = isSettings
    ? section === null
      ? t('settings.title')
      : t(section.title)
    : isSearch
      ? t('search.title')
      : (labelName ?? mailboxName)
  const searchActions = useRef<AppTopBarSearchActions>(null)
  // As tmail-flutter: the selection bar takes the place of the app bar
  const selectionSlotRef = useSelectionBarSlotRef()
  // Without the platform the settings open from the drawer, which "Back to
  // mail" finds closed: the button that opened it takes the focus back
  const menuRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const isBackFromSettings = isSettingsExitState(location.state)
  useEffect(() => {
    if (!isBackFromSettings || isPlatformActive) return undefined
    // After the page under it took the focus on its way in
    const timer = window.setTimeout(() => {
      menuRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isBackFromSettings, isPlatformActive, location.key])
  // On desktops the search is in the page, which handles the shortcut
  useShortcuts(
    { '/': () => searchActions.current?.focusSearch() },
    () => !isDesktop
  )
  const folderTitle =
    folderName === null ? null : (
      <Typography
        variant="h4"
        component="span"
        noWrap
        data-testid="top-bar-folder-name"
      >
        {folderName}
      </Typography>
    )

  return (
    <AppTopBar
      title={folderTitle}
      search={
        isSettings ? null : (
          <MailSearchBar size={isSearchView ? 'bare' : 'compact'} />
        )
      }
      actions={
        <>
          <ListFilterSlot />
          {/* Without the platform they are in the drawer, as tmail-flutter */}
          {isPlatformActive ? (
            <>
              <HelpButton />
              <SettingsButton />
            </>
          ) : null}
        </>
      }
      menu={{
        label: t('topbar.showFolders'),
        onOpen: onOpenFolders,
        'data-testid': 'mobile-mailbox-menu-button'
      }}
      menuButtonRef={menuRef}
      searchActions={searchActions}
      overlayRef={selectionSlotRef}
      start={
        isSettingsMenu ? (
          <Tooltip title={t('settings.backToMail')}>
            <IconButton
              component={Link}
              to={settingsExitPath}
              state={SETTINGS_EXIT_STATE}
              aria-label={t('settings.backToMail')}
              data-testid="settings-back-button"
            >
              <Icon icon={Cancel} size={24} />
            </IconButton>
          </Tooltip>
        ) : section !== null && !isDesktop ? (
          <Tooltip title={t('common.back')}>
            <IconButton
              component={Link}
              to={SETTINGS_PATH}
              aria-label={t('common.back')}
              data-testid="settings-section-back-button"
            >
              <Icon icon={ArrowBack} size={24} />
            </IconButton>
          </Tooltip>
        ) : undefined
      }
      startTitle={section === null ? 'strong' : 'plain'}
      back={
        isSearchView
          ? {
              label: t('search.backToMailbox'),
              onBack: () => {
                void navigate('/')
              },
              'data-testid': 'search-results-back-button'
            }
          : undefined
      }
      data-testid="top-bar"
    />
  )
}
