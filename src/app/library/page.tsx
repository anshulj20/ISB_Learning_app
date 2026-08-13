import Link from "next/link";
import { db } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import { ConfidenceBadge } from "@/components/confidence-badge";

// "Three standing panes — term, course, topics. Nothing collapses out
// from under you." — one page, driven by query params, so all three
// panes stay visible together rather than replacing each other.
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; course?: string; filter?: string }>;
}) {
  const params = await searchParams;

  const terms = await db.term.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { courses: true } } },
  });
  if (terms.length === 0) {
    return <EmptyLibrary />;
  }

  const activeTerm = terms.find((t) => t.id === params.term) ?? terms[0];

  const courses = await db.course.findMany({
    where: { termId: activeTerm.id },
    orderBy: { order: "asc" },
    include: { topics: true },
  });

  const activeCourse =
    courses.find((c) => c.id === params.course) ?? courses[0] ?? null;

  const [thinCount, shortlistCount, handwrittenCount] = await Promise.all([
    db.topic.count({ where: { confidence: "THIN" } }),
    db.topic.count({ where: { interviewShortlisted: true } }),
    db.topic.count({
      where: { sourceFiles: { some: { sourceFile: { kind: "NOTES" } } } },
    }),
  ]);

  let topics: Awaited<ReturnType<typeof loadTopics>> = [];
  if (activeCourse) {
    topics = await loadTopics(activeCourse.id, params.filter);
  }

  return (
    <div className="px-8 py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl mb-1">Library</h1>
        <div className="text-xs text-text/50">
          {activeCourse ? (
            <>
              <span>{activeTerm.name}</span>
              <span className="mx-1.5">/</span>
              <span>{activeCourse.name}</span>
            </>
          ) : (
            <span>{activeTerm.name}</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[180px_260px_1fr] gap-6 items-start">
        {/* Pane 1: Terms + saved views */}
        <div>
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-2">
            Terms
          </h3>
          <ul className="mb-6">
            {terms.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/library?term=${t.id}`}
                  className={`flex items-baseline justify-between text-sm py-1.5 ${
                    t.id === activeTerm.id
                      ? "text-text font-medium"
                      : "text-text/60 hover:text-text"
                  }`}
                >
                  <span>{t.name}</span>
                  <span className="text-xs text-text/40">
                    {t._count.courses}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-2">
            Saved views
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li>
              <Link
                href="#"
                className="flex items-baseline justify-between text-text/60 hover:text-text"
              >
                <span>Thin topics</span>
                <span className="text-xs text-text/40">({thinCount})</span>
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="flex items-baseline justify-between text-text/60 hover:text-text"
              >
                <span>Handwritten only</span>
                <span className="text-xs text-text/40">
                  ({handwrittenCount})
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="flex items-baseline justify-between text-text/60 hover:text-text"
              >
                <span>Interview shortlist</span>
                <span className="text-xs text-text/40">
                  ({shortlistCount})
                </span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Pane 2: Courses in this term */}
        <div>
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-2">
            {activeTerm.name} · courses
          </h3>
          {courses.length === 0 ? (
            <p className="text-sm text-text/40">
              Nothing filed under this term yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {courses.map((c) => {
                const dist = confidenceDistribution(c.topics);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/library?term=${activeTerm.id}&course=${c.id}`}
                      className={`block rounded-md px-2 py-2 -mx-2 ${
                        activeCourse?.id === c.id
                          ? "bg-surface"
                          : "hover:bg-surface/60"
                      }`}
                    >
                      <div className="flex items-baseline justify-between text-sm mb-1.5">
                        <span
                          className={
                            activeCourse?.id === c.id ? "font-medium" : ""
                          }
                        >
                          {c.name}
                        </span>
                        <span className="text-xs text-text/40">
                          {c.topics.length} topics
                        </span>
                      </div>
                      <ConfidenceBar dist={dist} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[11px] text-text/35 mt-4">
            Bars read high · partial · thin across the course&rsquo;s topics.
          </p>
        </div>

        {/* Pane 3: Topics table */}
        <div>
          {activeCourse ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-heading text-lg">{activeCourse.name}</h3>
                <div className="flex gap-3 text-xs">
                  <FilterLink
                    termId={activeTerm.id}
                    courseId={activeCourse.id}
                    filter={undefined}
                    active={!params.filter}
                  >
                    All {activeCourse.topics.length}
                  </FilterLink>
                  <FilterLink
                    termId={activeTerm.id}
                    courseId={activeCourse.id}
                    filter="thin"
                    active={params.filter === "thin"}
                  >
                    Thin only
                  </FilterLink>
                  <FilterLink
                    termId={activeTerm.id}
                    courseId={activeCourse.id}
                    filter="handwritten"
                    active={params.filter === "handwritten"}
                  >
                    Handwritten
                  </FilterLink>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-text/40 border-b border-divider">
                    <th className="py-2 font-normal w-8">#</th>
                    <th className="py-2 font-normal">Topic</th>
                    <th className="py-2 font-normal">Confidence</th>
                    <th className="py-2 font-normal">Raw material</th>
                    <th className="py-2 font-normal text-right">
                      Last opened
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {topics.map((t, i) => (
                    <tr key={t.id}>
                      <td className="py-2.5 text-text/40">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="py-2.5">
                        <Link
                          href={`/topics/${t.id}`}
                          className="hover:text-accent"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <ConfidenceBadge confidence={t.confidence} />
                      </td>
                      <td className="py-2.5 text-text/50">
                        {rawMaterialSummary(t.sourceFiles)}
                      </td>
                      <td className="py-2.5 text-right text-text/40">
                        {relativeTime(t.lastOpenedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-text/35 mt-4">
                Thin topics stay in place — they are still where you left
                the material.
              </p>
            </>
          ) : (
            <p className="text-sm text-text/40">
              This term has no courses filed yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

async function loadTopics(courseId: string, filter?: string) {
  const where: Record<string, unknown> = { courseId };
  if (filter === "thin") where.confidence = "THIN";
  if (filter === "handwritten") {
    where.sourceFiles = { some: { sourceFile: { kind: "NOTES" } } };
  }
  return db.topic.findMany({
    where,
    orderBy: { order: "asc" },
    include: { sourceFiles: { include: { sourceFile: true } } },
  });
}

function confidenceDistribution(topics: { confidence: string }[]) {
  const total = topics.length || 1;
  const high = topics.filter((t) => t.confidence === "HIGH").length;
  const partial = topics.filter((t) => t.confidence === "PARTIAL").length;
  const thin = topics.filter((t) => t.confidence === "THIN").length;
  return {
    high: (high / total) * 100,
    partial: (partial / total) * 100,
    thin: (thin / total) * 100,
  };
}

function ConfidenceBar({
  dist,
}: {
  dist: { high: number; partial: number; thin: number };
}) {
  return (
    <div className="h-1 w-full flex rounded-full overflow-hidden bg-bg">
      <div className="bg-text" style={{ width: `${dist.high}%` }} />
      <div className="bg-text/50" style={{ width: `${dist.partial}%` }} />
      <div className="bg-text/15" style={{ width: `${dist.thin}%` }} />
    </div>
  );
}

function rawMaterialSummary(
  sourceFiles: { sourceFile: { kind: string } }[]
): string {
  if (sourceFiles.length === 0) return "—";
  const counts: Record<string, number> = {};
  for (const sf of sourceFiles) {
    counts[sf.sourceFile.kind] = (counts[sf.sourceFile.kind] ?? 0) + 1;
  }
  const labels: Record<string, string> = {
    SLIDES: "Deck",
    NOTES: "notes",
    CASE: "case",
    ASSIGNMENT: "assignment",
  };
  return Object.entries(counts)
    .map(([kind, n]) => (n > 1 ? `${labels[kind]} ×${n}` : labels[kind]))
    .join(" · ");
}

function FilterLink({
  termId,
  courseId,
  filter,
  active,
  children,
}: {
  termId: string;
  courseId: string;
  filter?: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const href = `/library?term=${termId}&course=${courseId}${
    filter ? `&filter=${filter}` : ""
  }`;
  return (
    <Link
      href={href}
      className={active ? "text-text font-medium" : "text-text/50 hover:text-text"}
    >
      {children}
    </Link>
  );
}

function EmptyLibrary() {
  return (
    <div className="px-8 py-10 max-w-lg">
      <h1 className="font-heading text-2xl mb-3">Library</h1>
      <p className="text-sm text-text/60">
        Nothing filed yet.{" "}
        <Link href="/add" className="text-accent hover:underline">
          Add your first course material
        </Link>{" "}
        to get started.
      </p>
    </div>
  );
}
