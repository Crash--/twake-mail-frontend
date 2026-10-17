/**
 * Delay after which the sending dialog says that the server is slow to
 * answer and lets the user close it (`tf#2603`). The request has no
 * timeout and is never sent again blindly: it may have reached the server.
 */
export const SEND_SLOW_MS = 20_000
