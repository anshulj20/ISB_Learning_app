import Link from "next/link";
import { db } from "@/lib/db";
import { getTodayQuota } from "@/lib/quota";
import { relativeTime, fileStatusLabel } from "@/lib/format";
import { ConfidenceBadge } from "@/components/confidence-badge";

export default async function HomePage() {
  const [resumeTopics, recentFiles, quota, waitingCount, stats, concepts] =
    await Promise.all([
      db.topic.findMany({
        where: { lastOpenedAt: { not: null } },
        orderBy: { lastOpenedAt: "desc" },
        take: 3,
        include: { course: true },
      }),
      db.sourceFile.findMany({
        orderBy: { uploadedAt: "desc" },
        take: 4,
      }),
      getTodayQuota(),
      db.sourceFile.count({ where: { status: "WAITING_FOR_QUOTA" } }),
      Promise.all([
        db.term.count(),
        db.course.count(),
        db.topic.count(),
        db.sourceFile.count(),
      ]),
      db.concept.findMany({
        include: {
          topics: {
            include: { course: true, visits: true },
          },
        },
      }),
    ]);

  const [termCount, courseCount, topicCount, fileCount] = stats;

  const interestAreas = concepts
    .map((c) => {
      const visitCount = c.topics.reduce((sum, t) => sum + t.visits.length, 0);
      const courseIds = new Set(c.topics.map((t) => t.courseId));
      return { name: c.name, visitCount, courseCount: courseIds.size };
    })
    .filter((c) => c.visitCount > 0)
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 4);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const resetLabel = quota.resetAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <header className="flex items-baseline justify-between mb-10">
        <h1 className="font-heading text-2xl">Home</h1>
        <div className="flex items-center gap-4 text-xs text-text/50">
          <span>{dateLabel}</span>
          <span>
            Free processing {quota.used} / {quota.limit}
          </span>
        </div>
      </header>

      <h2 className="font-heading text-4xl mb-6 max-w-xl leading-tight">
        Everything you learned, kept.
      </h2>

      <form action="/search" className="mb-12">
        <input
          type="text"
          name="q"
          placeholder="Search a concept, a case, or your own notes…"
          className="w-full bg-surface border border-divider rounded-md px-4 py-3 text-sm placeholder:text-text/40 focus:outline-none focus:border-accent"
        />
      </form>

      {resumeTopics.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider text-text/50">
              Resume
            </h3>
            <span className="text-xs text-text/40">
              {resumeTopics.length} topics left open
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {resumeTopics.map((t) => (
              <Link
                key={t.id}
                href={`/topics/${t.id}`}
                className="block bg-surface border border-divider rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-[11px] uppercase tracking-wider text-text/40 mb-1">
                  {t.course.name}
                </div>
                <div className="font-heading text-lg mb-1">{t.name}</div>
                <p className="text-sm text-text/60 mb-3 line-clamp-2">
                  {t.takeaway}
                </p>
                <div className="flex items-center justify-between">
                  <ConfidenceBadge confidence={t.confidence} />
                  <span className="text-xs text-text/40">
                    opened {relativeTime(t.lastOpenedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {interestAreas.length > 0 && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-text/50 mb-1">
              Interest areas
            </h3>
            <p className="text-xs text-text/40 mb-3">
              What you keep coming back to
            </p>
            <ul className="divide-y divide-divider border-t border-b border-divider">
              {interestAreas.map((c) => (
                <li
                  key={c.name}
                  className="flex items-baseline justify-between py-2.5"
                >
                  <span className="text-sm">{c.name}</span>
                  <span className="text-xs text-text/40 whitespace-nowrap ml-4">
                    {c.courseCount} course{c.courseCount === 1 ? "" : "s"} ·{" "}
                    {c.visitCount} visits
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-1">
            Recently added
          </h3>
          <p className="text-xs text-text/40 mb-3 invisible select-none">
            spacer
          </p>
          <ul className="divide-y divide-divider border-t border-b border-divider">
            {recentFiles.map((f) => (
              <li
                key={f.id}
                className="flex items-baseline justify-between py-2.5 gap-4"
              >
                <span className="text-sm truncate">{f.originalFileName}</span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    f.status === "WAITING_FOR_QUOTA"
                      ? "text-text/40"
                      : "text-text/60"
                  }`}
                >
                  {fileStatusLabel(f.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {waitingCount > 0 && (
        <section className="mb-12 bg-surface border border-divider rounded-lg p-5">
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-2">
            Processing
          </h3>
          <p className="text-sm text-text/80 mb-3">
            {quota.used} of {quota.limit} free files used today.{" "}
            {waitingCount} file{waitingCount === 1 ? " is" : "s are"} waiting;{" "}
            {waitingCount === 1 ? "it" : "they"} will process once the quota
            resets at {resetLabel}.
          </p>
          <Link
            href="/add"
            className="text-sm text-accent hover:underline"
          >
            Review the queue
          </Link>
        </section>
      )}

      <section className="border-t border-divider pt-6">
        <h3 className="text-xs uppercase tracking-wider text-text/50 mb-4">
          The library
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Stat value={termCount} label="terms" />
          <Stat value={courseCount} label="courses" />
          <Stat value={topicCount} label="topics" />
          <Stat value={fileCount} label="source files" />
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-heading text-2xl">{value.toLocaleString()}</div>
      <div className="text-xs text-text/50">{label}</div>
    </div>
  );
}
