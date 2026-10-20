export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly title: string,
    public readonly detail: string,
    public readonly errors?: ReadonlyArray<{ path: string; message: string }>,
  ) {
    super(detail);
    this.name = "AppError";
  }
}

export const unauthenticated = () =>
  new AppError(
    401,
    "UNAUTHENTICATED",
    "Unauthorized",
    "A valid access token is required.",
  );
export const forbidden = () =>
  new AppError(
    403,
    "FORBIDDEN",
    "Forbidden",
    "You do not have permission to perform this action.",
  );
