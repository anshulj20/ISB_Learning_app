import { db } from "@/lib/db";

// PLACEHOLDER relevance scoring — keyword overlap, not semantic embeddings.
// PROJECT_SPEC.md's "quick doubt" search is meant to be embeddings-based
// (sqlite-vec) so a query like "significance test" finds conceptually
// related material even with zero literal word overlap. That needs a real
// embedding pipeline, which needs the AI processing this placeholder seed
// data was built to avoid depending on tonight. This keyword version is a
// deliberately honest stand-in — good enough for the UI to be real and
// clickable, not good enough to trust as "near matches" yet. Swap the
// scoring function here for a vector search once ingestion is live.

export type SearchHit = {
  topicId: string;
  topicName: string;
  courseName: string;
  confidence: string;
  snippet: string;
  score: number;
};

export async function keywordSearch(
  query: string,
  excludeTopicId?: string
): Promise<SearchHit[]> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return [];

  const topics = await db.topic.findMany({
    where: excludeTopicId ? { id: { not: excludeTopicId } } : undefined,
    include: {
      course: true,
      sections: true,
    },
  });

  const hits: SearchHit[] = [];
  for (const t of topics) {
    const haystacks = [t.name, t.takeaway ?? "", ...t.sections.map((s) => s.body)];
    const fullText = haystacks.join(" ").toLowerCase();
    let score = 0;
    for (const w of words) {
      if (fullText.includes(w)) score += 1;
    }
    if (score === 0) continue;

    const snippetSource =
      t.sections.find((s) => s.body.toLowerCase().includes(words[0]))?.body ??
      t.takeaway ??
      "";
    const snippet =
      snippetSource.length > 160
        ? snippetSource.slice(0, 160).trimEnd() + "…"
        : snippetSource;

    hits.push({
      topicId: t.id,
      topicName: t.name,
      courseName: t.course.name,
      confidence: t.confidence,
      snippet,
      score: Math.round((score / words.length) * 100),
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}
