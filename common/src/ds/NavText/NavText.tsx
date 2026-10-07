// Local copy of the NavText of @linagora/twake-mui 10.0, which goes with the
// local NavLink: since 10.1 it is a column of texts (`div`) with its own
// margin, not a single `span`.
// To remove with the local NavLink.
import { styled } from '@mui/material/styles'

export const NavText = styled('span')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 500,
  letterSpacing: '.15px',
  [theme.breakpoints.down('lg')]: {
    display: 'block',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    fontSize: theme.typography.pxToRem(12)
  }
}))
