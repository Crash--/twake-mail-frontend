Closes #213

## What
- **Escape closes the open email** (single message or conversation) and goes back to the list, with the focus on the email row, the same as the "Back to <folder>" button (`useEmailViewShortcuts`). It goes through the shared `ShortcutsProvider`, so it is ignored in fields, dialogs, menus and list boxes, and when shortcuts are turned off. Controls that handle Escape themselves (the composer window, the list selection, the search) still get it first.
- **Escape inside the message body**: the sandboxed iframe keeps its key presses, so `EmailBodyFrame` adds a listener to the frame document (in the app, nothing runs in the frame) and sends Escape again on the iframe element, where the app shortcuts receive it.
- The **keyboard shortcuts help** now lists `Escape` ("Close the message and go back to the list"), translated in en, fr, ru and vi.

## Tests
- `emailShortcuts.spec.tsx`: Escape closes the open email and the focus goes back to its row.
- `EmailBodyFrame.spec.tsx`: `forwardEscapeKey` passes Escape on to the app and keeps other keys in the frame.

## Checks
**I could not run any checks in this session.** Dependencies could not be installed: running Node 24 through nvm needed an approval that was not available, and the system Node 12 fails on `npm ci`. Lint, format, typecheck, Jest and build were therefore **not run locally**. CI needs to confirm them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
*Generated automatically*
