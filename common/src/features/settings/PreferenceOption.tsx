import { Box, FormControlLabel, Switch, Typography } from '@linagora/twake-mui'
import { useId, type ChangeEvent, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'

export interface PreferenceOptionProps {
  title: string
  description: string
  /** Label of the switch, e.g. "Enable thread" */
  toggleLabel: string
  isChecked: boolean
  isDisabled?: boolean
  onChange: (isChecked: boolean) => void
  'data-testid': string
}

/**
 * An option of Settings > Preferences, as tmail-flutter shows it: its
 * title, what it does, and the switch (described by both)
 */
export function PreferenceOption({
  title,
  description,
  toggleLabel,
  isChecked,
  isDisabled = false,
  onChange,
  'data-testid': testId
}: PreferenceOptionProps): ReactElement {
  const titleId = useId()
  const descriptionId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked)
  }

  return (
    <Box component="section" aria-labelledby={titleId} className="u-mb-1-half">
      <Typography
        id={titleId}
        variant="subtitle1"
        component="h2"
        color="textPrimary"
        className="u-fw-bold"
      >
        {title}
      </Typography>
      <SecondaryText id={descriptionId} variant="body2" component="p">
        {description}
      </SecondaryText>
      <FormControlLabel
        control={
          <Switch
            checked={isChecked}
            disabled={isDisabled}
            onChange={handleChange}
            slotProps={{
              input: { 'aria-describedby': `${titleId} ${descriptionId}` }
            }}
            data-testid={testId}
          />
        }
        label={toggleLabel}
      />
    </Box>
  )
}
