import { completeConfig } from './completeConfig'
import { resolveConfig, type AppConfig } from './config'

function makeConfig(source: Record<string, unknown>): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      ...source
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

describe('completeConfig', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reads app_dashboard.json when the grid is supported and appList.js has no app', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        apps: [
          {
            appName: 'Drive',
            appLink: 'https://drive.example.com',
            icon: 'ic_tdrive_app.svg'
          }
        ]
      })
    )
    const config = makeConfig({ APP_GRID_AVAILABLE: 'supported' })

    const completed = await completeConfig(config)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://mail.example.com/assets/configurations/app_dashboard.json',
      expect.anything()
    )
    expect(completed.appList).toEqual([
      {
        name: 'Drive',
        link: 'https://drive.example.com',
        icon: '/assets/images/svg/app-drive.svg'
      }
    ])
  })

  it('reads nothing when appList.js has apps, or the grid is not supported', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    const withList = makeConfig({
      APP_GRID_AVAILABLE: 'supported',
      appList: [{ name: 'A', link: 'https://a.example.com', icon: '/a.svg' }]
    })
    const unsupported = makeConfig({ APP_GRID_AVAILABLE: 'unsupported' })

    expect(await completeConfig(withList)).toBe(withList)
    expect(await completeConfig(unsupported)).toBe(unsupported)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('starts without apps when the file cannot be read', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))

    const completed = await completeConfig(
      makeConfig({ APP_GRID_AVAILABLE: 'supported' })
    )

    expect(completed.appList).toEqual([])
  })
})
