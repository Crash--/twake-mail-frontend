import { useEffect, useMemo, useState, type ReactElement } from 'react'

import { EmojiPicker, type EmojiEntry } from '@/ds/EmojiPicker/EmojiPicker'
import { useI18n } from '@common/i18n/useI18n'

import {
  keepDrawable,
  loadEmojis,
  readRecentEmojis,
  rememberEmoji
} from './emojiData'

export interface ComposerEmojiPickerProps {
  /** What the picker opens on, null while closed */
  anchor: HTMLElement | null
  onClose: () => void
  /** Inserts the emoji at the caret and gives the focus back to the text */
  onInsert: (emoji: string) => void
  /** The picker closed without a pick: gives the focus back to the text */
  onDismiss: () => void
}

/**
 * The emoji picker of the composer, opened from its "More" menu. The dataset
 * is loaded, in the language of the UI, the first time the picker opens.
 */
export function ComposerEmojiPicker({
  anchor,
  onClose,
  onInsert,
  onDismiss
}: ComposerEmojiPickerProps): ReactElement {
  const { t, lang } = useI18n()
  const [emojis, setEmojis] = useState<{
    lang: string
    list: EmojiEntry[]
  } | null>(null)
  const loadedLang = emojis?.lang
  const recent = useMemo(
    () => (anchor === null ? [] : readRecentEmojis()),
    [anchor]
  )

  useEffect(() => {
    if (anchor === null || loadedLang === lang) return
    loadEmojis(lang)
      .then(list => {
        setEmojis({ lang, list: keepDrawable(list) })
      })
      .catch((error: unknown) => {
        console.error(error)
      })
  }, [anchor, lang, loadedLang])

  return (
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
        rememberEmoji(emoji)
        onClose()
        onInsert(emoji)
      }}
      onClose={() => {
        onClose()
        onDismiss()
      }}
      data-testid="composer-emoji-picker"
    />
  )
}
