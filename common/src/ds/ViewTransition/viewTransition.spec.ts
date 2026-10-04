import {
  canAnimateViewTransition,
  clearViewTransitionDirection,
  type ViewTransitionHost,
  prepareViewTransition,
  REDUCED_MOTION_QUERY,
  VIEW_TRANSITION_DIRECTION_ATTRIBUTE
} from './viewTransition'

interface FakeView {
  view: ViewTransitionHost
  attributes: Map<string, string>
}

/** A window with or without the View Transitions API and reduced motion */
function makeView({
  hasApi,
  reducedMotion
}: {
  hasApi: boolean
  reducedMotion: boolean
}): FakeView {
  const attributes = new Map<string, string>()
  const view: ViewTransitionHost = {
    document: {
      documentElement: {
        setAttribute: (name: string, value: string): void => {
          attributes.set(name, value)
        },
        removeAttribute: (name: string): void => {
          attributes.delete(name)
        }
      },
      ...(hasApi ? { startViewTransition: jest.fn() } : {})
    },
    matchMedia: (query: string) => ({
      matches: reducedMotion && query === REDUCED_MOTION_QUERY
    })
  }
  return { view, attributes }
}

describe('viewTransition', () => {
  it('animates when the browser has the API and motion is welcome', () => {
    const { view, attributes } = makeView({
      hasApi: true,
      reducedMotion: false
    })

    expect(canAnimateViewTransition(view)).toBe(true)
    expect(prepareViewTransition('forward', view)).toBe(true)
    expect(attributes.get(VIEW_TRANSITION_DIRECTION_ATTRIBUTE)).toBe('forward')

    prepareViewTransition('backward', view)
    expect(attributes.get(VIEW_TRANSITION_DIRECTION_ATTRIBUTE)).toBe('backward')

    clearViewTransitionDirection(view)
    expect(attributes.size).toBe(0)
  })

  it('does not animate with reduced motion', () => {
    const { view, attributes } = makeView({ hasApi: true, reducedMotion: true })

    expect(prepareViewTransition('forward', view)).toBe(false)
    expect(attributes.size).toBe(0)
  })

  it('does not animate without the API', () => {
    const { view, attributes } = makeView({
      hasApi: false,
      reducedMotion: false
    })

    expect(canAnimateViewTransition(view)).toBe(false)
    expect(prepareViewTransition('forward', view)).toBe(false)
    expect(attributes.size).toBe(0)
  })
})
