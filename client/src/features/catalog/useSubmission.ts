import { useRef, useState } from "react";
import { ApiError } from "../../lib/http";
export function useSubmission() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function submit(work: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (error) {
      setError(error);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const fieldError = (field: string) =>
    error instanceof ApiError
      ? error.problem.errors?.find((e) => e.path === field)?.message
      : undefined;
  return { busy, error, submit, fieldError };
}
