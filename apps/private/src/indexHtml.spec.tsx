import fs from 'node:fs'
import path from 'node:path'

import { render } from '@testing-library/react'
import { JSDOM, type DOMWindow } from 'jsdom'

const INDEX_HTML = fs
  .readFileSync(path.resolve(__dirname, '../../../public/index.html'), 'utf8')
  .replaceAll('<%= assetPrefix %>', '')

interface BootPage {
  window: DOMWindow
  /** Runs the timers the inline scripts started */
  runTimers: () => void
}

/** Loads index.html with its inline scripts, before the bundle arrives */
function loadIndexHtml({
  storedLanguage = null,
  browserLanguages = ['en-US']
}: {
  storedLanguage?: string | null
  browserLanguages?: string[]
} = {}): BootPage {
  const timers: (() => void)[] = []
  const { window } = new JSDOM(INDEX_HTML, {
    runScripts: 'dangerously',
    url: 'https://mail.example.com/',
    beforeParse(beforeWindow) {
      if (storedLanguage !== null) {
        beforeWindow.localStorage.setItem('lang', storedLanguage)
      }
      Object.defineProperty(beforeWindow.navigator, 'languages', {
        value: browserLanguages
      })
      beforeWindow.matchMedia = (): MediaQueryList =>
        new beforeWindow.EventTarget() as MediaQueryList // SAFETY: matches is read as falsy
      beforeWindow.setTimeout = ((callback: () => void): number => {
        timers.push(callback)
        return timers.length
      }) as typeof beforeWindow.setTimeout // SAFETY: test double of the timer
    }
  })
  return {
    window,
    runTimers: () => timers.splice(0).forEach(callback => callback())
  }
}

function bootStatus(window: DOMWindow): HTMLElement | null {
  return window.document.querySelector('#root [role="status"]')
}

function bootStatusText(window: DOMWindow): string | undefined {
  return bootStatus(window)?.textContent.trim()
}

describe('index.html boot shell', () => {
  it('shows a status text and a spinner before the bundle is loaded', () => {
    const { window } = loadIndexHtml()

    const status = bootStatus(window)
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.textContent.trim()).toBe('Loading... Please wait!')
    expect(
      status?.querySelector('.boot-spinner')?.getAttribute('aria-hidden')
    ).toBe('true')
  })

  it('speaks the language chosen in this browser', () => {
    const { window } = loadIndexHtml({ storedLanguage: 'fr' })

    const text = window.document.getElementById('boot-text')
    expect(text?.textContent).toBe('Chargement... Veuillez patienter !')
    expect(text?.getAttribute('lang')).toBe('fr')
  })

  it('falls back on the language of the browser, then on English', () => {
    expect(
      bootStatusText(loadIndexHtml({ browserLanguages: ['de-DE'] }).window)
    ).toBe('Lädt... Bitte warten!')
    expect(
      bootStatusText(loadIndexHtml({ browserLanguages: ['ar', 'ja'] }).window)
    ).toBe('Loading... Please wait!')
  })

  it('asks to check the connection when the bundle is slow', () => {
    const { window, runTimers } = loadIndexHtml({ storedLanguage: 'es' })

    runTimers()

    expect(bootStatusText(window)).toBe(
      'Todavía cargando. Compruebe su conexión.'
    )
  })

  it('is replaced by the first render of React', () => {
    const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(INDEX_HTML)?.[1] ?? ''
    document.body.innerHTML = body
    const container = document.getElementById('root')
    if (container === null) throw new Error('#root not found')

    // createRoot, as index.tsx
    render(<p>Inbox</p>, { container })

    expect(document.getElementById('boot-shell')).toBe(null)
    expect(container.textContent).toBe('Inbox')
  })
})
