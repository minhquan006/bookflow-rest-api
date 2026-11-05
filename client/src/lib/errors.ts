import { ApiError } from "./http";

export function fieldErrors(error: unknown) {
  const errors: Record<string, string> = {};
  if (error instanceof ApiError)
    for (const issue of error.problem.errors ?? [])
      errors[issue.path] = issue.message;
  return errors;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed. Please try again.";
}
