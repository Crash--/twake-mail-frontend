import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18n } from 'twake-i18n'

function noDictionary(): Record<string, never> {
  return {}
}

/**
 * Renders a design system component in the twake-mui theme, and nothing
 * else: no translations of the app, no router, no data. A ds component that
 * needs more is not a ds component. The empty `I18n` is for twake-mui, whose
 * `VirtualizedTable` header needs one (docs/twake-mui-gaps.md).
 */
export function renderDs(ui: ReactElement): RenderResult {
  return render(
    <TwakeMuiThemeProvider>
      <I18n lang="en" dictRequire={noDictionary} polyglot={null} context={null}>
        {ui}
      </I18n>
    </TwakeMuiThemeProvider>
  )
}
