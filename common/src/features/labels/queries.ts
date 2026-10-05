import {
  queryOptions,
  useQuery,
  type QueryClient,
  type UseQueryResult
} from '@tanstack/react-query'
import type { ChangesResponse, JmapClient } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES, type Label } from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { useLabelVisibility } from './labelVisibility'

/** The labels of the account, and the state they reflect */
export interface LabelListData {
  state: string
  list: Label[]
}

export type LabelsKey = readonly ['labels', string]

export const labelKeys = {
  all: (accountId: string): LabelsKey => ['labels', accountId]
}

/** The colour of a label without one (tmail-flutter) */
export const DEFAULT_LABEL_COLOR = '#0A84FF'

/** By name, whatever the case, as tmail-flutter lists them */
export function sortLabels(labels: readonly Label[]): Label[] {
  return [...labels].sort((first, second) =>
    first.displayName.localeCompare(second.displayName, undefined, {
      sensitivity: 'base'
    })
  )
}

/** The labels of the account (`Label/get`), sorted */
export function labelsQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<LabelListData, LabelsKey> {
  return queryOptions({
    queryKey: labelKeys.all(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Label/get',
        { accountId, ids: null },
        { signal }
      )
      return { state: response.state, list: sortLabels(response.list) }
    }
  })
}

/**
 * Whether labels show: the server has them and the user did not turn them
 * off (Settings > Preferences, as tmail-flutter's "Label visibility")
 */
export function useLabelsAvailable(): boolean {
  const { session } = useJmapSession()
  const [isVisible] = useLabelVisibility()
  return LINAGORA_CAPABILITIES.labels in session.capabilities && isVisible
}

/** The labels, when available */
export function useLabels(): UseQueryResult<LabelListData> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useQuery({
    ...labelsQueryOptions(client, accountId),
    enabled: useLabelsAvailable()
  })
}

const MAX_CHANGES_ROUNDS = 5

/**
 * Brings the cached labels up to `newState` with `Label/changes` and the
 * `Label/get` of what was created or updated; reloads them all when the
 * server cannot tell the changes (tmail-backend answers
 * `invalidArguments` to a state it does not know).
 */
export async function syncLabels(
  client: JmapClient,
  queryClient: QueryClient,
  accountId: string,
  newState: string | null
): Promise<void> {
  const key = labelKeys.all(accountId)
  let data = queryClient.getQueryData<LabelListData>(key)
  if (!data || data.state === newState) return
  try {
    for (let round = 0; round < MAX_CHANGES_ROUNDS; round += 1) {
      const changes: ChangesResponse = await client.call('Label/changes', {
        accountId,
        sinceState: data.state
      })
      const changedIds = [...changes.created, ...changes.updated]
      const fetched =
        changedIds.length === 0
          ? []
          : (await client.call('Label/get', { accountId, ids: changedIds }))
              .list
      const gone = new Set([
        ...changes.destroyed,
        // Changed then destroyed before the get
        ...changedIds.filter(id => !fetched.some(label => label.id === id))
      ])
      const fetchedIds = new Set(fetched.map(label => label.id))
      data = {
        state: changes.newState,
        list: sortLabels([
          ...data.list.filter(
            label => !gone.has(label.id) && !fetchedIds.has(label.id)
          ),
          ...fetched
        ])
      }
      queryClient.setQueryData(key, data)
      if (!changes.hasMoreChanges) return
    }
  } catch (error: unknown) {
    console.info('[labels] Reloading the labels', error)
  }
  await queryClient.invalidateQueries({ queryKey: key })
}
