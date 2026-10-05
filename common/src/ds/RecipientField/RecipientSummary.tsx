// Upstream to twake-ui: with RecipientField.
import { Icon, Warning } from '@linagora/twake-icons'
import { Box, ButtonBase, Typography } from '@linagora/twake-mui'
// Not twake-mui's Chip, as in RecipientField (docs/twake-mui-gaps.md)
import Chip from '@mui/material/Chip'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement
} from 'react'

import { RecipientAvatar } from './RecipientAvatar'
import {
  INVALID_CHIP_SX,
  RECIPIENT_CHIP_SX,
  type RecipientFieldChip
} from './RecipientField'

/** Gap between the chips, and room kept for the "+N" counter, in px */
const GAP = 8
const COUNTER_ROOM = 56
/** Past this, the counter says "999+" (tmail-flutter) */
const MAX_COUNT = 999

export interface RecipientSummaryProps {
  /** Every recipient of the folded fields, in order */
  chips: readonly RecipientFieldChip[]
  /** Read before the names, not shown ("Show all the recipients:") */
  label: string
  /** The counter of the recipients that do not fit ("+2") */
  moreLabel: (count: number) => string
  onExpand: () => void
  'data-testid'?: string
}

function SummaryChip({ chip }: { chip: RecipientFieldChip }): ReactElement {
  return (
    <Chip
      component="span"
      size="small"
      variant={chip.isInvalid ? 'outlined' : 'filled'}
      avatar={
        chip.isInvalid || chip.avatar === undefined ? undefined : (
          <RecipientAvatar of={chip.avatar} />
        )
      }
      icon={
        chip.isInvalid ? <Icon icon={Warning} aria-hidden="true" /> : undefined
      }
      label={chip.label}
      sx={{
        ...(chip.isInvalid ? INVALID_CHIP_SX : RECIPIENT_CHIP_SX),
        maxWidth: '100%',
        flexShrink: 1,
        minWidth: 0
      }}
    />
  )
}

/**
 * Recipient fields folded into one line, as tall as a field: the first
 * recipients as chips and a counter ("+2") for those that do not fit, in a
 * button that unfolds the fields. Its name is the label then every name; the
 * chips themselves are decorative.
 */
export function RecipientSummary({
  chips,
  label,
  moreLabel,
  onExpand,
  'data-testid': testId
}: RecipientSummaryProps): ReactElement {
  const boxRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [fitting, setFitting] = useState(chips.length)

  const fit = useCallback((): void => {
    const width = boxRef.current?.clientWidth ?? 0
    const sizes = Array.from(measureRef.current?.children ?? []).map(
      child => (child as HTMLElement).offsetWidth
    )
    // Not laid out (a test, a hidden pane): show them all
    if (width === 0 || sizes.every(size => size === 0)) {
      setFitting(chips.length)
      return
    }
    const total =
      sizes.reduce((sum, size) => sum + size, 0) + GAP * (sizes.length - 1)
    if (total <= width) {
      setFitting(chips.length)
      return
    }
    let used = 0
    let count = 0
    for (const size of sizes) {
      if (count > 0 && used + size > width - COUNTER_ROOM) break
      used += size + GAP
      count += 1
    }
    setFitting(Math.max(count, 1))
  }, [chips.length])

  useLayoutEffect(() => {
    fit()
  }, [fit, chips])

  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => {
      observer.disconnect()
    }
  }, [fit])

  const hidden = chips.length - fitting
  const counter =
    hidden > MAX_COUNT ? `${String(MAX_COUNT)}+` : moreLabel(hidden)

  return (
    <ButtonBase
      onClick={onExpand}
      className="u-w-100 u-ov-hidden"
      sx={{
        justifyContent: 'flex-start',
        minHeight: 37,
        px: 2,
        py: 0.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2
        }
      }}
      data-testid={testId}
    >
      <span className="u-visuallyhidden">
        {label} {chips.map(chip => chip.label).join(', ')}
      </span>
      <Box
        component="span"
        ref={boxRef}
        aria-hidden="true"
        className="u-flex u-flex-items-center u-flex-auto"
        sx={{ position: 'relative', gap: `${String(GAP)}px`, minWidth: 0 }}
      >
        {chips.slice(0, fitting).map(chip => (
          <SummaryChip key={chip.id} chip={chip} />
        ))}
        {hidden > 0 ? (
          <Typography
            component="span"
            variant="body2"
            className="u-flex u-flex-items-center u-flex-justify-center u-flex-shrink-0"
            sx={{
              height: 32,
              px: 1,
              borderRadius: '10px',
              bgcolor: 'background.default',
              fontWeight: 500
            }}
          >
            {counter}
          </Typography>
        ) : null}
        {/* Every chip at its natural width, to know how many fit */}
        <Box
          component="span"
          ref={measureRef}
          sx={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            display: 'flex',
            gap: `${String(GAP)}px`,
            height: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        >
          {chips.map(chip => (
            <Box
              component="span"
              key={chip.id}
              sx={{ display: 'inline-flex', flexShrink: 0 }}
            >
              <SummaryChip chip={chip} />
            </Box>
          ))}
        </Box>
      </Box>
    </ButtonBase>
  )
}
