import { useCallback, useEffect, useState } from 'react';
import { cacheSnapshot, remember, subscribeInvalidation } from '../services/query-cache';

export type ResourceState<T> = {
  data: T | undefined;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  error: string;
  offline: boolean;
  refresh: () => void;
};

export function useResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
): ResourceState<T> {
  const initial = cacheSnapshot<T>(key);
  const [data, setData] = useState<T | undefined>(initial.value);
  const [loading, setLoading] = useState(initial.value === undefined);
  const [refreshing, setRefreshing] = useState(initial.value !== undefined);
  const [stale, setStale] = useState(initial.stale);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => subscribeInvalidation((prefix) => {
    if (key.startsWith(prefix)) setVersion((value) => value + 1);
  }), [key]);

  useEffect(() => {
    const controller = new AbortController();
    const scopedCache = cacheSnapshot<T>(key);

    setData(scopedCache.value);
    setStale(scopedCache.stale);
    setError('');
    setOffline(false);
    setLoading(scopedCache.value === undefined);
    setRefreshing(scopedCache.value !== undefined);

    loader(controller.signal)
      .then((value) => {
        remember(key, value);
        setData(value);
        setStale(false);
        setError('');
        setOffline(false);
      })
      .catch((value) => {
        if (controller.signal.aborted) return;
        setError(value instanceof Error ? value.message : 'Something went wrong');
        setOffline(value instanceof TypeError);
        if (scopedCache.value !== undefined) setStale(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [key, version]);

  return { data, loading, refreshing, stale, error, offline, refresh };
}
