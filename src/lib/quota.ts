import { db } from "@/lib/db";

// Hard-stop quota tracking — PROJECT_SPEC.md "Hard stop: no paid API
// usage, period." One row per calendar day (local date, not UTC, so the
// displayed "resets at 5:30 AM" lines up with when the user actually
// sees it reset).

const DEFAULT_DAILY_LIMIT = 20;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextResetAt(from: Date): Date {
  const reset = new Date(from);
  reset.setHours(5, 30, 0, 0);
  if (reset.getTime() <= from.getTime()) {
    reset.setDate(reset.getDate() + 1);
  }
  return reset;
}

export async function getTodayQuota() {
  const key = localDateKey(new Date());
  const existing = await db.quotaUsage.findUnique({ where: { date: key } });
  if (existing) return existing;
  return db.quotaUsage.create({
    data: {
      date: key,
      provider: "gemini",
      used: 0,
      limit: DEFAULT_DAILY_LIMIT,
      resetAt: nextResetAt(new Date()),
    },
  });
}
