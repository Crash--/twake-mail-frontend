import type {
  infiniteQueryOptions,
  QueryKey,
  queryOptions
} from '@tanstack/react-query'

/**
 * Return type of `queryOptions()` for a query function resolving to
 * `TData`, to annotate the `xxxQueryOptions` factories of the features.
 */
export type QueryOptionsFor<TData, TKey extends QueryKey> = ReturnType<
  typeof queryOptions<TData, Error, TData, TKey>
>

/**
 * Return type of `infiniteQueryOptions()` for pages of type `TPage`.
 */
export type InfiniteQueryOptionsFor<
  TPage,
  TKey extends QueryKey,
  TPageParam
> = ReturnType<
  typeof infiniteQueryOptions<
    TPage,
    Error,
    { pages: TPage[]; pageParams: TPageParam[] },
    TKey,
    TPageParam
  >
>
