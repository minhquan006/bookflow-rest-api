import { ApiError } from "../../lib/http";

export function fieldErrors(error: unknown) {
  const errors: Record<string, string> = {};
  if (error instanceof ApiError)
    for (const issue of error.problem.errors ?? [])
      errors[issue.path] = issue.message;
  return errors;
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function validEmail(value: string) {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) &&
    value.trim().length <= 254
  );
}
