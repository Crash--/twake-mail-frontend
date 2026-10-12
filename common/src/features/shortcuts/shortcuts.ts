import type { TranslationKey } from '@common/i18n/useI18n'

/** The keys the app listens to, as `KeyboardEvent.key` gives them */
export type ShortcutKey =
  | 'c'
  | '/'
  | 'j'
  | 'k'
  | 'Escape'
  | 'e'
  | '#'
  | 's'
  | 'u'
  | 'z'
  | 'r'
  | 'R'
  | 'f'
  | '?'

/**
 * The shortcuts, in the order the help lists them; `keys` is what the help
 * shows when it is not the key itself. Reply, reply all, forward and Escape
 * (back to the list) are tmail-flutter's (r, Shift+R, f, Esc).
 */
export const SHORTCUTS: readonly {
  key: ShortcutKey
  keys?: string
  label: TranslationKey
  category: ShortcutCategory
}[] = [
  { key: 'c', label: 'shortcuts.actions.compose', category: 'navigation' },
  { key: '/', label: 'shortcuts.actions.search', category: 'navigation' },
  { key: 'j', label: 'shortcuts.actions.next', category: 'navigation' },
  { key: 'k', label: 'shortcuts.actions.previous', category: 'navigation' },
  { key: 'Escape', label: 'shortcuts.actions.close', category: 'navigation' },
  { key: 'e', label: 'shortcuts.actions.archive', category: 'management' },
  { key: '#', label: 'shortcuts.actions.delete', category: 'management' },
  { key: 's', label: 'shortcuts.actions.star', category: 'management' },
  { key: 'u', label: 'shortcuts.actions.markAsUnread', category: 'reading' },
  { key: 'r', label: 'emailActions.reply.reply', category: 'reading' },
  {
    key: 'R',
    keys: 'Shift + R',
    label: 'emailActions.reply.replyAll',
    category: 'reading'
  },
  { key: 'f', label: 'emailActions.reply.forward', category: 'reading' },
  { key: 'z', label: 'shortcuts.actions.undo', category: 'management' },
  { key: '?', label: 'shortcuts.actions.help', category: 'navigation' }
]

/**
 * tmail-flutter's categories of shortcuts (`ShortcutCategory`), in its
 * order
 */
export type ShortcutCategory = 'navigation' | 'reading' | 'management'

export const SHORTCUT_CATEGORIES: readonly {
  id: ShortcutCategory
  label: TranslationKey
  /** Below the desktop size, as tmail-flutter */
  shortLabel: TranslationKey
}[] = [
  {
    id: 'navigation',
    label: 'shortcuts.categories.navigation',
    shortLabel: 'shortcuts.categories.navigationShort'
  },
  {
    id: 'reading',
    label: 'shortcuts.categories.reading',
    shortLabel: 'shortcuts.categories.readingShort'
  },
  {
    id: 'management',
    label: 'shortcuts.categories.management',
    shortLabel: 'shortcuts.categories.managementShort'
  }
]

const KEYS = new Set<string>(SHORTCUTS.map(shortcut => shortcut.key))

export function isShortcutKey(key: string): key is ShortcutKey {
  return KEYS.has(key)
}

/**
 * Where a key press is not a shortcut: typing in a field, a key with Ctrl,
 * Alt or Meta (browser and screen reader commands; AltGr types a character), a composition (IME), a
 * key some control already handled, or one pressed in a dialog, a menu or a
 * list box, whose keys belong to them.
 */
const OWNED_BY_CONTROL = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]'
].join(',')

/**
 * The shortcut a key press stands for. A letter is read with Shift, not
 * with its case: Caps Lock turns `r` into `R`, which is no Shift+R.
 */
export function shortcutKeyOf(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>
): ShortcutKey | null {
  const { key } = event
  const isLetter = key.length === 1 && key.toLowerCase() !== key.toUpperCase()
  const pressed = isLetter
    ? event.shiftKey
      ? key.toUpperCase()
      : key.toLowerCase()
    : key
  return isShortcutKey(pressed) ? pressed : null
}

export function isShortcutEvent(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing) return false
  // AltGr types characters (`#` on a French Windows keyboard), and Chrome
  // reports it as Ctrl + Alt: it is no modifier
  const isAltGraph =
    event.getModifierState('AltGraph') || (event.ctrlKey && event.altKey)
  if (event.metaKey || ((event.ctrlKey || event.altKey) && !isAltGraph)) {
    return false
  }
  const target = event.target
  if (target instanceof Element && target.closest(OWNED_BY_CONTROL) !== null) {
    return false
  }
  return shortcutKeyOf(event) !== null
}

/**
 * The keys of a message being written, listed by the help: tmail-flutter's
 * (Escape, Ctrl+K) and the ones of the editor. `Mod` is Ctrl, or ⌘ on a
 * Mac.
 */
export const COMPOSER_SHORTCUTS: readonly {
  keys: string
  label: TranslationKey
}[] = [
  { keys: 'Mod + Enter', label: 'shortcuts.composer.send' },
  { keys: 'Mod + K', label: 'shortcuts.composer.link' },
  { keys: 'Mod + B, I, U', label: 'shortcuts.composer.bold' },
  { keys: 'Mod + Shift + V', label: 'shortcuts.composer.plainPaste' },
  { keys: 'Alt + F10', label: 'shortcuts.composer.toolbar' },
  { keys: 'Escape', label: 'shortcuts.composer.escape' }
]

/** `Mod` of `COMPOSER_SHORTCUTS` as the keyboard of the user writes it */
export function modifierKeyName(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? '⌘' : 'Ctrl'
}
