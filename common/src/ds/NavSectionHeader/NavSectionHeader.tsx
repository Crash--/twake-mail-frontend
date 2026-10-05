// Upstream to twake-ui: yes, as the `subheader` of `Nav`. twake-mui only has
// `ListSubheader` (14/600 on a contrast background, which also breaks a
// `role="tree"` it is put in). Collapsing sections comes later.
import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { NAV_SECONDARY_TEXT } from '@/ds/navColors/navColors'

export interface NavSectionHeaderProps {
  title: string
  /** Id of the heading, for the `aria-labelledby` of the list it titles */
  titleId: string
  /** Icon buttons (each with its `aria-label` and tooltip) at the end */
  actions?: ReactNode
  'data-testid'?: string
}

/**
 * The title of a section of a sidebar ("Folders", "Labels"): a heading in
 * 12/500 secondary text, outside the list it titles, and its actions.
 */
export function NavSectionHeader({
  title,
  titleId,
  actions,
  'data-testid': testId
}: NavSectionHeaderProps): ReactElement {
  return (
    <div className="u-flex u-flex-items-center u-pl-1 u-pr-half">
      <Typography
        id={titleId}
        variant="caption"
        component="h2"
        className="u-flex-auto"
        data-testid={testId}
        sx={{
          color: NAV_SECONDARY_TEXT,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: '15.8px',
          letterSpacing: 0.5,
          py: 1
        }}
      >
        {title}
      </Typography>
      {actions}
    </div>
  )
}
