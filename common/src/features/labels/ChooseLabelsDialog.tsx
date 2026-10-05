import { Plus, Icon, Label as LabelGlyph } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Empty,
  FormControlLabel,
  List,
  ListItem,
  ListSkeleton,
  Typography
} from '@linagora/twake-mui'
import type { Label } from 'jmap-client-ts/linagora'
import { useId, useState, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useI18n } from '@common/i18n/useI18n'

import { LabelDialog } from './LabelDialog'
import { LabelIcon } from './LabelIcon'
import { useLabels } from './queries'

export interface LabelChoice {
  added: Label[]
  removed: Label[]
}

export interface ChooseLabelsDialogProps {
  emails: readonly TargetEmail[]
  onApply: (choice: LabelChoice) => void
  onClose: () => void
}

function isOnAll(label: Label, emails: readonly TargetEmail[]): boolean {
  return emails.every(email => label.keyword in email.keywords)
}

/**
 * "Label as": the labels, checked when every email has them, to add or
 * take off at once; "Create a label" adds one, checked (tmail-flutter's
 * choose label modal)
 */
export function ChooseLabelsDialog({
  emails,
  onApply,
  onClose
}: ChooseLabelsDialogProps): ReactElement {
  const { t } = useI18n()
  const query = useLabels()
  const labels = query.data?.list ?? []
  const titleId = useId()
  const subtitleId = useId()
  const [checked, setChecked] = useState<ReadonlySet<string> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const initial = new Set(
    labels.filter(label => isOnAll(label, emails)).map(label => label.id)
  )
  const current = checked ?? initial
  const added = labels.filter(
    label => current.has(label.id) && !initial.has(label.id)
  )
  const removed = labels.filter(
    label => !current.has(label.id) && initial.has(label.id)
  )

  const toggle = (id: string, isOn: boolean): void => {
    const next = new Set(current)
    if (isOn) next.add(id)
    else next.delete(id)
    setChecked(next)
  }

  const createButton = (
    <Button
      // Inherited, the grey of `Empty` lacks contrast
      variant={labels.length === 0 ? 'contained' : 'text'}
      color={labels.length === 0 ? 'primary' : 'inherit'}
      startIcon={<Icon icon={Plus} />}
      onClick={() => {
        setIsCreating(true)
      }}
      data-testid="choose-label-create-button"
    >
      {t('labels.choose.create')}
    </Button>
  )

  return (
    <>
      <Dialog
        open={!isCreating}
        onClose={onClose}
        size="medium"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        data-testid="choose-label-modal"
      >
        <DialogTitle id={titleId}>{t('labels.choose.title')}</DialogTitle>
        <DialogContent>
          <SecondaryText id={subtitleId} variant="body2" component="p">
            {t('labels.choose.subtitle')}
          </SecondaryText>
          {query.isPending ? (
            <ListSkeleton count={3} />
          ) : labels.length === 0 ? (
            <Empty
              icon={LabelGlyph}
              // The title of `Empty` lacks contrast (docs/twake-mui-gaps.md)
              title={
                <Typography
                  component="span"
                  variant="inherit"
                  color="textPrimary"
                >
                  {t('labels.choose.emptyTitle')}
                </Typography>
              }
              text={
                <SecondaryText>{t('labels.choose.emptyMessage')}</SecondaryText>
              }
              data-testid="choose-label-empty"
            >
              {createButton}
            </Empty>
          ) : (
            <>
              <List data-testid="choose-label-list">
                {labels.map(label => (
                  <ListItem
                    key={label.id}
                    disablePadding
                    data-testid="choose-label-item"
                  >
                    <FormControlLabel
                      className="u-w-100 u-mh-0"
                      control={
                        <Checkbox
                          checked={current.has(label.id)}
                          onChange={event => {
                            toggle(label.id, event.target.checked)
                          }}
                        />
                      }
                      label={
                        <Box className="u-flex u-flex-items-center">
                          <LabelIcon color={label.color} />
                          <span className="u-ml-half">{label.displayName}</span>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              {createButton}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            data-testid="choose-label-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={added.length === 0 && removed.length === 0}
            onClick={() => {
              onApply({ added, removed })
            }}
            data-testid="choose-label-apply-button"
          >
            {t('labels.choose.apply')}
          </Button>
        </DialogActions>
      </Dialog>
      {isCreating ? (
        <LabelDialog
          label={null}
          onCreated={created => {
            toggle(created.id, true)
          }}
          onClose={() => {
            setIsCreating(false)
          }}
        />
      ) : null}
    </>
  )
}
