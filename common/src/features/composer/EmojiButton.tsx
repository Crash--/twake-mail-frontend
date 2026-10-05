import { IconButton, Tooltip } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { EmojiPicker, type EmojiEntry } from '@/ds/EmojiPicker/EmojiPicker'
import { EditorIcon } from '@/ds/RichTextEditor/editorIcons'
import { useI18n } from '@common/i18n/useI18n'

import {
  keepDrawable,
  loadEmojis,
  readRecentEmojis,
  rememberEmoji
} from './emojiData'

export interface EmojiButtonProps {
  /** Inserts the emoji at the caret and gives the focus back to the text */
  onInsert: (emoji: string) => void
  /** The picker closed without a pick: gives the focus back to the text */
  onDismiss: () => void
}

/**
 * The emoji button of the composer's footer and its picker. The dataset is
 * loaded, in the language of the UI, the first time the picker opens.
 */
export function EmojiButton({
  onInsert,
  onDismiss
}: EmojiButtonProps): ReactElement {
  const { t, lang } = useI18n()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [emojis, setEmojis] = useState<{
    lang: string
    list: EmojiEntry[]
  } | null>(null)
  const [recent, setRecent] = useState<string[]>(() => readRecentEmojis())
  const label = t('composer.emoji.open')

  const handleOpen = (button: HTMLElement): void => {
    setAnchor(button)
    setRecent(readRecentEmojis())
    if (emojis?.lang === lang) return
    loadEmojis(lang)
      .then(list => {
        setEmojis({ lang, list: keepDrawable(list) })
      })
      .catch((error: unknown) => {
        console.error(error)
      })
  }

  const handleClose = (): void => {
    setAnchor(null)
  }

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          size="medium"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          onClick={event => {
            handleOpen(event.currentTarget)
          }}
          className="u-ml-half"
          data-testid="composer-emoji-button"
        >
          <EditorIcon name="emoji" fontSize="medium" />
        </IconButton>
      </Tooltip>
      <EmojiPicker
        anchor={anchor}
        emojis={emojis?.lang === lang ? emojis.list : null}
        recent={recent}
        labels={{
          title: t('composer.emoji.title'),
          search: t('composer.emoji.search'),
          noResults: t('composer.emoji.noResults'),
          loading: t('composer.emoji.loading'),
          recent: t('composer.emoji.recent'),
          categories: t('composer.emoji.categories'),
          groups: {
            people: t('composer.emoji.groups.people'),
            animals: t('composer.emoji.groups.animals'),
            food: t('composer.emoji.groups.food'),
            activities: t('composer.emoji.groups.activities'),
            travel: t('composer.emoji.groups.travel'),
            objects: t('composer.emoji.groups.objects'),
            symbols: t('composer.emoji.groups.symbols'),
            flags: t('composer.emoji.groups.flags')
          }
        }}
        onPick={emoji => {
          setRecent(rememberEmoji(emoji))
          handleClose()
          onInsert(emoji)
        }}
        onClose={() => {
          handleClose()
          onDismiss()
        }}
        data-testid="composer-emoji-picker"
      />
    </>
  )
}
