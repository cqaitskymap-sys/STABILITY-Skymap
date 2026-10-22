"use client";

import { useEffect, useState } from "react";
import { invalidateReadCache, PAGE_TTL, readFresh, writeFresh } from "@/lib/firebase/read-cache";
import { friendlyError } from "@/lib/utils";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function pageKey(loader: () => Promise<unknown>, depsKey: string) {
  return `page:${depsKey}:${loader.toString()}`;
}

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  const depsKey = JSON.stringify(deps);
  const [resolvedKey, setResolvedKey] = useState("");
  const key = pageKey(loader, depsKey);

  if (resolvedKey !== depsKey) {
    const cached = readFresh<T>(key, PAGE_TTL);
    if (cached !== undefined) {
      setResolvedKey(depsKey);
      setState({ data: cached, loading: false, error: null });
    } else if (!state.loading || state.error) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }
  }

  useEffect(() => {
    let cancelled = false;
    const cached = readFresh<T>(key, PAGE_TTL);

    void Promise.resolve()
      .then(() => loader())
      .then((result) => {
        if (cancelled) return;
        writeFresh(key, result);
        setState({ data: result, loading: false, error: null });
        setResolvedKey(depsKey);
      })
      .catch((err) => {
        if (cancelled) return;
        if (cached !== undefined) {
          setState({ data: cached, loading: false, error: null });
          setResolvedKey(depsKey);
          return;
        }
        setState({
          data: null,
          loading: false,
          error: friendlyError(err, "Unable to load data. Please try again."),
        });
        setResolvedKey(depsKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, version, key]);

  return {
    data: state.data,
    loading: state.loading || resolvedKey !== depsKey,
    error: state.error,
    reload: () => {
      invalidateReadCache();
      setState((prev) => ({ ...prev, loading: true, error: null }));
      setVersion((v) => v + 1);
    },
    setData: (value: T | null | ((prev: T | null) => T | null)) => {
      setState((prev) => ({
        ...prev,
        data: typeof value === "function" ? (value as (p: T | null) => T | null)(prev.data) : value,
      }));
    },
  };
}
