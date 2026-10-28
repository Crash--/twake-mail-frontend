// Upstream to twake-icons: yes. tmail-flutter's composer icon that
// twake-icons lacks: "Send" on phones (ic_send_mobile.svg), drawn in the
// current colour, for `Icon`.
import { useId, type ReactElement, type SVGAttributes } from 'react'
import { iconProps } from '@/ds/FlutterIcons/iconColor'

const SEND_ARROW =
  'M20.7351 10.3422C20.5546 10.133 20.291 10 19.9948 10C19.6862 10 19.4132 10.1449 19.2327 10.3696C19.1941 10.4179 12.3893 17.225 12.3893 17.225C12.003 17.614 12.003 18.3302 12.3893 18.7188C12.7755 19.1078 13.5678 19.1078 13.9535 18.7188L18.8633 13.7378V28.7207C18.8633 29.2736 19.4488 29.7 19.9948 29.7C20.5413 29.7 21.1561 29.2736 21.1561 28.7207V13.7378L26.109 18.8763C26.4947 19.2653 27.2237 19.2653 27.6099 18.8763C27.9962 18.4878 27.9962 17.614 27.6099 17.225C27.6099 17.225 20.7722 10.385 20.7351 10.3422Z'

/**
 * "Send" on phones (ic_send_mobile.svg): a disc in the current colour, the
 * arrow up cut out of it (the mask is luminance, not a colour)
 */
export function SendMobileIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  const maskId = useId()
  return (
    <svg viewBox="0 0 40 40" fill="none" {...iconProps(props)}>
      <mask id={maskId}>
        <rect width="40" height="40" fill="white" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={SEND_ARROW}
          fill="black"
        />
      </mask>
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}
