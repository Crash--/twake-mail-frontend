import { TestEnvironment } from 'jest-environment-jsdom'

/**
 * jsdom without the Fetch API classes (`Response`, `Headers`, `Request`) the
 * JMAP client relies on: they are borrowed from Node, so that the tests can
 * answer its requests with a fake JMAP server (`fakeJmapServer.ts`).
 *
 * Default export: Jest loads test environments that way.
 */
export default class JsdomWithFetchEnvironment extends TestEnvironment {
  constructor(...args: ConstructorParameters<typeof TestEnvironment>) {
    super(...args)
    Object.assign(this.global, { Headers, Request, Response })
  }
}
