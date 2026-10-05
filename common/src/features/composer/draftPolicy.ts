/**
 * When a composer is written, and where (`docs/composer-drafts.md`).
 *
 * Typing writes in the browser only (`composerStorage`). The server stores
 * a new version of the draft and destroys the previous one at each write
 * (an email body is immutable in JMAP): so it is written after a long
 * pause, when the message differs from the version it has, and on request.
 */

/** Pause in the changes after which the draft is written on the server */
export const DRAFT_IDLE_MS = 5 * 60 * 1000

/** Pause in the changes after which the composer is written in the browser */
export const LOCAL_SAVE_DELAY_MS = 800
