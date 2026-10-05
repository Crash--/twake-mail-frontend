import { Box } from '@linagora/twake-mui'
import type { Label } from 'jmap-client-ts/linagora'
import type { ReactElement } from 'react'

import { ColorTag } from '@/ds/ColorTag/ColorTag'
import { useI18n } from '@common/i18n/useI18n'

import { DEFAULT_LABEL_COLOR } from './queries'

/** The labels of an email among `labels`, in their order */
export function labelsOfEmail(
  labels: readonly Label[],
  email: { keywords: Record<string, true> }
): Label[] {
  return labels.filter(label => label.keyword in email.keywords)
}

export interface LabelChipsProps {
  labels: readonly Label[]
  /** Shows that many, then "+N" (tmail-flutter: 3 on a desktop list) */
  max?: number
  /** Gives each chip a × taking the label off */
  onRemove?: (label: Label) => void
  /** `small`: the tags of a list row (11 / 14) */
  size?: 'small' | 'medium'
  /** Keeps the chips on one line (a list row) instead of wrapping them */
  nowrap?: boolean
  className?: string
}

/** The labels of an email, as coloured tags */
export function LabelChips({
  labels,
  max,
  onRemove,
  size = 'medium',
  nowrap = false,
  className
}: LabelChipsProps): ReactElement | null {
  const { t } = useI18n()
  if (labels.length === 0) return null
  const shown = max === undefined ? labels : labels.slice(0, max)
  const hidden = labels.length - shown.length

  return (
    <Box
      component="span"
      role="list"
      aria-label={t('labels.listLabel')}
      className={`u-flex ${nowrap ? 'u-flex-nowrap' : 'u-flex-wrap'} u-flex-items-center ${className ?? ''}`}
      data-testid="label-chips"
    >
      {shown.map((label, index) => (
        <Box
          component="span"
          role="listitem"
          key={label.id}
          className={
            index < shown.length - 1 || hidden > 0 ? 'u-mr-half' : undefined
          }
        >
          <ColorTag
            label={label.displayName}
            color={label.color ?? DEFAULT_LABEL_COLOR}
            size={size}
            maxLength={max === undefined ? undefined : 16}
            removeLabel={t('labels.removeFromEmail', {
              name: label.displayName
            })}
            onRemove={
              onRemove
                ? () => {
                    onRemove(label)
                  }
                : undefined
            }
            data-testid="label-chip"
          />
        </Box>
      ))}
      {hidden > 0 ? (
        <Box component="span" role="listitem">
          <span aria-hidden>
            <ColorTag
              label={`+${hidden}`}
              color="#F3F6F9"
              size={size}
              data-testid="label-chip-more"
            />
          </span>
          <span className="u-visuallyhidden">
            {t('labels.moreCount', { count: hidden })}
          </span>
        </Box>
      ) : null}
    </Box>
  )
}
