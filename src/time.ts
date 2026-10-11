// Europe/London "today" as YYYY-MM-DD. Workers have a full IANA tz database via
// Intl, so server.py's Windows fallback (server.py:94-107) is unnecessary here.
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
