import { AppError } from "../../shared/errors.js";

export function expectedVersion(id: string, ifMatch: string | undefined) {
  if (ifMatch === undefined) {
    throw new AppError(
      428,
      "PRECONDITION_REQUIRED",
      "Precondition Required",
      "Send the current book ETag in If-Match.",
    );
  }

  const match = new RegExp(`^"book-${id}-v([1-9][0-9]*)"$`).exec(ifMatch);
  const version = match ? Number(match[1]) : NaN;

  if (!Number.isSafeInteger(version) || version > 2147483647) {
    throw new AppError(
      412,
      "VERSION_MISMATCH",
      "Precondition Failed",
      "The supplied book version is not supported.",
    );
  }

  return version;
}
