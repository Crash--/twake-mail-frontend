import type { EmojiEntry, EmojiGroupId } from '@/ds/EmojiPicker/EmojiPicker'

/** Emojibase groups (Unicode CLDR) as the groups of the picker; 2 (components) is left out */
const GROUPS: Readonly<Record<number, EmojiGroupId>> = {
  0: 'people',
  1: 'people',
  3: 'animals',
  4: 'food',
  5: 'travel',
  6: 'activities',
  7: 'objects',
  8: 'symbols',
  9: 'flags'
}

interface CompactData {
  group?: number
  unicode: string
  label: string
  tags?: string[]
}

/**
 * One chunk per language, loaded when the picker opens (emojibase-data, MIT):
 * about 80 kB gzipped each, never in the main bundle.
 */
const LOADERS: Readonly<Record<string, () => Promise<CompactData[]>>> = {
  en: async () => (await import('emojibase-data/en/compact.json')).default,
  fr: async () => (await import('emojibase-data/fr/compact.json')).default,
  ru: async () => (await import('emojibase-data/ru/compact.json')).default,
  vi: async () => (await import('emojibase-data/vi/compact.json')).default
}

/** The emojis in the language of the UI (English for a language without data) */
export async function loadEmojis(lang: string): Promise<EmojiEntry[]> {
  const load = LOADERS[lang.slice(0, 2)] ?? LOADERS.en
  const data = (await load?.()) ?? []
  return data.flatMap(entry => {
    const group = entry.group === undefined ? undefined : GROUPS[entry.group]
    if (group === undefined) return []
    return [
      {
        char: entry.unicode,
        label: entry.label,
        tags: entry.tags ?? [],
        group
      }
    ]
  })
}

const STORAGE_KEY = 'twake-mail-recent-emojis'
const MAX_RECENT = 24

/** What the picker shows as recent until the user has picked some */
export const DEFAULT_RECENT_EMOJIS: readonly string[] = [
  '😀', '😍', '👍', '😭', '👋', '🙏', '🎉', '❤️', '😂', '🔥', '✅', '👀'
] // prettier-ignore

export function readRecentEmojis(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '[]'
    )
    if (!Array.isArray(parsed)) return [...DEFAULT_RECENT_EMOJIS]
    const kept = parsed.filter(
      (item): item is string => typeof item === 'string'
    )
    return kept.length > 0 ? kept : [...DEFAULT_RECENT_EMOJIS]
  } catch {
    return [...DEFAULT_RECENT_EMOJIS]
  }
}

/** Puts the emoji first; the list is kept in the browser (no account data) */
export function rememberEmoji(emoji: string): string[] {
  const recent = [
    emoji,
    ...readRecentEmojis().filter(item => item !== emoji)
  ].slice(0, MAX_RECENT)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  } catch {
    // Storage full or refused: the list lives for this session only
  }
  return recent
}

const PROBE_SIZE = 32

/**
 * Keeps the emojis this device can draw. An emoji newer than the system's
 * font shows as a box, or as its parts (a ZWJ sequence, two letters for a
 * flag on Windows): they are told apart by drawing each one on a canvas.
 * Without a canvas (tests), everything is kept.
 */
export function keepDrawable(emojis: EmojiEntry[]): EmojiEntry[] {
  const canvas = document.createElement('canvas')
  canvas.width = PROBE_SIZE
  canvas.height = PROBE_SIZE
  let context: CanvasRenderingContext2D | null
  try {
    context = canvas.getContext('2d', { willReadFrequently: true })
  } catch {
    return emojis
  }
  if (context === null) return emojis
  const probe = context
  probe.font = `${PROBE_SIZE - 8}px sans-serif`
  probe.textBaseline = 'top'
  const single = probe.measureText('😀').width

  const draw = (char: string): Uint8ClampedArray => {
    probe.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE)
    probe.fillStyle = '#000'
    probe.fillText(char, 0, 0)
    return probe.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data
  }
  const isColourful = (pixels: Uint8ClampedArray): boolean => {
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] ?? 0
      if (
        alpha > 0 &&
        (pixels[index] !== pixels[index + 1] ||
          pixels[index + 1] !== pixels[index + 2])
      ) {
        return true
      }
    }
    return false
  }
  // What a character the font does not have looks like
  const missing = draw('\u{10FFFE}')
  const sameAsMissing = (pixels: Uint8ClampedArray): boolean =>
    pixels.every((value, index) => value === missing[index])

  // No emoji font at all: everything would be left out, keep it all
  if (sameAsMissing(draw('😀'))) return emojis
  // Some systems draw emojis in one colour on a canvas: then a flag cannot
  // be told from two letters by its colours
  const drawsColour = isColourful(draw('😀'))
  return emojis.filter(emoji => {
    // A sequence the font lacks is drawn as its parts: wider than one emoji
    const limit = emoji.char.includes('\u200D') ? 1.2 : 1.6
    if (single > 0 && probe.measureText(emoji.char).width > single * limit) {
      return false
    }
    const pixels = draw(emoji.char)
    if (sameAsMissing(pixels)) return false
    return !(drawsColour && emoji.group === 'flags' && !isColourful(pixels))
  })
}
