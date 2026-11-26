import { useColorScheme, useTheme } from '@linagora/twake-mui'
import { useMemo } from 'react'

import type { EmailDocumentColors } from './emailBody'

export interface EmailDocumentSchemes {
  /** The white page, with the greys of tmail-flutter's quoted history */
  light: EmailDocumentColors
  /** The page of the reading pane in the dark scheme, null in the light one */
  dark: EmailDocumentColors | null
}

/** The colours an email document can take: the theme does not reach the frame */
export function useEmailDocumentColors(): EmailDocumentSchemes {
  const theme = useTheme()
  const { colorScheme } = useColorScheme()
  return useMemo(() => {
    const dark = theme.colorSchemes.dark?.palette
    return {
      light: {
        scheme: 'light',
        background: '#ffffff',
        text:
          theme.colorSchemes.light?.palette.text.primary ??
          theme.palette.text.primary,
        quoteBorder: '#c4c4c4',
        historyButton: '#e3e7ee',
        historyButtonHover: '#cdd3dc',
        historyDots: '#55687d',
        link: null
      },
      dark:
        colorScheme === 'dark' && dark !== undefined
          ? {
              scheme: 'dark',
              background: dark.background.paper,
              text: dark.text.primary,
              quoteBorder: dark.border.main,
              historyButton: dark.action.selected,
              historyButtonHover: dark.action.focus,
              historyDots: dark.text.secondary,
              // primary.main is below the AA contrast on the dark page
              link: dark.primary.light
            }
          : null
    }
  }, [theme, colorScheme])
}
