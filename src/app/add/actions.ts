"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getTodayQuota } from "@/lib/quota";

const FILES_ROOT = path.join(process.cwd(), "files", "inbox");

const EXT_TO_FORMAT: Record<string, "PPTX" | "PDF" | "JPG" | "PNG" | "HEIC"> = {
  ".pptx": "PPTX",
  ".pdf": "PDF",
  ".jpg": "JPG",
  ".jpeg": "JPG",
  ".png": "PNG",
  ".heic": "HEIC",
};

// Real file storage, real DB rows — but this does NOT run any AI
// processing. That's the ingestion pipeline (transcribe → embed →
// summarize → confidence-score, per PROJECT_SPEC.md), which needs the
// Gemini integration this build doesn't wire up yet. Uploaded files land
// as QUEUED (or WAITING_FOR_QUOTA if today's free quota is already
// spent) and stay there honestly rather than pretending to process them.
export async function uploadFiles(formData: FormData) {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const kind = (formData.get("kind") as string) || "SLIDES";

  if (files.length === 0) return;

  await mkdir(FILES_ROOT, { recursive: true });
  const quota = await getTodayQuota();

  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    const format = EXT_TO_FORMAT[ext];
    if (!format) continue; // silently skip unsupported types for now

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const storedPath = path.join("files", "inbox", safeName);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(process.cwd(), storedPath), bytes);

    const wouldExceedQuota = quota.used >= quota.limit;

    await db.sourceFile.create({
      data: {
        originalFileName: file.name,
        storedPath,
        kind: kind as "SLIDES" | "NOTES" | "CASE" | "ASSIGNMENT",
        format,
        status: wouldExceedQuota ? "WAITING_FOR_QUOTA" : "QUEUED",
      },
    });
  }

  revalidatePath("/add");
  revalidatePath("/");
}
