"use client";

import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/utils";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => loader())
      .then((result) => {
        if (!cancelled) {
          setState({ data: result, loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: friendlyError(err, "Unable to load data. Please try again."),
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, version]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    reload: () => {
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
