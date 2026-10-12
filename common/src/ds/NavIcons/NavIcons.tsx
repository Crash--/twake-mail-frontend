// Upstream to twake-icons: yes. The glyphs of tmail-flutter's sidebar
// (linagora_design_flutter's `LinagoraSidebar*`): the disclosure arrows are
// Material's `keyboard_arrow_down` / `keyboard_arrow_right`, the "new
// folder" and "new label" button is ic_add_new_folder.svg, the storage
// ic_quotas.svg. Drawn in the current colour, for `Icon`.
import type { ReactElement, SVGAttributes } from 'react'

import { iconProps } from '@/ds/FlutterIcons/iconColor'

type SvgProps = SVGAttributes<SVGSVGElement>

/** Material's keyboard_arrow_down: an expanded section or folder */
export function DisclosureDown(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...iconProps(props)}>
      <path
        d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Material's keyboard_arrow_right: a collapsed section or folder */
export function DisclosureRight(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...iconProps(props)}>
      <path
        d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** tmail-flutter's ic_add_new_folder.svg */
export function AddNewFolder(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...iconProps(props)}>
      <path
        d="M10 2.85693C10.3945 2.85693 10.7143 3.17673 10.7143 3.57122V9.28551L16.4286 9.28551C16.8231 9.28551 17.1429 9.6053 17.1429 9.99979C17.1429 10.3943 16.8231 10.7141 16.4286 10.7141L10.7143 10.7141L10.7143 16.4284C10.7143 16.8229 10.3945 17.1426 10 17.1426C9.60555 17.1426 9.28575 16.8229 9.28575 16.4284L9.28575 10.7141H3.57146C3.17697 10.7141 2.85718 10.3943 2.85718 9.99979C2.85718 9.6053 3.17697 9.28551 3.57146 9.28551H9.28575V3.57122C9.28575 3.17673 9.60555 2.85693 10 2.85693Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** tmail-flutter's ic_quotas.svg */
export function Quotas(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...iconProps(props)}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.7139 5.14284C8.11024 5.14284 5.99958 7.2535 5.99958 9.85713C5.99958 10.0769 6.01457 10.2928 6.04346 10.5038C6.09606 10.8879 5.88429 11.2595 5.527 11.41C4.2923 11.9301 3.42815 13.1508 3.42815 14.5714C3.42815 16.465 4.96318 18 6.85672 18H16.2853C18.6522 18 20.571 16.0812 20.571 13.7143C20.571 11.3473 18.6522 9.42856 16.2853 9.42856C16.2437 9.42856 16.2023 9.42915 16.161 9.43032C15.7545 9.44185 15.3958 9.1661 15.3024 8.77024C14.812 6.69024 12.9426 5.14284 10.7139 5.14284ZM4.2853 9.85713C4.2853 6.30673 7.16347 3.42856 10.7139 3.42856C13.5213 3.42856 15.9068 5.22744 16.7835 7.73467C19.8641 7.98791 22.2853 10.5683 22.2853 13.7143C22.2853 17.028 19.599 19.7143 16.2853 19.7143H6.85672C4.0164 19.7143 1.71387 17.4117 1.71387 14.5714C1.71387 12.6646 2.75142 11.0018 4.29034 10.1139C4.28699 10.0287 4.2853 9.94308 4.2853 9.85713Z"
        fill="currentColor"
      />
    </svg>
  )
}
