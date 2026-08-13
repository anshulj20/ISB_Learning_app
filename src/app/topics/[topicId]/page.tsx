import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { fileKindLabel } from "@/lib/format";
import { keywordSearch } from "@/lib/naive-search";

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ doubt?: string }>;
}) {
  const { topicId } = await params;
  const { doubt } = await searchParams;

  const topic = await db.topic.findUnique({
    where: { id: topicId },
    include: {
      course: { include: { term: true } },
      sections: { orderBy: { order: "asc" }, include: { userNotes: true } },
      sourceFiles: { include: { sourceFile: true } },
      readings: true,
      concept: { include: { topics: { include: { course: true } } } },
    },
  });
  if (!topic) notFound();

  // Record the visit — this is what feeds Home's Resume list and the
  // interest-area visit counts. A GET-triggered write is unusual but
  // matches how a local single-user app tracks its own usage.
  await Promise.all([
    db.topic.update({
      where: { id: topic.id },
      data: { lastOpenedAt: new Date(), openCount: { increment: 1 } },
    }),
    db.topicVisit.create({ data: { topicId: topic.id } }),
  ]);

  const alsoTaughtIn =
    topic.concept?.topics.filter((t) => t.id !== topic.id) ?? [];

  const quickDoubtHits = doubt ? await keywordSearch(doubt, topic.id) : [];

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <header className="flex items-start justify-between mb-8">
        <div className="text-xs text-text/50">
          <Link href="/library" className="hover:text-text">
            {topic.course.term.name}
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            href={`/library?term=${topic.course.termId}&course=${topic.course.id}`}
            className="hover:text-text"
          >
            {topic.course.name}
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-text/70">{topic.name}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-text/40">
          <span>Raw material ({topic.sourceFiles.length})</span>
          <span title="Coming soon" className="cursor-not-allowed">
            Edit
          </span>
          <span title="Coming soon" className="cursor-not-allowed">
            Focus mode
          </span>
        </div>
      </header>

      {/* TAKEAWAY */}
      <section className="mb-10">
        <h3 className="text-xs uppercase tracking-wider text-text/50 mb-2">
          Takeaway
        </h3>
        <h1 className="font-heading text-3xl mb-3">{topic.name}</h1>
        <p className="text-base leading-relaxed text-text/85">
          {topic.takeaway}
        </p>
        <div className="mt-3">
          <ConfidenceBadge confidence={topic.confidence} />
        </div>
      </section>

      {/* DETAILED KNOWLEDGE BASE */}
      {topic.sections.length > 0 && (
        <section className="mb-10">
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-4">
            Detailed knowledge base
          </h3>
          <div className="space-y-8">
            {topic.sections.map((s) => (
              <div key={s.id}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <h4 className="font-heading text-lg">{s.heading}</h4>
                  <span className="text-[11px] uppercase tracking-wider text-text/35">
                    {s.verifiedByUser ? "Verified by you" : "Unverified"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-text/80">
                  {s.body}
                </p>
                {s.userNotes.map((n) => (
                  <div
                    key={n.id}
                    className="mt-3 border-l-2 border-accent pl-3 text-sm text-text/70 italic"
                  >
                    <div className="text-[11px] uppercase tracking-wider text-accent not-italic mb-1">
                      Your note
                    </div>
                    {n.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* QUICK DOUBT */}
      <section className="mb-10 bg-surface border border-divider rounded-lg p-5">
        <h3 className="text-xs uppercase tracking-wider text-text/50 mb-3">
          Quick doubt
        </h3>
        <form className="mb-3">
          <input
            type="text"
            name="doubt"
            defaultValue={doubt}
            placeholder="Ask about anything you are reading…"
            className="w-full bg-bg border border-divider rounded-md px-3 py-2 text-sm placeholder:text-text/40 focus:outline-none focus:border-accent"
          />
        </form>
        {doubt && (
          <div>
            <p className="text-xs text-text/40 mb-2">
              {quickDoubtHits.length} near match
              {quickDoubtHits.length === 1 ? "" : "es"} elsewhere in the
              library
            </p>
            <ul className="space-y-3">
              {quickDoubtHits.map((h) => (
                <li key={h.topicId}>
                  <Link
                    href={`/topics/${h.topicId}`}
                    className="block hover:bg-bg/60 -mx-2 px-2 py-1.5 rounded"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm">{h.topicName}</span>
                      <span className="text-xs text-text/40">
                        {h.score}%
                      </span>
                    </div>
                    <div className="text-xs text-text/40 mb-0.5">
                      {h.courseName}
                    </div>
                    <p className="text-xs text-text/50 line-clamp-1">
                      {h.snippet}
                    </p>
                  </Link>
                </li>
              ))}
              {quickDoubtHits.length === 0 && (
                <p className="text-sm text-text/40">
                  Nothing close to that yet.
                </p>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* ALSO TAUGHT IN */}
      {alsoTaughtIn.length > 0 && (
        <section className="mb-10">
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-3">
            Also taught in
          </h3>
          <ul className="space-y-2">
            {alsoTaughtIn.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/topics/${t.id}`}
                  className="text-sm hover:text-accent"
                >
                  {t.name}
                </Link>
                <span className="text-xs text-text/40 ml-2">
                  {t.course.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* RAW MATERIAL */}
      <section className="mb-10">
        <h3 className="text-xs uppercase tracking-wider text-text/50 mb-1">
          Raw material
        </h3>
        <p className="text-xs text-text/35 mb-3">
          Exactly as it was — one click
        </p>
        <ul className="space-y-2">
          {topic.sourceFiles.map((tsf) => (
            <li key={tsf.id}>
              <Link
                href={`/files/${tsf.sourceFile.id}`}
                className="flex items-center gap-3 bg-surface border border-divider rounded-md px-3 py-2.5 hover:border-accent transition-colors"
              >
                <span className="text-[10px] uppercase tracking-wider text-text/40 border border-divider rounded px-1.5 py-0.5">
                  {tsf.sourceFile.format}
                </span>
                <span className="text-sm flex-1">
                  {tsf.sourceFile.originalFileName}
                </span>
                {tsf.citation && (
                  <span className="text-xs text-text/40">
                    {tsf.citation} cited
                  </span>
                )}
              </Link>
            </li>
          ))}
          {topic.sourceFiles.length === 0 && (
            <p className="text-sm text-text/40">No raw material filed yet.</p>
          )}
        </ul>
      </section>

      {/* FURTHER READING */}
      {topic.readings.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-3">
            Further reading
          </h3>
          <ul className="space-y-2 mb-2">
            {topic.readings.map((r) => (
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm hover:text-accent"
                >
                  {r.title}
                </a>
                <span className="text-xs text-text/40 ml-2">
                  {r.sourceDomain} · external
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-text/35">
            Suggestions follow what you actually open.
          </p>
        </section>
      )}
    </div>
  );
}
