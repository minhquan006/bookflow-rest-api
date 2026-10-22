import { useEffect, useState } from "react";

/** A new loader hides old results immediately; aborted requests cannot replace newer data. */
export function useRemote<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{
    loader: typeof loader;
    data?: T;
    error?: unknown;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void loader(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ loader, data });
      },
      (error) => {
        if (!controller.signal.aborted) setResult({ loader, error });
      },
    );
    return () => controller.abort();
  }, [loader]);
  return result?.loader === loader
    ? { data: result.data, error: result.error, loading: false }
    : { data: undefined, error: undefined, loading: true };
}
