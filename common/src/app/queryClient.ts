import { QueryClient } from '@tanstack/react-query'

const MAX_QUERY_RETRIES = 2

function getHttpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null
  }
  return typeof error.status === 'number' ? error.status : null
}

/**
 * Retries a failed query a couple of times, except on client errors (4xx,
 * e.g. JmapHttpError or JmapRequestError): retrying would fail the same way,
 * and a 401 has already been through `onUnauthorized`.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown
): boolean {
  const status = getHttpStatus(error)
  if (status !== null && status >= 400 && status < 500) return false
  return failureCount < MAX_QUERY_RETRIES
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: false
      }
    }
  })
}
