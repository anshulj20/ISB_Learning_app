import { db } from "@/lib/db";

// Placeholder — tonight's build prioritized Home/Library/Topic/Add
// (user's explicit call). The data model for this already exists
// (Concept, ConceptLink in schema.prisma) so this is a rendering task,
// not a data-model task, whenever it's picked up next.
export default async function GraphPage() {
  const concepts = await db.concept.findMany({
    include: { topics: { include: { course: true } } },
  });
  const recurring = concepts.filter((c) => c.topics.length > 1);

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="font-heading text-2xl mb-2">Concept graph</h1>
      <p className="text-sm text-text/50 mb-8">
        Not built yet — the underlying data is there, the visual explorer
        isn&rsquo;t. Depth went to Home / Library / Topic / Add tonight.
      </p>
      {recurring.length > 0 ? (
        <ul className="space-y-3">
          {recurring.map((c) => (
            <li
              key={c.id}
              className="bg-surface border border-divider rounded-lg p-4"
            >
              <div className="font-heading text-lg mb-1">{c.name}</div>
              <div className="text-xs text-text/40">
                {c.topics.map((t) => t.course.name).join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text/40">No recurring concepts yet.</p>
      )}
    </div>
  );
}
