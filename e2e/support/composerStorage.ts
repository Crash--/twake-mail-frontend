import type { Page } from '@playwright/test'

/** What the browser keeps of a composer (the body and the files are not read) */
export interface KeptComposer {
  composerId: string
  subject: string | null
  /** Id of the draft on the server, null before the first save */
  draftId: string | null
}

/**
 * The composers the app keeps in IndexedDB (`composerStorage.ts`), read from
 * the page. Never the body: a test asserts on it through the composer.
 */
export async function keptComposers(page: Page): Promise<KeptComposer[]> {
  return page.evaluate(
    () =>
      new Promise<KeptComposer[]>((resolve, reject) => {
        const opened = indexedDB.open('twake-mail-composers', 1)
        opened.onupgradeneeded = () => {
          opened.result.createObjectStore('composers', {
            keyPath: ['accountId', 'composerId']
          })
        }
        opened.onerror = () => {
          reject(opened.error)
        }
        opened.onsuccess = () => {
          const database = opened.result
          const request = database
            .transaction('composers', 'readonly')
            .objectStore('composers')
            .getAll()
          request.onsuccess = () => {
            const rows = request.result as {
              composerId: string
              snapshot: { subject?: string; draftId?: string | null } | null
            }[]
            database.close()
            resolve(
              rows.map(row => ({
                composerId: row.composerId,
                subject: row.snapshot?.subject ?? null,
                draftId: row.snapshot?.draftId ?? null
              }))
            )
          }
          request.onerror = () => {
            database.close()
            reject(request.error)
          }
        }
      })
  )
}
