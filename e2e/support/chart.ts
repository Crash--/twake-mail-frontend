import { env } from './env'

/** The /.env.js the image derives from the env.file of the chart, '' when unreachable */
export async function getRuntimeConfig(): Promise<string> {
  try {
    return await (await fetch(`${env.baseUrl}/.env.js`)).text()
  } catch {
    return ''
  }
}

/** Whether the app is the image started as the chart does (scripts/start-chart.sh) */
export async function isChartStack(): Promise<boolean> {
  return /COZY_INTEGRATION\s*=\s*'true'/.test(await getRuntimeConfig())
}

/** Whether the stack answers WebFinger with Dex (start-chart.sh with E2E_OIDC=1) */
export async function doesStackAnswerWebFinger(): Promise<boolean> {
  try {
    const response = await fetch(
      `${env.baseUrl}/.well-known/webfinger?resource=${encodeURIComponent(env.baseUrl)}&rel=http://openid.net/specs/connect/1.0/issuer`
    )
    return response.ok
  } catch {
    return false
  }
}

/** SERVER_URL of the env.file, as the image hands it to the app */
export async function getServerUrl(): Promise<string> {
  const match = /SERVER_URL\s*=\s*'([^']*)'/.exec(await getRuntimeConfig())
  return match?.[1] ?? env.baseUrl
}
