import type { LoanReturn } from "./types";

function isDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/i.exec(
      value,
    );
  if (!parts) return false;
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] =
    parts;
  const leapYear =
    Number(year) % 4 === 0 &&
    (Number(year) % 100 !== 0 || Number(year) % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  // Check the written calendar date before applying its timezone. Date.parse
  // alone normalizes impossible dates such as February 30 into another month.
  return (
    Number(month) >= 1 &&
    Number(month) <= 12 &&
    Number(day) >= 1 &&
    Number(day) <= daysInMonth[Number(month) - 1]! &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    Number(offsetHour ?? 0) <= 23 &&
    Number(offsetMinute ?? 0) <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

/** The API generic is not runtime validation: inspect the untrusted JSON itself. */
export function isLoanReturnResponse(
  value: unknown,
  expectedLoanId: string,
): value is { data: LoanReturn } {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return (
    !!data &&
    typeof data === "object" &&
    "loanId" in data &&
    data.loanId === expectedLoanId &&
    "returnedBy" in data &&
    typeof data.returnedBy === "string" &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(data.returnedBy) &&
    "returnedAt" in data &&
    isDateTime(data.returnedAt)
  );
}
