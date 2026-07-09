import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './api'

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  reload: () => void
  /** Replace data locally (e.g. after a mutation returns the fresh object). */
  setData: (next: T) => void
}

/**
 * Data-fetching hook: tracks loading / error / data for a promise-returning
 * function. `deps` re-triggers the fetch. Errors are always ApiError.
 */
export function useApi<T>(fn: () => Promise<T>, deps: readonly unknown[]): ApiState<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fnRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setDataState(result)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err : new ApiError(0, String(err)))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((next: T) => setDataState(next), [])

  return { data, loading, error, reload, setData }
}

/** Debounce a changing value (for search-as-you-type). */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
