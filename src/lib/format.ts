export function relativeTime(date: Date | null): string {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 14) return "last week";
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
  if (diffDay < 60) return "last month";
  return `${Math.floor(diffDay / 30)} months ago`;
}

export function confidenceLabel(c: "HIGH" | "PARTIAL" | "THIN"): string {
  return c.charAt(0) + c.slice(1).toLowerCase();
}

export function fileKindLabel(k: string): string {
  const map: Record<string, string> = {
    SLIDES: "Slides",
    NOTES: "Handwritten",
    CASE: "Case",
    ASSIGNMENT: "Assignment",
  };
  return map[k] ?? k;
}

export function fileStatusLabel(s: string): string {
  const map: Record<string, string> = {
    QUEUED: "Queued",
    PROCESSING: "Processing",
    PROCESSED: "Processed",
    WAITING_FOR_QUOTA: "Waiting for quota",
    ERROR: "Error",
  };
  return map[s] ?? s;
}
