/**
 * The service side of `cozy-interapp` (no types of its own): what the
 * `/intents` page uses
 */
declare module 'cozy-interapp' {
  /** `fetchJSON` of cozy-client: the stack answers in JSON:API */
  export type IntentsFetch = (
    method: string,
    path: string,
    body?: unknown
  ) => Promise<unknown>

  export interface IntentDocument {
    _id: string
    attributes: {
      action: string
      type: string
      /** Origin of the app that started the intent */
      client: string
      /**
       * The origins that may frame a service of the intent (newer
       * cozy-stack only)
       */
      frameAncestors?: unknown
    }
  }

  export interface IntentService {
    getIntent: () => IntentDocument
    /** What the client sent with the intent */
    getData: () => unknown
    /** Done: the client gets the document. Once only */
    terminate: (document: unknown) => void
    /** The client gets null. Once only */
    cancel: () => void
    /** The client gets the error. Once only */
    throw: (error: Error) => void
    /** The service is shown. Once only */
    notifyReadyToUse: () => void
    hideCross: () => void
    showCross: () => void
  }

  export class Intents {
    constructor(options: { fetch: IntentsFetch })
    /**
     * Reads the intent (`GET /intents/:id`), then waits for the data of
     * the client (`ready` message)
     */
    createService(
      intentId: string,
      serviceWindow: Window
    ): Promise<IntentService>
  }
}
