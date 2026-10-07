// Upstream to twake-ui: yes, as an option of `Nav`. twake-mui's `Nav` wraps
// its list in a `<nav>` that takes none of its props: it cannot be named, and
// inside a named `nav` it makes a second, nested, unnamed landmark (RGAA
// 12.6). This is the list of `Nav`, with the same styles, without the `<nav>`.
// To remove when `Nav` can render without its landmark.
import { List } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * The list of `Nav` without its `<nav>`: the caller puts it in a named
 * navigation landmark (or a `role="tree"` it names) of its own.
 */
export const NavList = styled(List)(({ theme }) => ({
  margin: '24px 0',
  padding: 0,
  [theme.breakpoints.down('lg')]: {
    display: 'flex',
    justifyContent: 'space-around',
    margin: '6px 0 4px'
  }
}))
