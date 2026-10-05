import type { TranslationKey } from '@common/i18n/useI18n'

/** The keys the app listens to, as `KeyboardEvent.key` gives them */
export type ShortcutKey =
  'c' | '/' | 'j' | 'k' | 'e' | '#' | 's' | 'u' | 'z' | 'r' | 'R' | 'f' | '?'

/**
 * The shortcuts, in the order the help lists them; `keys` is what the help
 * shows when it is not the key itself. Reply, reply all and forward are
 * tmail-flutter's (r, Shift+R, f).
 */
export const SHORTCUTS: readonly {
  key: ShortcutKey
  keys?: string
  label: TranslationKey
}[] = [
  { key: 'c', label: 'shortcuts.actions.compose' },
  { key: '/', label: 'shortcuts.actions.search' },
  { key: 'j', label: 'shortcuts.actions.next' },
  { key: 'k', label: 'shortcuts.actions.previous' },
  { key: 'e', label: 'shortcuts.actions.archive' },
  { key: '#', label: 'shortcuts.actions.delete' },
  { key: 's', label: 'shortcuts.actions.star' },
  { key: 'u', label: 'shortcuts.actions.markAsUnread' },
  { key: 'r', label: 'emailActions.reply.reply' },
  { key: 'R', keys: 'Shift + R', label: 'emailActions.reply.replyAll' },
  { key: 'f', label: 'emailActions.reply.forward' },
  { key: 'z', label: 'shortcuts.actions.undo' },
  { key: '?', label: 'shortcuts.actions.help' }
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
