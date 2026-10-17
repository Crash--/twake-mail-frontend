/**
 * The identity form as it was when the page went (reload, expired session
 * sending the tab to the SSO): reopened with its content by the next page of
 * this tab, as tmail-flutter does (tf#3082). `sessionStorage`: written
 * synchronously while the page goes, and it only has to survive this tab.
 */
export interface IdentityFormDraft {
  /** The identity being edited, null for a new one */
  identityId: string | null
  name: string
  email: string
  replyTo: string
  bcc: string
  isDefault: boolean
  /** The signature, as the editor holds it */
  signatureHtml: string
  /** The signature images published meanwhile, not saved yet */
  published: string[]
}

const DRAFT_PREFIX = 'twake-mail-identity-form|'

function draftKey(accountId: string): string {
  return `${DRAFT_PREFIX}${accountId}`
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string')
}

function isDraft(value: unknown): value is IdentityFormDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  return (
    (typeof draft.identityId === 'string' || draft.identityId === null) &&
    typeof draft.name === 'string' &&
    typeof draft.email === 'string' &&
    typeof draft.replyTo === 'string' &&
    typeof draft.bcc === 'string' &&
    typeof draft.isDefault === 'boolean' &&
    typeof draft.signatureHtml === 'string' &&
    isStringArray(draft.published)
  )
}

/** Keeps the form for the next page of this tab */
export function keepIdentityForm(
  accountId: string,
  draft: IdentityFormDraft
): void {
  try {
    sessionStorage.setItem(draftKey(accountId), JSON.stringify(draft))
  } catch {
    // Quota or storage disabled: the form is lost with the page
  }
}

/** The form kept by the previous page of this tab, null when there is none */
export function readIdentityForm(accountId: string): IdentityFormDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(accountId))
    const value: unknown = raw === null ? null : JSON.parse(raw)
    return isDraft(value) ? value : null
  } catch {
    return null
  }
}

/** The form is saved, cancelled or left: nothing to reopen */
export function forgetIdentityForm(accountId: string): void {
  try {
    sessionStorage.removeItem(draftKey(accountId))
  } catch {
    // Nothing to forget
  }
}

/** Every form kept in this tab goes, with the session */
export function clearIdentityFormStorage(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key)
    }
    keys.forEach(key => {
      sessionStorage.removeItem(key)
    })
  } catch {
    // Nothing to clear
  }
}
