// Upstream to twake-icons: yes. tmail-flutter's composer icons that
// twake-icons lacks: the formatting options, "Aa" (ic_rich_toolbar.svg), and
// "Send" on phones (ic_send_mobile.svg); drawn in the current colour, for
// `Icon`.
import type { ReactElement, SVGAttributes } from 'react'
import { iconProps } from '@/ds/FlutterIcons/iconColor'

/** "Aa": the formatting options */
export function FormattingIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 28 28" fill="none" {...iconProps(props)}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.54378 21.1298C4.20402 21.1298 4.57202 20.8051 4.83179 19.9609L5.8492 16.9086H11.196L12.2135 19.9609C12.4624 20.7943 12.8521 21.1298 13.5123 21.1298C14.2158 21.1298 14.6812 20.7185 14.6812 20.0691C14.6812 19.7985 14.6163 19.5063 14.4972 19.1491L10.4384 7.66528C10.0704 6.5721 9.54004 6.10669 8.55509 6.10669C7.57015 6.10669 7.0398 6.58293 6.66097 7.66528L2.60213 19.1491C2.46143 19.5604 2.39648 19.8418 2.39648 20.1016C2.39648 20.7293 2.8619 21.1298 3.54378 21.1298ZM6.43368 15.0253L8.46851 8.78011H8.58757L10.6116 15.0253H6.43368Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M23.0587 19.5171H23.1777V20.0258C23.2319 20.7077 23.654 21.1082 24.3142 21.1082C25.061 21.1082 25.4832 20.6319 25.4832 19.8093V13.2611C25.4832 10.7716 23.8704 9.38623 20.9806 9.38623C19.79 9.38623 18.8808 9.59188 18.1881 9.9707C17.2248 10.4902 16.7702 11.1396 16.7702 11.7999C16.7702 12.3194 17.1165 12.6766 17.6469 12.6766C18.0582 12.6766 18.3396 12.5684 18.6318 12.2869C19.2921 11.6159 19.9198 11.2912 20.829 11.2912C22.2902 11.2912 23.0803 11.9622 23.0803 13.2502V14.2677H20.2229C17.6685 14.2785 16.1316 15.5665 16.1316 17.6771C16.1316 19.7552 17.6361 21.1623 19.8657 21.1623C21.2836 21.1623 22.4309 20.5778 23.0587 19.5171ZM18.5452 17.558C18.5452 16.5081 19.2813 15.9128 20.5584 15.9128H23.0803V17.1467C23.0803 18.3806 22.0088 19.3331 20.6126 19.3331C19.3787 19.3331 18.5452 18.6187 18.5452 17.558Z"
        fill="currentColor"
      />
    </svg>
  )
}

const SEND_ARROW =
  'M20.7351 10.3422C20.5546 10.133 20.291 10 19.9948 10C19.6862 10 19.4132 10.1449 19.2327 10.3696C19.1941 10.4179 12.3893 17.225 12.3893 17.225C12.003 17.614 12.003 18.3302 12.3893 18.7188C12.7755 19.1078 13.5678 19.1078 13.9535 18.7188L18.8633 13.7378V28.7207C18.8633 29.2736 19.4488 29.7 19.9948 29.7C20.5413 29.7 21.1561 29.2736 21.1561 28.7207V13.7378L26.109 18.8763C26.4947 19.2653 27.2237 19.2653 27.6099 18.8763C27.9962 18.4878 27.9962 17.614 27.6099 17.225C27.6099 17.225 20.7722 10.385 20.7351 10.3422Z'

function SendDisc({
  color,
  ...props
}: SVGAttributes<SVGSVGElement> & { color: string }): ReactElement {
  return (
    <svg viewBox="0 0 40 40" fill="none" {...iconProps(props)}>
      <circle cx="20" cy="20" r="18" fill={color} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={SEND_ARROW}
        fill="#FFFFFF"
      />
    </svg>
  )
}

/** "Send" on phones (ic_send_mobile.svg): a white arrow up in a blue disc */
export function SendMobileIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return <SendDisc {...props} color="#007AFF" />
}

/** The same, grey, while there is no recipient (ic_send_disable.svg) */
export function SendDisabledIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return <SendDisc {...props} color="#AEAEC0" />
}
