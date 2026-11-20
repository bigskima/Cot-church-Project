import { useCallback, useEffect, useRef, useState } from 'react';
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

function snapshotState<T>(key: string) {
  const cached = cacheSnapshot<T>(key);
  return {
    key, data: cached.value, stale: cached.stale,
    loading: cached.value === undefined, refreshing: false, error: '', offline: false,
  };
}

export function useResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>): ResourceState<T> {
  const [state, setState] = useState(() => snapshotState<T>(key));
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const manualRefresh = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    manualRefresh.current = true;
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => subscribeInvalidation((prefix, evicted) => {
    if (!key.startsWith(prefix)) return;
    // Cancel immediately so old requests cannot repopulate an evicted scope,
    // including loaders that do not honour AbortSignal themselves.
    activeRequest.current?.abort();
    if (evicted) setState(snapshotState<T>(key));
    setVersion((value) => value + 1);
  }), [key]);

  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current = controller;
    const next = snapshotState<T>(key);
    const isManual = manualRefresh.current;
    manualRefresh.current = false;
    setState({ ...next, refreshing: isManual && next.data !== undefined });

    Promise.resolve().then(() => loaderRef.current(controller.signal))
      .then((value) => {
        if (controller.signal.aborted) return;
        remember(key, value);
        setState({ key, data: value, loading: false, refreshing: false, stale: false, error: '', offline: false });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState((current) => ({
          ...current, loading: false, refreshing: false,
          stale: current.data !== undefined,
          error: error instanceof Error ? error.message : 'Something went wrong',
          offline: error instanceof TypeError,
        }));
      });

    return () => controller.abort();
  }, [key, version]);

  // Never render a frame of another account, search term or Expression's data.
  return { ...(state.key === key ? state : snapshotState<T>(key)), refresh };
}
