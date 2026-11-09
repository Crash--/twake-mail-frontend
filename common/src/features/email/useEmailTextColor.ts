import { useTheme } from '@linagora/twake-mui'

/**
 * The text colour of an email document: the light scheme's, as the document
 * stays on a white page in every scheme (`buildEmailDocument`)
 */
export function useEmailTextColor(): string {
  const theme = useTheme()
  return (
    theme.colorSchemes.light?.palette.text.primary ?? theme.palette.text.primary
  )
}
