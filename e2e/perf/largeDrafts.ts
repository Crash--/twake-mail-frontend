import { randomBytes } from 'node:crypto'
import { deflateSync } from 'node:zlib'

/**
 * The big drafts of the composer measures (`composer-large.perf.ts`): RFC 5322 messages made
 * in memory, imported into the Drafts folder with the `$draft` keyword. Deterministic text
 * (the same message at every run), random bytes only in the attachments and the images.
 */

export type LargeKind =
  'thread' | 'tables' | 'images' | 'attachments' | 'recipients'

export interface LargeDraft {
  /** The whole message, ready for Email/import */
  eml: Buffer
  /** Size of the HTML body in bytes */
  htmlBytes: number
  /** Size of the whole message in bytes */
  emlBytes: number
}

const WORDS = (
  'quarterly report meeting agenda invoice project roadmap release review budget planning ' +
  'feedback contract proposal deadline update reminder schedule deployment incident customer ' +
  'support onboarding design specification migration security audit invitation webinar'
).split(' ')

function words(count: number, seed: number): string {
  let state = seed + 1
  const out: string[] = []
  for (let index = 0; index < count; index += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296
    out.push(WORDS[state % WORDS.length] ?? 'word')
  }
  return out.join(' ')
}

/** A long thread quoted again and again: nested blockquotes of paragraphs, as a mail client writes it */
export function threadHtml(bytes: number): string {
  const parts: string[] = [
    '<div>Thanks, I have read everything below.</div><br>'
  ]
  let size = parts[0]?.length ?? 0
  let index = 0
  while (size < bytes) {
    const depth = 1 + (index % 4)
    const open =
      '<blockquote style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex">'.repeat(
        depth
      )
    const close = '</blockquote>'.repeat(depth)
    const message =
      `<div>On Mon ${index}, Alice Martin &lt;alice@example.com&gt; wrote:</div>${open}` +
      `<p>${words(40, index)}.</p><p><b>${words(8, index + 1)}</b> <a href="https://example.com/${index}">${words(3, index + 2)}</a></p>` +
      `<ul><li>${words(10, index + 3)}</li><li>${words(10, index + 4)}</li></ul><p>${words(60, index + 5)}.</p>${close}`
    parts.push(message)
    size += message.length
    index += 1
  }
  return `<html><body>${parts.join('')}</body></html>`
}

