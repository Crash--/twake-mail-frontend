import { createClient } from 'jmap-client-ts'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import { createOwnStates, MAX_OWN_STATES, ownStatesOf } from './ownStates'

function makeClient(): ReturnType<typeof createClient> {
  return createClient({
    sessionUrl: 'https://jmap.example.com/session',
    auth: { getAuthorizationHeader: () => Promise.resolve('Basic dGVzdA==') },
    fetch: () => Promise.reject(new Error('No request expected')),
    methodCapabilities: METHOD_CAPABILITIES
  })
}

describe('createOwnStates', () => {
  it('leads from a state to another through our own changes', () => {
    const states = createOwnStates()
    states.record('Email', 's1', 's2')
    states.record('Email', 's2', 's3')

    expect(states.leadsTo('Email', 's1', 's2')).toBe(true)
    expect(states.leadsTo('Email', 's1', 's3')).toBe(true)
    expect(states.leadsTo('Email', 's2', 's3')).toBe(true)
  })

  it('does not lead past a change made elsewhere', () => {
    const states = createOwnStates()
    states.record('Email', 's1', 's2')
    // s2 → s3 came from another client
    states.record('Email', 's3', 's4')

    expect(states.leadsTo('Email', 's1', 's4')).toBe(false)
    expect(states.leadsTo('Email', 's1', 's3')).toBe(false)
    expect(states.leadsTo('Email', 's3', 's4')).toBe(true)
  })

  it('does not lead backwards nor from an unknown state', () => {
    const states = createOwnStates()
    states.record('Email', 's1', 's2')

    expect(states.leadsTo('Email', 's2', 's1')).toBe(false)
    expect(states.leadsTo('Email', 's0', 's2')).toBe(false)
  })

  it('keeps the types apart', () => {
    const states = createOwnStates()
    states.record('Mailbox', 's1', 's2')

    expect(states.leadsTo('Email', 's1', 's2')).toBe(false)
    expect(states.leadsTo('Mailbox', 's1', 's2')).toBe(true)
  })

  it('forgets the oldest changes beyond its capacity', () => {
    const states = createOwnStates()
    for (let index = 0; index <= MAX_OWN_STATES; index++) {
      states.record('Email', `s${index}`, `s${index + 1}`)
    }

    expect(states.leadsTo('Email', 's0', 's1')).toBe(false)
    expect(states.leadsTo('Email', 's1', `s${MAX_OWN_STATES + 1}`)).toBe(true)
  })

  it('stops on a cycle', () => {
    const states = createOwnStates(4)
    states.record('Email', 's1', 's2')
    states.record('Email', 's2', 's1')

    expect(states.leadsTo('Email', 's1', 's3')).toBe(false)
  })

  it('ignores a call that changed nothing', () => {
    const states = createOwnStates(1)
    states.record('Email', 's1', 's2')
    states.record('Email', 's2', 's2')

    expect(states.leadsTo('Email', 's1', 's2')).toBe(true)
  })

  it('tells the calls on their way, and when they are all answered', async () => {
    const states = createOwnStates()
    expect(states.isPending('Email')).toBe(false)
    const first = states.track('Email')
    const second = states.track('Email')
    let isSettled = false
    const settled = states.whenSettled('Email').then(() => {
      isSettled = true
    })

    first()
    first()
    await Promise.resolve()
    expect(states.isPending('Email')).toBe(true)
    expect(states.isPending('Mailbox')).toBe(false)
    expect(isSettled).toBe(false)

    second()
    await settled
    expect(states.isPending('Email')).toBe(false)
    await expect(states.whenSettled('Email')).resolves.toBeUndefined()
  })

  it('forgets everything once cleared', () => {
    const states = createOwnStates()
    states.record('Email', 's1', 's2')
    states.clear()

    expect(states.leadsTo('Email', 's1', 's2')).toBe(false)
  })
})

describe('ownStatesOf', () => {
  it('is the same memory for a client and an account', () => {
    const client = makeClient()

    expect(ownStatesOf(client, 'a')).toBe(ownStatesOf(client, 'a'))
    expect(ownStatesOf(client, 'a')).not.toBe(ownStatesOf(client, 'b'))
  })

  it('starts from nothing with a new client (a new sign-in)', () => {
    ownStatesOf(makeClient(), 'a').record('Email', 's1', 's2')

    expect(ownStatesOf(makeClient(), 'a').leadsTo('Email', 's1', 's2')).toBe(
      false
    )
  })
})
