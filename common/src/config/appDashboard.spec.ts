import {
  GENERIC_APP_ICON,
  loadAppDashboard,
  parseAppDashboard,
  resolveFlutterAppIcon
} from './appDashboard'

describe('resolveFlutterAppIcon', () => {
  it.each([
    ['ic_twake_app.svg', '/assets/images/svg/app-chat.svg'],
    ['ic_tdrive_app.svg', '/assets/images/svg/app-drive.svg'],
    ['ic_tmail_app.svg', '/assets/images/svg/app-mail.svg'],
    ['ic_calendar_app.svg', '/assets/images/svg/app-calendar.svg'],
    ['ic_contacts_app.svg', '/assets/images/svg/app-contacts.svg'],
    ['ic_teleskop_app.svg', '/assets/images/svg/app-meet.svg']
  ])('maps %s to a shipped icon', (name, path) => {
    expect(resolveFlutterAppIcon(name)).toBe(path)
  })

  it.each(['ic_linshare_app.png', 'ic_unknown.svg', '', 'constructor'])(
    'falls back to the generic icon for %j',
    name => {
      expect(resolveFlutterAppIcon(name)).toBe(GENERIC_APP_ICON)
    }
  )

  it('falls back to the generic icon without a name', () => {
    expect(resolveFlutterAppIcon(undefined)).toBe(GENERIC_APP_ICON)
  })

  it('keeps an absolute URL or path, not a protocol-relative URL', () => {
    expect(resolveFlutterAppIcon('https://cdn.example.com/a.svg')).toBe(
      'https://cdn.example.com/a.svg'
    )
    expect(resolveFlutterAppIcon('/icons/a.svg')).toBe('/icons/a.svg')
    expect(resolveFlutterAppIcon('//evil.example.com/a.svg')).toBe(
      GENERIC_APP_ICON
    )
  })
})

describe('parseAppDashboard', () => {
  it('converts the apps of the chart of tmail-frontend', () => {
    expect(
      parseAppDashboard({
        apps: [
          {
            appName: 'Chat',
            appLink: 'https://chat.example.com',
            icon: 'ic_twake_app.svg'
          },
          {
            appName: 'LinShare',
            appLink: 'https://linshare.example.com',
            icon: 'ic_linshare_app.png',
            androidPackageId: 'com.example.linshare'
          }
        ]
      })
    ).toEqual([
      {
        name: 'Chat',
        link: 'https://chat.example.com',
        icon: '/assets/images/svg/app-chat.svg'
      },
      {
        name: 'LinShare',
        link: 'https://linshare.example.com',
        icon: GENERIC_APP_ICON
      }
    ])
  })

  it('prefers a publicIconUri', () => {
    expect(
      parseAppDashboard({
        apps: [
          {
            appName: 'Drive',
            appLink: 'https://drive.example.com',
            icon: 'ic_tdrive_app.svg',
            publicIconUri: 'https://drive.example.com/icon.svg'
          }
        ]
      })
    ).toEqual([
      {
        name: 'Drive',
        link: 'https://drive.example.com',
        icon: 'https://drive.example.com/icon.svg'
      }
    ])
  })

  it.each([null, 'text', 3, [], {}, { apps: 'x' }, { apps: [null, 4, {}] }])(
    'finds no app in %j',
    document => {
      expect(parseAppDashboard(document)).toEqual([])
    }
  )
})

describe('loadAppDashboard', () => {
  const URL =
    'https://mail.example.com/assets/configurations/app_dashboard.json'

  function makeFetch(response: Response | Error): typeof fetch {
    return jest.fn(() =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response)
    )
  }

  it('reads the file', async () => {
    const fetchJson = makeFetch(
      Response.json({
        apps: [
          {
            appName: 'Mail',
            appLink: 'https://mail.example.com',
            icon: 'ic_tmail_app.svg'
          }
        ]
      })
    )

    await expect(loadAppDashboard(URL, fetchJson)).resolves.toEqual([
      {
        name: 'Mail',
        link: 'https://mail.example.com',
        icon: '/assets/images/svg/app-mail.svg'
      }
    ])
    expect(fetchJson).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ credentials: 'same-origin' })
    )
  })

  it('finds no app in the index.html served for a missing file', async () => {
    const fetchJson = makeFetch(new Response('<!doctype html>'))

    await expect(loadAppDashboard(URL, fetchJson)).resolves.toEqual([])
  })

  it('finds no app after an error status or a network error', async () => {
    await expect(
      loadAppDashboard(URL, makeFetch(new Response('', { status: 404 })))
    ).resolves.toEqual([])
    await expect(
      loadAppDashboard(URL, makeFetch(new TypeError('network')))
    ).resolves.toEqual([])
  })
})
