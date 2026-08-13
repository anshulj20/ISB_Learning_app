import { db } from "@/lib/db";
import { getTodayQuota } from "@/lib/quota";
import { fileKindLabel, fileStatusLabel } from "@/lib/format";
import { uploadFiles } from "./actions";

export default async function AddPage() {
  const [quota, queue, waitingCount] = await Promise.all([
    getTodayQuota(),
    db.sourceFile.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 20,
    }),
    db.sourceFile.count({ where: { status: "WAITING_FOR_QUOTA" } }),
  ]);

  const paused = quota.used >= quota.limit;
  const resetLabel = quota.resetAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const hoursUntilReset = Math.max(
    0,
    Math.round((quota.resetAt.getTime() - Date.now()) / (1000 * 60 * 60))
  );
  const doneCount = queue.filter((f) => f.status === "PROCESSED").length;
  const waitingInQueue = queue.filter(
    (f) => f.status === "WAITING_FOR_QUOTA" || f.status === "QUEUED"
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <header className="flex items-baseline justify-between mb-8">
        <h1 className="font-heading text-2xl">Add material</h1>
        <span className="text-xs text-text/50">
          Free processing {quota.used} / {quota.limit} today
        </span>
      </header>

      <form action={uploadFiles} className="mb-8">
        <div className="border-2 border-dashed border-divider rounded-lg p-10 text-center mb-4">
          <p className="text-base mb-1">
            Drop slides, PDFs, or photos of your notes
          </p>
          <p className="text-xs text-text/40 mb-5">
            PPTX · PDF · JPG · PNG · HEIC — up to 40 files at a time
          </p>
          <input
            type="file"
            name="files"
            multiple
            accept=".pptx,.pdf,.jpg,.jpeg,.png,.heic"
            className="block mx-auto text-sm mb-4"
          />
          <div className="flex items-center justify-center gap-3">
            <label className="text-xs text-text/50">
              File under:
              <select
                name="kind"
                className="ml-2 bg-surface border border-divider rounded px-2 py-1 text-xs"
                defaultValue="SLIDES"
              >
                <option value="SLIDES">Slides</option>
                <option value="NOTES">Handwritten notes</option>
                <option value="CASE">Case</option>
                <option value="ASSIGNMENT">Assignment</option>
              </select>
            </label>
          </div>
        </div>
        <button
          type="submit"
          className="bg-text text-bg text-sm rounded-md px-4 py-2 hover:opacity-90"
        >
          Browse files
        </button>
      </form>

      {paused && (
        <section className="mb-8 bg-surface border border-divider rounded-lg p-5">
          <h3 className="text-xs uppercase tracking-wider text-text/50 mb-2">
            Paused
          </h3>
          <p className="text-sm text-text/80 mb-2">
            Free AI processing is used up for now — this will process once
            it resets.
          </p>
          <p className="text-sm text-text/60">
            {waitingCount} file{waitingCount === 1 ? " is" : "s are"} queued
            and safe. Resets at {resetLabel}, about {hoursUntilReset} hour
            {hoursUntilReset === 1 ? "" : "s"} from now. You can keep
            dropping files in the meantime; they will be picked up in the
            order they arrived.
          </p>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-text/50">
            Today&rsquo;s queue
          </h3>
          <span className="text-xs text-text/40">
            {queue.length} files · {doneCount} done · {waitingInQueue} waiting
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-text/40 border-b border-divider">
              <th className="py-2 font-normal">File</th>
              <th className="py-2 font-normal">Kind</th>
              <th className="py-2 font-normal text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {queue.map((f) => (
              <tr key={f.id}>
                <td className="py-2.5">{f.originalFileName}</td>
                <td className="py-2.5 text-text/50">
                  {fileKindLabel(f.kind)}
                </td>
                <td className="py-2.5 text-right text-text/50">
                  {fileStatusLabel(f.status)}
                </td>
              </tr>
            ))}
            {queue.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-text/40">
                  Nothing uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="text-[11px] text-text/35 mt-4">
          Uploaded files are saved and queued honestly — the AI processing
          step (transcription, summarization, filing into a topic) isn&rsquo;t
          wired up yet in this build. See PROJECT_SPEC.md.
        </p>
      </section>
    </div>
  );
}
