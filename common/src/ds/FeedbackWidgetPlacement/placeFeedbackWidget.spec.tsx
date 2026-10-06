import { placeFeedbackWidget } from './placeFeedbackWidget'

describe('placeFeedbackWidget', () => {
  it('keeps the corner and sets the stacking order', () => {
    const host = document.createElement('div')

    placeFeedbackWidget(host, { bottomClearance: 0, zIndex: 1050 })

    expect(host.style.getPropertyValue('--inset')).toBe('auto 0 0 auto')
    expect(host.style.getPropertyValue('--z-index')).toBe('1050')
  })

  it('lifts the button above a floating button of the app', () => {
    const host = document.createElement('div')

    placeFeedbackWidget(host, { bottomClearance: 88, zIndex: 1050 })

    expect(host.style.getPropertyValue('--inset')).toBe(
      'auto 0 max(0px, calc(88px - var(--page-margin))) auto'
    )
  })
})
