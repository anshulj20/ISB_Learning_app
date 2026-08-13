import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fileKindLabel, fileStatusLabel } from "@/lib/format";

// Placeholder for the "Raw material viewer" screen (mockup #7/#11) — an
// actual PDF/PPTX/image viewer with zoom and, for handwriting, the
// transcript side-by-side. Not built tonight; this shows real metadata
// so links from Topic view aren't dead ends.
export default async function FileViewerPage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}) {
  const { fileId } = await params;
  const file = await db.sourceFile.findUnique({
    where: { id: fileId },
    include: { topics: { include: { topic: true } }, handwritingPages: true },
  });
  if (!file) notFound();

  return (
    <div className="max-w-xl mx-auto px-8 py-10">
      <h1 className="font-heading text-2xl mb-1">{file.originalFileName}</h1>
      <p className="text-xs text-text/40 mb-8">
        {file.format} · {fileKindLabel(file.kind)} ·{" "}
        {fileStatusLabel(file.status)}
      </p>

      <div className="bg-surface border border-divider rounded-lg p-8 text-center text-sm text-text/40 mb-8">
        Viewer not built yet — file is safely stored at{" "}
        <code className="text-xs">{file.storedPath}</code>
      </div>

      {file.handwritingPages.length > 0 && (
        <p className="text-xs text-text/40 mb-4">
          {file.handwritingPages.length} page
          {file.handwritingPages.length === 1 ? "" : "s"} transcribed.
        </p>
      )}

      <h3 className="text-xs uppercase tracking-wider text-text/50 mb-2">
        Feeds
      </h3>
      <ul className="space-y-1">
        {file.topics.map((tsf) => (
          <li key={tsf.id}>
            <Link
              href={`/topics/${tsf.topic.id}`}
              className="text-sm text-accent hover:underline"
            >
              {tsf.topic.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
