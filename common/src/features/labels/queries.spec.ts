import { createClient } from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

import { makeQueryClient } from '@common/app/queryClient'
import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeLabels
} from '@common/testing/fakeLinagora'

import {
  labelKeys,
  labelsQueryOptions,
  sortLabels,
  syncLabels,
  type LabelListData
} from './queries'

function label(
  id: string,
  displayName: string
): {
  id: string
  displayName: string
  keyword: string
  color: string | null
} {
  return { id, displayName, keyword: id, color: null }
}

describe('labels', () => {
  it('sorts by name, whatever the case', () => {
    expect(
      sortLabels([
        label('b', 'beta'),
        label('a', 'Alpha'),
        label('c', 'Gamma')
      ]).map(({ displayName }) => displayName)
    ).toEqual(['Alpha', 'beta', 'Gamma'])
  })

  it('follows the changes of the labels, or reloads them', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeLabels(server, [label('work', 'Work'), label('home', 'Home')])
    const client = createClient({
      sessionUrl: FAKE_SESSION_URL,
      fetch: server.fetch,
      methodCapabilities: LINAGORA_METHOD_CAPABILITIES
    })
    await client.getSession()
    const queryClient = makeQueryClient()
    await queryClient.query(labelsQueryOptions(client, FAKE_ACCOUNT_ID))
    await client.call('Label/set', {
      accountId: FAKE_ACCOUNT_ID,
      create: { new: { displayName: 'Archive' } },
      update: { work: { displayName: 'Job' } },
      destroy: ['home']
    })

    await syncLabels(client, queryClient, FAKE_ACCOUNT_ID, 'label-4')

    const data = queryClient.getQueryData<LabelListData>(
      labelKeys.all(FAKE_ACCOUNT_ID)
    )
    expect(data?.state).toBe('label-4')
    expect(data?.list.map(({ displayName }) => displayName)).toEqual([
      'Archive',
      'Job'
    ])
    expect(server.calledMethods().slice(-2)).toEqual([
      'Label/changes',
      'Label/get'
    ])
  })
})
