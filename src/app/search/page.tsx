import Link from "next/link";
import { keywordSearch } from "@/lib/naive-search";
import { ConfidenceBadge } from "@/components/confidence-badge";

// A working but simplified stand-in for the full "Search results" screen
// in the mockup (facets by course/source/confidence, exact-vs-near split
// with real percentages). Real relevance still needs the sqlite-vec
// embeddings pipeline — see src/lib/naive-search.ts.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const hits = q ? await keywordSearch(q) : [];

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="font-heading text-2xl mb-6">Find</h1>
      <form className="mb-8">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search a concept, a case, or your own notes…"
          className="w-full bg-surface border border-divider rounded-md px-4 py-3 text-sm placeholder:text-text/40 focus:outline-none focus:border-accent"
          autoFocus
        />
      </form>

      {q && (
        <>
          <p className="text-xs text-text/40 mb-4">
            {hits.length} result{hits.length === 1 ? "" : "s"} for &ldquo;
            {q}&rdquo;
          </p>
          <ul className="space-y-4">
            {hits.map((h) => (
              <li key={h.topicId}>
                <Link
                  href={`/topics/${h.topicId}`}
                  className="block bg-surface border border-divider rounded-lg p-4 hover:border-accent transition-colors"
                >
                  <div className="text-[11px] uppercase tracking-wider text-text/40 mb-1">
                    {h.courseName}
                  </div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="font-heading text-lg">
                      {h.topicName}
                    </span>
                    <ConfidenceBadge
                      confidence={h.confidence as "HIGH" | "PARTIAL" | "THIN"}
                    />
                  </div>
                  <p className="text-sm text-text/60 line-clamp-2">
                    {h.snippet}
                  </p>
                </Link>
              </li>
            ))}
            {hits.length === 0 && (
              <p className="text-sm text-text/40">Nothing close to that yet.</p>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
