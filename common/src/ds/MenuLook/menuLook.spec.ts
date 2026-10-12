import { TMAIL } from '@/ds/TmailColors/tmailColors'

import { menuLookThemeOptions } from './menuLook'

describe('menuLookThemeOptions', () => {
  it('gives the menus and their items the measures of tmail-flutter', () => {
    const { components } = menuLookThemeOptions()

    expect(components?.MuiMenu?.styleOverrides?.paper).toMatchObject({
      borderRadius: 6,
      minWidth: 178,
      maxWidth: 300
    })
    expect(components?.MuiMenuItem?.styleOverrides?.root).toMatchObject({
      minHeight: 48,
      fontSize: 14,
      color: TMAIL.textBlack
    })
  })
})
