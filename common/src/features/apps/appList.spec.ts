import { resolveAppList } from './appList'

const CONTEXT = {
  username: 'user1@twake.example.com',
  workplaceFqdn: null,
  workplaceFqdnFallback: '{localpart}.twake.example.com'
}

describe('resolveAppList', () => {
  it('resolves the URI templates of each app for the user', () => {
    expect(
      resolveAppList(
        [
          {
            name: 'Drive',
            link: 'https://{localpart}-drive.twake.example.com',
            icon: '/assets/drive.svg'
          },
          {
            name: 'Workplace',
            link: 'https://{workplaceFqdn}/',
            icon: 'https://{workplaceFqdn}/icon.svg'
          },
          { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' }
        ],
        CONTEXT
      )
    ).toEqual([
      {
        name: 'Drive',
        link: 'https://user1-drive.twake.example.com',
        icon: '/assets/drive.svg'
      },
      {
        name: 'Workplace',
        link: 'https://user1.twake.example.com/',
        icon: 'https://user1.twake.example.com/icon.svg'
      },
      { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' }
    ])
  })

  it('prefers the workplace the SSO gives', () => {
    expect(
      resolveAppList(
        [
          {
            name: 'Drive',
            link: 'https://{workplaceFqdn.localpart}-drive.{workplaceFqdn.domain}',
            icon: '/drive.svg'
          }
        ],
        { ...CONTEXT, workplaceFqdn: 'acme.lin-saas.com' }
      )[0]?.link
    ).toBe('https://acme-drive.lin-saas.com')
  })

  it('leaves out an app the user has no address for', () => {
    expect(
      resolveAppList(
        [{ name: 'Drive', link: 'https://{workplaceFqdn}/', icon: '/d.svg' }],
        { ...CONTEXT, workplaceFqdnFallback: null }
      )
    ).toEqual([])
    expect(
      resolveAppList(
        [{ name: 'Bad', link: 'javascript:alert(1)', icon: '/b.svg' }],
        CONTEXT
      )
    ).toEqual([])
  })
})
