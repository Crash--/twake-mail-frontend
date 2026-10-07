// Local copy of the NavLink of @linagora/twake-mui 10.0. Since 10.1 it is a
// `div role="button"` that cannot be a link, and it no longer carries the
// `ListItemButton` classes `NavTreeItem` and the settings navigation style.
// To remove once the NavLink of twake-ui can render a link.
import {
  ListItemButton,
  listItemButtonClasses,
  listItemIconClasses
} from '@mui/material'
import { styled } from '@mui/material/styles'

// Cast keeps ListItemButton's `component` generic (react-router Link etc.)
export const NavLink = styled(ListItemButton)(({ theme }) => ({
  margin: '0 16px',
  padding: '0 8px',
  height: '100%',
  minHeight: 0,
  gap: 0,
  borderRadius: 8,
  lineHeight: 1.375,
  color: theme.vars.palette.text.primary,
  [`&.${listItemButtonClasses.selected}, &.active`]: {
    color: theme.vars.palette.primary.main,
    backgroundColor: theme.vars.palette.action.selected,
    '&:hover': { backgroundColor: theme.vars.palette.action.selected },
    [`& .${listItemIconClasses.root}`]: {
      color: theme.vars.palette.primary.main
    }
  },
  [theme.breakpoints.down('lg')]: {
    display: 'block',
    height: 'auto',
    margin: 0,
    padding: 0,
    textAlign: 'center',
    fontSize: theme.typography.pxToRem(11),
    lineHeight: '12px',
    color: theme.vars.palette.text.secondary,
    [`&.${listItemButtonClasses.selected}, &.active`]: {
      color: theme.vars.palette.text.primary,
      backgroundColor: 'transparent',
      [`& .${listItemIconClasses.root}`]: {
        color: theme.vars.palette.text.primary
      }
    }
  }
})) as typeof ListItemButton
