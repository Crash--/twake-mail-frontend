// Upstream to twake-ui: no, to twake-libs: `@linagora/twake-feedback` puts
// its button at `zIndex.modal + 1` with no way to choose the layer; a
// `zIndex` prop there would make this wrapper useless.
import { ThemeProvider, type Theme } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/**
 * Layers a component places at `zIndex.modal + n` may take while staying
 * below the drawers (and so below the dialogs and the docked windows)
 */
const LAYERS_BELOW_DRAWERS = 2

function belowDrawersTheme(theme: Theme): Theme {
  return {
    ...theme,
    zIndex: {
      ...theme.zIndex,
      modal: theme.zIndex.drawer - LAYERS_BELOW_DRAWERS
    }
  }
}

export interface BelowDrawersProps {
  children: ReactNode
}

/**
 * Draws a floating element that lifts itself above the modals (a
 * `zIndex.modal + 1` of a shared library) below the drawers, the dialogs and
 * the docked windows instead: it must never cover a control of what the user
 * opened over the page. It stays above the app bar and the floating buttons.
 */
export function BelowDrawers({ children }: BelowDrawersProps): ReactElement {
  return <ThemeProvider theme={belowDrawersTheme}>{children}</ThemeProvider>
}
