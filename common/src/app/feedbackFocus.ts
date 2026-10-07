/** What can take the focus in the feedback form */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

/** The callbacks of the Sentry feedback form that handle the focus */
export interface FeedbackFocus {
  onFormOpen: () => void
  onFormClose: () => void
  onSubmitSuccess: () => void
  /** Stops handling the keyboard (the form is detached) */
  release: () => void
}

function findOpenDialog(hostId: string): HTMLDialogElement | null {
  const shadow = document.getElementById(hostId)?.shadowRoot ?? null
  return shadow?.querySelector<HTMLDialogElement>('dialog[open]') ?? null
}

function focusablesOf(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
}

function activeElementOf(dialog: HTMLDialogElement): Element | null {
  const root = dialog.getRootNode()
  return root instanceof ShadowRoot ? root.activeElement : null
}

/** Keeps Tab and Shift+Tab inside the form, as in a modal dialog */
function cycleFocus(dialog: HTMLDialogElement, event: KeyboardEvent): void {
  const focusables = focusablesOf(dialog)
  const first = focusables.at(0)
  const last = focusables.at(-1)
  if (!first || !last) return
  const active = activeElementOf(dialog)
  const isInside = active !== null && dialog.contains(active)
  if (event.shiftKey && (!isInside || active === first)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (!isInside || active === last)) {
    event.preventDefault()
    first.focus()
  }
}

/**
 * Gives the Sentry feedback form, opened by `trigger`, the focus management of
 * the dialogs of the app: Sentry renders it as a non-modal `<dialog>` in a
 * shadow root and relies on `autofocus`, which the browser ignores because
 * the trigger keeps the focus. Opening moves the focus to its first field,
 * Tab stays inside it, Escape closes it, and closing it (Escape, Cancel, the
 * backdrop, a sent feedback) gives the focus back to `trigger`.
 */
export function makeFeedbackFocus(
  trigger: HTMLElement,
  hostId: string
): FeedbackFocus {
  const onKeyDown = (event: KeyboardEvent): void => {
    const dialog = findOpenDialog(hostId)
    if (dialog === null) return
    if (event.key === 'Tab') {
      cycleFocus(dialog, event)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      // A click on the dialog itself (the backdrop) is how the SDK closes it
      dialog.click()
    }
  }

  const release = (): void => {
    document.removeEventListener('keydown', onKeyDown, true)
  }

  const giveFocusBack = (): void => {
    release()
    if (trigger.isConnected) trigger.focus()
  }

  return {
    onFormOpen: () => {
      document.addEventListener('keydown', onKeyDown, true)
      const dialog = findOpenDialog(hostId)
      if (dialog !== null) focusablesOf(dialog).at(0)?.focus()
    },
    onFormClose: giveFocusBack,
    onSubmitSuccess: giveFocusBack,
    release
  }
}
