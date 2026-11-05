export function formatLibraryDate(
  value: string,
  locale: "en-GB" | "vi-VN" = "en-GB",
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
