import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'

/**
 * Renders a design system component in the twake-mui theme, and nothing
 * else: no translations, no router, no data. A ds component that needs more
 * is not a ds component.
 */
export function renderDs(ui: ReactElement): RenderResult {
  return render(<TwakeMuiThemeProvider>{ui}</TwakeMuiThemeProvider>)
}
