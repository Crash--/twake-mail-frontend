# Security measures

What protects the user from what an email or an attachment contains. The
app CSP and its environment variables are described in
[`deployment.md`](deployment.md#content-security-policy).

## Email body

`common/src/features/email/emailBody.ts`, `EmailBodyFrame.tsx`,
`sanitizeEmailHtml.ts`. Three layers, each enough to stop a script:

1. the HTML is sanitized (tags, attributes and CSS of tmail-flutter, ADR
   0054); remote content is left out;
2. the body lives in an `iframe` with `sandbox` and without `allow-scripts`;
3. the body document has its own CSP: `default-src 'none'`, inline styles,
   images and fonts from `data:`/`blob:` only. `http(s):` is added only
   after the user allows remote content, and then no referrer is sent.

## Remote content

Remote images, fonts and stylesheets of a body are blocked (sanitizer and
CSP) until the user allows them for the message or the sender (trusted
senders). Blocked is the default: a remote URL is a read receipt and a
tracker.

## Attachment previews

`AttachmentPreviewDialog.tsx`. The file is downloaded with the session, then
shown by a renderer that cannot run it: HTML and `.eml` through the body
layers above; images (SVG included) in an `<img>` of a blob with a known
image type; text escaped by React; PDF by pdf.js (below). No blob is ever
navigated to, and object URLs are revoked on close.

## PDF preview (pdf.js)

`pdfjs.ts`, `pdfLimits.ts`, `pdfLayout.ts`, `PdfPreview.tsx`, `PdfPage.tsx`.
pdfjs-dist 6.4.299, drawn on canvases, in the app and not in a browser
plugin.

Advisories reviewed (mozilla/pdf.js security advisories):

- GHSA-wgrm-67xf-hhpq, CVE-2024-4367: arbitrary JavaScript through the
  glyph code generated with `new Function` when `isEvalSupported` was on.
  Fixed in 4.2.67 (PR 18015, which removed the use of `eval`).
- GHSA-hq66-cqwq-w95j, CVE-2026-16633: arbitrary JavaScript with
  `enableScripting` and no CSP; fixed in 6.2.108. The scripting sandbox is
  a viewer feature the app does not use.
- The `isEvalSupported` option no longer exists since 5.7 (the commit that
  removed the PostScript compiler removed it): it cannot be set, and neither
  `pdf.mjs` nor `pdf.worker.mjs` of 6.4.299 contains `eval(` or
  `new Function`. The end-to-end test that spies on both stays as a guard
  against a regression after an upgrade.

Options of `getDocument` (`PDF_DOCUMENT_OPTIONS`, checked by a unit test):

| Option | Value | Why |
| --- | --- | --- |
| `disableFontFace` | `true` | glyphs are drawn as paths: no font program of the document goes to FontFace / `@font-face` |
| `useSystemFonts` | `false` | no dependency on, nor fingerprint of, the local fonts |
| `useWasm` | `false` | the CSP has no `'wasm-unsafe-eval'` |
| `enableXfa` | `false` | no XFA forms |
| `disableRange`, `disableStream`, `disableAutoFetch` | `true` | the data is in memory: nothing is fetched |
| `maxImageSize` | 36 000 000 px | an image above (a 600 dpi A4 scan has 35 M) is not drawn |
| `canvasMaxAreaInBytes` | 4096 x 4096 x 4 | explicit, no probing |
| `enableHWA` | `false` | explicit |
| `verbosity` | `0` (errors) | a hostile file cannot flood the console |

No `cMapUrl`, `standardFontDataUrl`, `iccUrl` nor `wasmUrl`: nothing is
loaded from anywhere. `stopAtErrors` stays off: pdf.js recovers what it can
of damaged files, and a hard failure already ends in "Cannot preview" with
the download. Annotations are not drawn (`AnnotationMode.DISABLE`): no link,
form nor script.

Bounds against denial of service:

- Size: a PDF above 30 MB (`MAX_PDF_PREVIEW_BYTES`) is neither fetched, if
  the server declares it so, nor handed to pdf.js (checked again on the
  downloaded blob); the dialog says to download it.
- Canvases: at most 4096 x 4096 pixels and 16 384 on a side per page, device
  pixel ratio capped at 2, whatever `MediaBox` the file claims.
- Lazy: one placeholder per page, a page is read and drawn when it scrolls
  into view and released (bitmap and page data) when it leaves it.
- Time: opening the document and drawing a page each get 30 s, then the
  work is cancelled and the preview fails.
- Worker: closing the dialog, even while the document loads, calls the
  loading task's `destroy()`, which terminates the worker.

Worker and CSP: the worker is a file of the app
(`GlobalWorkerOptions.workerSrc`, same origin), so `script-src 'self'`
covers it (no `worker-src`, no `blob:`). A dedicated worker gets its policy
from its own response: nginx serves `.mjs` as `text/javascript` with the
static cache policy and the full security headers (CSP, `nosniff`, ...).
`deploy/docker/smoke-test.sh` checks it on the image; the end-to-end test
ATT-08 checks it in the browser.

Residual risks: the font renderer still parses the font programs of the
document in the worker (a memory-safety bug there stays in the worker's
JavaScript realm, with no DOM); fonts that are not embedded have no
standard font data and are drawn poorly or not at all; JBIG2 and JPX
images are not drawn without WebAssembly; the app CSP allows
`img-src https: http:` for the email remote-content opt-in, which a PDF
cannot use (pdf.js loads nothing).

## App CSP

Sent by nginx on every response (`deploy/docker/security-headers.conf`):
`default-src 'self'`, `script-src 'self'` plus the hash of the one inline
script of `index.html`, no `unsafe-eval`, no `wasm-unsafe-eval`,
`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
`frame-ancestors` from the configuration, `connect-src` limited to the app,
JMAP, SSO and Sentry origins. Also `X-Content-Type-Options: nosniff`,
`Referrer-Policy: same-origin` and a `Permissions-Policy`.
`CSP_REPORT_ONLY` switches to report-only for a rollout. The end-to-end
fixtures fail on any CSP violation.
