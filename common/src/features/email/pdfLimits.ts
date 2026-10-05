/**
 * Limits and options of the PDF preview. A pure module (no `import.meta`, no
 * pdf.js), so that Jest can check them; `pdfjs.ts` and `PdfPreview` use them.
 */

/** A larger PDF is not previewed: the message offers the download */
export const MAX_PDF_PREVIEW_BYTES = 30_000_000

/** The pixels of one canvas (the limit of the pdf.js viewer): 4096 x 4096 */
export const MAX_CANVAS_PIXELS = 16_777_216
/** The side of one canvas */
export const MAX_CANVAS_SIDE = 16_384
/** The device pixel ratio the pages are drawn at, at most */
export const MAX_PIXEL_RATIO = 2

/** Time given to open a document, then to draw one page */
export const LOAD_TIMEOUT_MS = 30_000
export const RENDER_TIMEOUT_MS = 30_000

/** An embedded image of more pixels is not drawn (a 600 dpi A4 scan has 35 M) */
export const MAX_IMAGE_PIXELS = 36_000_000

/**
 * The options of `getDocument`, for a document that is never trusted. The
 * `isEvalSupported` option of CVE-2024-4367 no longer exists since pdfjs-dist
 * 5.7 (the bundle has no `eval` nor `new Function`), so it cannot be set.
 */
export const PDF_DOCUMENT_OPTIONS = {
  // Glyphs are drawn as paths: no font program of the document is handed to
  // the browser's font machinery (FontFace, @font-face)
  disableFontFace: true,
  useSystemFonts: false,
  // No WebAssembly (the CSP has no 'wasm-unsafe-eval'); JBIG2 and JPX images
  // are then not drawn
  useWasm: false,
  enableXfa: false,
  // Nothing is fetched: the data is in memory, no range request nor stream
  disableRange: true,
  disableAutoFetch: true,
  disableStream: true,
  maxImageSize: MAX_IMAGE_PIXELS,
  canvasMaxAreaInBytes: MAX_CANVAS_PIXELS * 4,
  enableHWA: false,
  // Errors only: a hostile file cannot flood the console
  verbosity: 0
} as const

/** `AnnotationMode.DISABLE`: no link, form field nor script of the page */
export const ANNOTATIONS_DISABLED = 0
