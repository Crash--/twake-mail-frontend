import type { EmailAddress } from 'jmap-client-ts'

import {
  findReferencedCids,
  sanitizeEmailHtml
} from '@common/features/email/emailBody'

import { BLOCKQUOTE_STYLE } from './emailHtml'

/**
 * Quoting an email in a reply or a forward, as tmail-flutter does
 * (editor_view_mixin.dart, email_action_type_extension.dart):
 *
 *   <cite style="text-align: left;display: block;">On Mar 5, 2026 3:04 PM, from John &lt;john@x&gt;</cite>
 *   <blockquote style="margin-left:8px;…;border-left:5px solid #eee;">ORIGINAL</blockquote>
 *
 * tmail-flutter writes `</br>` between the forward header lines; this
 * writes `<br>`.
 */

export type QuoteMode = 'reply' | 'forward'

export interface QuotedEmail {
  receivedAt: string
  subject: string | null
  from: EmailAddress[] | null
  to: EmailAddress[] | null
  cc: EmailAddress[] | null
  bcc: EmailAddress[] | null
  replyTo: EmailAddress[] | null
  /** Raw HTML of the body (text bodies already turned into HTML) */
  html: string
}

export interface QuoteLabels {
  /** `On %{sentDate}, from %{emailAddress}`, already interpolated */
  replyHeader: (sentDate: string, emailAddress: string) => string
  forwarded: string
  subject: string
  date: string
  from: string
  to: string
  cc: string
  bcc: string
  replyTo: string
}

const CITE_STYLE = 'text-align: left;display: block;'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** `Name <email>` or `<email>`, comma separated, escaped (tmail-flutter) */
export function formatAddresses(addresses: EmailAddress[] | null): string {
  return escapeHtml(
    (addresses ?? [])
      .map(address =>
        address.name
          ? `${address.name} <${address.email}>`
          : `<${address.email}>`
      )
      .join(', ')
  )
}

/** tmail-flutter's `MMM d, y h:mm a`, in the UI language */
export function formatQuoteDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)
  const day = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
  return `${day} ${time}`
}

/**
 * The quoted body, sanitized but with its `cid:` images untouched: that is
 * the form the composer keeps and sends; the URLs are only for display.
 * Signatures of the quoted email stop being signatures (tmail-flutter's
 * SignatureTransformer).
 */
export function sanitizeQuotedHtml(html: string): string {
  const cids = findReferencedCids(html)
  const keepCids = new Map(Array.from(cids, cid => [cid, `cid:${cid}`]))
  const sanitized = sanitizeEmailHtml(html, keepCids)
  return scopeStyles(
    sanitized.replaceAll(
      'class="tmail-signature"',
      'class="tmail-signature-blocked"'
    ),
    QUOTE_SCOPE
  )
}

/** The element that holds the quote in the sent HTML (see HtmlBlock) */
export const QUOTE_SCOPE = '[data-html-block="quote"]'

function scopeSelector(selector: string, scope: string): string {
  return selector
    .split(',')
    .map(part => {
      const trimmed = part.trim()
      // `body` rules style the quoted body, not the header above it
      const rooted = trimmed.replace(/^(html|body|:root)(\s+|$)/i, '')
      if (rooted === trimmed) return `${scope} ${trimmed}`
      return rooted === ''
        ? `${scope} > blockquote`
        : `${scope} > blockquote ${rooted}`
    })
    .join(', ')
}

function scopeRules(rules: CSSRuleList, scope: string): string {
  return Array.from(rules)
    .map(rule => {
      if (rule instanceof CSSStyleRule) {
        return `${scopeSelector(rule.selectorText, scope)} { ${rule.style.cssText} }`
      }
      if (rule instanceof CSSMediaRule) {
        return `@media ${rule.conditionText} { ${scopeRules(rule.cssRules, scope)} }`
      }
      // @import, @font-face, @keyframes…: dropped
      return ''
    })
    .filter(text => text !== '')
    .join('\n')
}

/**
 * Confines the `<style>` elements of a quoted email to the quote: once
 * sent, they would otherwise restyle the whole reply in the clients that
 * keep them (tmail-flutter included). `body` and `html` rules apply to the
 * quote itself.
 */
export function scopeStyles(html: string, scope: string): string {
  if (!/<style/i.test(html)) return html
  const root = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    'text/html'
  ).body
  for (const style of Array.from(root.querySelectorAll('style'))) {
    const sheet = new CSSStyleSheet()
    try {
      sheet.replaceSync(style.textContent)
    } catch {
      style.remove()
      continue
    }
    style.textContent = scopeRules(sheet.cssRules, scope)
  }
  return root.innerHTML
}

function forwardHeader(
  email: QuotedEmail,
  labels: QuoteLabels,
  locale: string
): string {
  const lines: [string, string][] = [
    [labels.subject, escapeHtml(email.subject ?? '')],
    [labels.date, escapeHtml(formatQuoteDate(email.receivedAt, locale))],
    [labels.from, formatAddresses(email.from)],
    [labels.to, formatAddresses(email.to)],
    [labels.cc, formatAddresses(email.cc)],
    [labels.bcc, formatAddresses(email.bcc)],
    [labels.replyTo, formatAddresses(email.replyTo)]
  ]
  return [
    `------- ${escapeHtml(labels.forwarded)} -------`,
    ...lines
      .filter(([, value]) => value !== '')
      .map(([label, value]) => `${escapeHtml(label)}: ${value}`)
  ].join('<br>')
}

/** The header line (cite) and the quoted body (blockquote) */
export function buildQuoteHtml(
  mode: QuoteMode,
  email: QuotedEmail,
  labels: QuoteLabels,
  locale: string
): string {
  const header =
    mode === 'reply'
      ? escapeHtml(
          labels.replyHeader(
            formatQuoteDate(email.receivedAt, locale),
            // Escaped once, as a whole, below
            (email.from ?? [])
              .map(address =>
                address.name
                  ? `${address.name} <${address.email}>`
                  : `<${address.email}>`
              )
              .join(', ')
          )
        )
      : forwardHeader(email, labels, locale)
  return [
    `<cite style="${CITE_STYLE}">${header}</cite>`,
    `<blockquote style="${BLOCKQUOTE_STYLE}">${sanitizeQuotedHtml(email.html)}</blockquote>`
  ].join('')
}

/** `Re: ` / `Fwd: ` unless the subject already has it */
export function prefixSubject(subject: string | null, prefix: string): string {
  const current = subject ?? ''
  return current.toLowerCase().startsWith(prefix.toLowerCase())
    ? current
    : `${prefix} ${current}`
}
