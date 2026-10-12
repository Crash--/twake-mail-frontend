import type { SVGAttributes } from 'react'

/**
 * The props of an icon of tmail-flutter drawn in `currentColor`: the
 * `color` of twake-icons' `Icon` arrives as a `fill` style, which such
 * paths ignore; it becomes the current colour of the drawing
 */
export function iconProps(
  props: SVGAttributes<SVGSVGElement>
): SVGAttributes<SVGSVGElement> {
  const fill = props.style?.fill
  return fill === undefined
    ? props
    : { ...props, style: { ...props.style, color: fill } }
}
