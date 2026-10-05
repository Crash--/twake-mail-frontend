import type { Forward, Rule } from 'jmap-client-ts/linagora'

import { FAKE_ACCOUNT_ID, type FakeJmapServer } from './fakeJmapServer'

/** Capabilities of the fake server's Linagora extensions */
export const FAKE_LINAGORA_CAPABILITIES = {
  'com:linagora:params:jmap:filter': {},
  'com:linagora:params:jmap:forward': {},
  'com:linagora:params:jmap:settings': { readOnlyProperties: [] },
  'urn:ietf:params:jmap:vacationresponse': {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `Filter/get` and `Filter/set` of tmail-backend: rules without their ids */
export function installFakeFilter(
  server: FakeJmapServer,
  initial: Rule[] = []
): { rules: () => unknown[] } {
  let rules: unknown[] = initial
  let state = 0
  server.handlers.set('Filter/get', () => ({
    accountId: FAKE_ACCOUNT_ID,
    state: String(state),
    list: [{ id: 'singleton', rules }],
    notFound: []
  }))
  server.handlers.set('Filter/set', args => {
    const update = isRecord(args.update) ? args.update : {}
    const singleton = update.singleton
    if (!Array.isArray(singleton)) return { error: 'invalidArguments' }
    rules = singleton.filter(isRecord).map(({ id: _id, ...rule }) => rule)
    state += 1
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState: String(state - 1),
      newState: String(state),
      updated: { singleton: {} }
    }
  })
  return { rules: () => rules }
}

/** `Forward/get` and `Forward/set` of tmail-backend */
export function installFakeForward(
  server: FakeJmapServer,
  initial: Partial<Forward> = {}
): { forward: () => Record<string, unknown> } {
  let forward: Record<string, unknown> = {
    id: 'singleton',
    localCopy: true,
    forwards: [],
    ...initial
  }
  server.handlers.set('Forward/get', () => ({
    accountId: FAKE_ACCOUNT_ID,
    state: 'forward-1',
    list: [forward],
    notFound: []
  }))
  server.handlers.set('Forward/set', args => {
    const update = isRecord(args.update) ? args.update : {}
    const patch = isRecord(update.singleton) ? update.singleton : {}
    if (!('localCopy' in patch)) {
      // As tmail-backend: the whole object, not a patch
      return {
        accountId: FAKE_ACCOUNT_ID,
        oldState: 'forward-1',
        newState: 'forward-1',
        notUpdated: {
          singleton: {
            type: 'invalidArguments',
            description: "Missing '/localCopy' property"
          }
        }
      }
    }
    forward = { ...forward, ...patch }
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState: 'forward-1',
      newState: 'forward-2',
      updated: { singleton: {} }
    }
  })
  return { forward: () => forward }
}

/**
 * `Settings/set` (`settings/<key>` patches) on the settings the fake
 * server answers `Settings/get` with
 */
export function installFakeSettings(
  server: FakeJmapServer,
  initial: Record<string, string> = {}
): { settings: () => Record<string, string> } {
  server.settings = { ...initial }
  server.handlers.set('Settings/set', args => {
    const update = isRecord(args.update) ? args.update : {}
    const patch = isRecord(update.singleton) ? update.singleton : {}
    const next = { ...server.settings }
    for (const [path, value] of Object.entries(patch)) {
      if (path.startsWith('settings/') && typeof value === 'string') {
        next[path.slice('settings/'.length)] = value
      }
    }
    server.settings = next
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState: 'state-settings-1',
      newState: 'state-settings-2',
      updated: { singleton: {} }
    }
  })
  return { settings: () => server.settings }
}

/** `VacationResponse/get` and `VacationResponse/set` (RFC 8621) */
export function installFakeVacation(
  server: FakeJmapServer,
  initial: Record<string, unknown> = {}
): { vacation: () => Record<string, unknown> } {
  let vacation: Record<string, unknown> = {
    id: 'singleton',
    isEnabled: false,
    fromDate: null,
    toDate: null,
    subject: null,
    textBody: null,
    htmlBody: null,
    ...initial
  }
  server.handlers.set('VacationResponse/get', () => ({
    accountId: FAKE_ACCOUNT_ID,
    state: 'vacation-1',
    list: [vacation],
    notFound: []
  }))
  server.handlers.set('VacationResponse/set', args => {
    const update = isRecord(args.update) ? args.update : {}
    const patch = isRecord(update.singleton) ? update.singleton : {}
    vacation = { ...vacation, ...patch }
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState: 'vacation-1',
      newState: 'vacation-2',
      updated: { singleton: null }
    }
  })
  return { vacation: () => vacation }
}
