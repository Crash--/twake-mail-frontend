/**
 * The words saying a file is attached, in the languages of tmail-flutter
 * (`AttachmentTextDetector`), looked for in every language whatever the
 * language of the interface. Its `attachment_keywords.json` only adds or
 * excludes words: it ships empty.
 */
export const ATTACHMENT_KEYWORDS: readonly string[] = [
  // English
  'attach',
  'attachment',
  'attachments',
  'attached',
  'file',
  'files',
  // French
  'pièce jointe',
  'fichier joint',
  'document joint',
  'pj',
  'jointe',
  'joint',
  // Russian
  'прикрепить',
  'приложение',
  'документ',
  'файл',
  'отчёт',
  'вложение',
  // Vietnamese
  'đính kèm',
  'tài liệu',
  'tệp',
  'báo cáo',
  // Arabic
  'مرفق',
  'مستند',
  'ملف',
  'تقرير',
  'إرفاق'
]

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Longest first, so that "attachment" wins over "attach" */
const KEYWORD_PATTERN = new RegExp(
  `(?<!\\p{L})(${[...ATTACHMENT_KEYWORDS]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|')})(?!\\p{L})`,
  'giu'
)

/**
 * The attachment keywords `text` holds, each once, lower-cased: whole
 * words, whatever their case (`file?`, `file-2` count, `filetage` not)
 */
export function findAttachmentKeywords(text: string): string[] {
  const found = Array.from(text.matchAll(KEYWORD_PATTERN), match =>
    match[0].toLowerCase()
  )
  return [...new Set(found)]
}

/** What the user wrote: no quote, no signature, no Drive card */
const NOT_WRITTEN = [
  'blockquote',
  '[data-html-block]',
  '.tmail-signature',
  'a.tmail-file-link-card',
  'style',
  'script'
].join(',')

/**
 * The text of a message the reminder reads: its subject and what the user
 * wrote in the body (editor HTML), without the quoted email nor the
 * signature, as tmail-flutter (`HtmlUtils.extractPlainText`); the header
 * of a quote is left out too, since it is part of the quote block here
 */
export function writtenText(subject: string, editorHtml: string): string {
  const body = new DOMParser().parseFromString(
    `<body>${editorHtml}</body>`,
    'text/html'
  ).body
  body.querySelectorAll(NOT_WRITTEN).forEach(element => {
    element.remove()
  })
  // Blocks and line breaks separate words
  body.querySelectorAll('p, div, li, br, td, h1, h2, h3').forEach(element => {
    element.append(' ')
  })
  return `${subject} ${body.textContent}`.replace(/\s+/g, ' ').trim()
}
