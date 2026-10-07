// Local copy of the NavItem of @linagora/twake-mui 10.0, which goes with the
// local NavLink: since 10.1 the NavItem styles a row of the new NavLink (a
// `div`), not the `ListItemButton` of this one.
// To remove with the local NavLink.
import { ListItem, listItemButtonClasses } from '@mui/material'
import { styled } from '@mui/material/styles'

interface NavItemOwnProps {
  secondary?: boolean
}

export const NavItem = styled(ListItem, {
  shouldForwardProp: prop => prop !== 'secondary'
})<NavItemOwnProps>(({ theme, secondary }) => ({
  padding: 0,
  height: 36,
  minHeight: 0,
  [theme.breakpoints.down('lg')]: {
    display: 'block',
    height: 'auto',
    margin: '0 12px',
    flex: '0 0 40px'
  },
  ...(secondary && {
    height: 'auto',
    margin: '3px 0',
    [theme.breakpoints.down('lg')]: { display: 'none' },
    [`& .${listItemButtonClasses.root}`]: {
      margin: '0 16px 0 2.8rem',
      padding: '8px 16px',
      height: 'auto',
      fontSize: theme.typography.pxToRem(14),
      [`&.${listItemButtonClasses.selected}, &.active`]: {
        color: theme.vars.palette.secondary.contrastText,
        backgroundColor: theme.vars.palette.secondary.main
      }
    }
  })
}))