/** Big tables: 12 columns of short cells */
export function tablesHtml(bytes: number): string {
  const parts: string[] = ['<div>Figures below.</div>']
  let size = parts[0]?.length ?? 0
  let table = 0
  while (size < bytes) {
    const rows: string[] = []
    for (let row = 0; row < 40; row += 1) {
      const cells = Array.from(
        { length: 12 },
        (_, column) =>
          `<td style="border:1px solid #999;padding:2px">${words(2, table * 1000 + row * 12 + column)}</td>`
      )
      rows.push(`<tr>${cells.join('')}</tr>`)
    }
    const html = `<table style="border-collapse:collapse"><tbody>${rows.join('')}</tbody></table><br>`
    parts.push(html)
    size += html.length
    table += 1
  }
  return `<html><body>${parts.join('')}</body></html>`
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** A valid RGB PNG of noise (it does not compress): about `size * size * 3` bytes */
export function noisePng(size: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let row = 0; row < size; row += 1) {
    randomBytes(size * 3).copy(raw, row * (size * 3 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function base64Lines(content: Buffer): string {
  return (content.toString('base64').match(/.{1,76}/g) ?? []).join('\r\n')
}

interface Part {
  headers: string[]
  body: Buffer
}

function renderPart(part: Part): string {
  return `${part.headers.join('\r\n')}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(part.body)}\r\n`
}

export interface BuildOptions {
  from: string
  to: string[]
  subject: string
  html: string
  /** Files attached, as `[name, bytes]` */
  attachments?: [string, Buffer][]
  /** Images referenced by `cid:` in the HTML, as `[cid, png]` */
  inlineImages?: [string, Buffer][]
}

/** A multipart message: the HTML (with its related images) and the attachments */
export function buildDraftEml(options: BuildOptions): LargeDraft {
  const html = Buffer.from(options.html, 'utf8')
  const htmlPart: Part = {
    headers: ['Content-Type: text/html; charset=utf-8'],
    body: html
  }
  const mixed = 'perf-mixed'
  const related = 'perf-related'
  const hasImages = (options.inlineImages?.length ?? 0) > 0
  const body = hasImages
    ? `--${mixed}\r\nContent-Type: multipart/related; boundary="${related}"\r\n\r\n` +
      `--${related}\r\n${renderPart(htmlPart)}` +
      (options.inlineImages ?? [])
        .map(
          ([cid, png]) =>
            `--${related}\r\n${renderPart({
              headers: [
                'Content-Type: image/png',
                `Content-ID: <${cid}>`,
                `Content-Disposition: inline; filename="${cid}.png"`
              ],
              body: png
            })}`
        )
        .join('') +
      `--${related}--\r\n`
    : `--${mixed}\r\n${renderPart(htmlPart)}`
  const attachments = (options.attachments ?? [])
    .map(
      ([name, content]) =>
        `--${mixed}\r\n${renderPart({
          headers: [
            `Content-Type: application/octet-stream; name="${name}"`,
            `Content-Disposition: attachment; filename="${name}"`
          ],
          body: content
        })}`
    )
    .join('')
  const message =
    `From: ${options.from}\r\nTo: ${options.to.join(', ')}\r\nSubject: ${options.subject}\r\n` +
    `Date: Mon, 01 Jan 2024 10:00:00 +0000\r\nMessage-ID: <${Date.now()}-${Math.random().toString(36).slice(2)}@perf.test>\r\n` +
    `MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${mixed}"\r\n\r\n` +
    `${body}${attachments}--${mixed}--\r\n`
  const eml = Buffer.from(message, 'utf8')
  return { eml, htmlBytes: html.length, emlBytes: eml.length }
}

/** Addresses `person-<n>@elsewhere.test`: not a local domain, nothing is delivered */
export function manyAddresses(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `Person ${index} <person-${index}@elsewhere.test>`
  )
}

/** The cases measured: label, and the draft each run opens */
export interface LargeCase {
  id: string
  label: string
  /** The recipients of the draft: the user themself unless it is the 200 recipients case */
  recipients?: number
  /** Over `maxSizeRequest` of the server (10 MB): saving and sending are refused, which is measured */
  refused?: boolean
  make: (from: string, to: string[]) => LargeDraft
}

const MB = 1024 * 1024

export const LARGE_CASES: LargeCase[] = [
  ...[1, 2, 5].map((size): LargeCase => ({
    id: `thread-${size}mb`,
    label: `${size} MB quoted thread`,
    refused: size >= 5,
    make: (from, to) =>
      buildDraftEml({
        from,
        to,
        subject: `Thread ${size} MB`,
        html: threadHtml(size * MB)
      })
  })),
  {
    id: 'tables-2mb',
    label: '2 MB of big tables',
    make: (from, to) =>
      buildDraftEml({
        from,
        to,
        subject: 'Tables 2 MB',
        html: tablesHtml(2 * MB)
      })
  },
  {
    id: 'images-2mb',
    label: '2 MB of inline images',
    make: (from, to) => {
      const images: [string, Buffer][] = Array.from(
        { length: 40 },
        (_, index) => [`img${index}@perf.test`, noisePng(130)]
      )
      const html =
        '<html><body><div>Photos:</div>' +
        images
          .map(
            ([cid], index) =>
              `<p>Photo ${index}<br><img src="cid:${cid}" alt="Photo ${index}" width="130" height="130"></p>`
          )
          .join('') +
        '</body></html>'
      return buildDraftEml({
        from,
        to,
        subject: 'Images 2 MB',
        html,
        inlineImages: images
      })
    }
  },
  {
    id: 'attachments-50',
    label: '50 attachments',
    make: (from, to) =>
      buildDraftEml({
        from,
        to,
        subject: '50 attachments',
        html: '<html><body><div>See the files.</div></body></html>',
        attachments: Array.from(
          { length: 50 },
          (_, index): [string, Buffer] => [
            `report-${String(index + 1).padStart(2, '0')}.bin`,
            randomBytes(8 * 1024)
          ]
        )
      })
  },
  {
    id: 'recipients-200',
    label: '200 recipients',
    recipients: 200,
    make: (from, to) =>
      buildDraftEml({
        from,
        to,
        subject: '200 recipients',
        html: '<html><body><div>Hello all.</div></body></html>'
      })
  }
]
