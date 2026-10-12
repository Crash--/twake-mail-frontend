// Upstream to twake-ui: no, the look of tmail-flutter's popup menus
// (`showMenu` in `PopupContextMenuActionMixin`, `PopupItemWidgetStyle`):
// white, a 6 px radius, elevation 8, 8 px above and below the items, 178
// to 300 px wide; 48 px items, a 20 px steel grey icon 16 px before the
// label in Regular 14 / 18 black. Every menu of the app takes it, as the
// focus indicator, from the theme (AGENTS.md).
import type { ThemeOptions } from '@mui/material/styles'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const ICON_COLOR = TMAIL.steel

/** The theme options giving the menus the look of tmail-flutter */
export function menuLookThemeOptions(): ThemeOptions {
  return {
    components: {
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 6,
            minWidth: 178,
            maxWidth: 300,
            backgroundColor: TMAIL.surface,
            boxShadow:
              '0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14), 0 3px 14px 2px rgba(0, 0, 0, 0.12)'
          },
          list: { paddingTop: 8, paddingBottom: 8 }
        }
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: 48,
            paddingTop: 0,
            paddingBottom: 0,
            // MUI drops the min height from 600 px up
            '@media (min-width: 600px)': { minHeight: 48 },
            '& .MuiListItemText-root': { marginTop: 0, marginBottom: 0 },
            paddingLeft: 16,
            paddingRight: 16,
            fontSize: 14,
            lineHeight: '18px',
            fontWeight: 400,
            letterSpacing: 0,
            color: TMAIL.textBlack,
            '& .MuiListItemText-primary': {
              fontSize: 14,
              lineHeight: '18px',
              color: TMAIL.textBlack
            },
            '& .MuiListItemIcon-root': {
              minWidth: 36,
              color: ICON_COLOR
            },
            '& .MuiListItemIcon-root svg': { width: 20, height: 20 }
          }
        }
      }
    }
  }
}
