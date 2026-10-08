// Upstream to twake-icons: yes. tmail-flutter's icons of the recipients of
// its composer (assets/images/ic_close.svg, ic_close_dialog.svg, ic_copy.svg,
// ic_filter_selected.svg), drawn in the current colour, for `Icon`.
import type { ReactElement, SVGAttributes } from 'react'

type SvgProps = SVGAttributes<SVGSVGElement>

/** The thin cross removing a recipient */
export function RemoveRecipientIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8.0056 6.82733C7.68016 6.50189 7.15252 6.50189 6.82709 6.82733C6.50165 7.15277 6.50165 7.6804 6.82709 8.00584L10.8212 11.9999L6.82709 15.994C6.50165 16.3194 6.50165 16.8471 6.82709 17.1725C7.15252 17.4979 7.68016 17.4979 8.0056 17.1725L11.9997 13.1784L15.9938 17.1725C16.3192 17.4979 16.8468 17.4979 17.1723 17.1725C17.4977 16.8471 17.4977 16.3194 17.1723 15.994L13.1782 11.9999L17.1723 8.00584C17.4977 7.6804 17.4977 7.15277 17.1723 6.82733C16.8468 6.50189 16.3192 6.50189 15.9938 6.82733L11.9997 10.8214L8.0056 6.82733Z" />
    </svg>
  )
}

/** The cross closing a card */
export function CloseCardIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" />
    </svg>
  )
}

/** Two sheets: copy */
export function CopyIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 28 28" fill="currentColor" {...props}>
      <path d="M17 2C18.3063 2 19.4175 2.83485 19.8293 4.00009L10.1278 4C8.34473 4 7.69816 4.18565 7.04631 4.53427C6.39446 4.88288 5.88288 5.39446 5.53427 6.04631C5.18565 6.69816 5 7.34473 5 9.12777L5.00009 19.8293C3.83485 19.4175 3 18.3063 3 17V8C3 4.68629 5.68629 2 9 2H17ZM21 6C22.6569 6 24 7.34315 24 9V22C24 23.6569 22.6569 25 21 25H10C8.34315 25 7 23.6569 7 22V9C7 7.34315 8.34315 6 10 6H21ZM21 8H10C9.44772 8 9 8.44772 9 9V22C9 22.5523 9.44772 23 10 23H21C21.5523 23 22 22.5523 22 22V9C22 8.44772 21.5523 8 21 8Z" />
    </svg>
  )
}

/** A tick in a disc: already chosen */
export function SelectedIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24ZM18.2071 9.20711C18.5976 8.81658 18.5976 8.18342 18.2071 7.79289C17.8166 7.40237 17.1834 7.40237 16.7929 7.79289L10 14.5858L7.20711 11.7929C6.81658 11.4024 6.18342 11.4024 5.79289 11.7929C5.40237 12.1834 5.40237 12.8166 5.79289 13.2071L9.29289 16.7071C9.68342 17.0976 10.3166 17.0976 10.7071 16.7071L18.2071 9.20711Z"
      />
    </svg>
  )
}
