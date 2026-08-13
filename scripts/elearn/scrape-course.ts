// Scrapes ONE ISB eLearn (Moodle) course: downloads its files, guesses
// what kind each one is, and files them into the local DB as QUEUED
// SourceFile rows — same place uploads from the Add screen land. Kind
// guesses are rough on purpose; they get reviewed properly during
// Phase-1 processing (see PROJECT_SPEC.md), not treated as final here.
//
// Deliberately ONE course per run — per the user's instruction, no bulk
// "scrape everything" mode. Best-effort against standard Moodle URL/DOM
// patterns; ISB's actual theme may need small selector adjustments once
// run for real. Run with --debug to get screenshots when something
// doesn't match what was expected.
//
// Usage:
//   npm run elearn:scrape -- <courseId> --term "Term 2" [--course "Override Name"] [--debug]

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Page, BrowserContext } from "playwright";
import { getLoggedInPage, ELEARN_BASE, db, slugify, politeDelay, resolveUrl } from "./shared";

type FileKind = "SLIDES" | "NOTES" | "CASE" | "ASSIGNMENT";
type FileFormat = "PPTX" | "PDF" | "JPG" | "PNG" | "HEIC";

const EXT_TO_FORMAT: Record<string, FileFormat> = {
  ".pptx": "PPTX",
  ".pdf": "PDF",
  ".jpg": "JPG",
  ".jpeg": "JPG",
  ".png": "PNG",
  ".heic": "HEIC",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const courseId = args.find((a) => !a.startsWith("--"));
  const termIdx = args.indexOf("--term");
  const courseNameIdx = args.indexOf("--course");
  const term = termIdx >= 0 ? args[termIdx + 1] : undefined;
  const courseNameOverride = courseNameIdx >= 0 ? args[courseNameIdx + 1] : undefined;
  const debug = args.includes("--debug");

  if (!courseId || !term) {
    console.error(
      'Usage: npm run elearn:scrape -- <courseId> --term "Term N" [--course "Override Name"] [--debug]'
    );
    console.error("Run `npm run elearn:list` first to find course IDs.");
    process.exit(1);
  }
  return { courseId, term, courseNameOverride, debug };
}

type Activity = { type: string; id: string; name: string; href: string };

async function listActivities(page: Page, courseId: string): Promise<Activity[]> {
  await page.goto(`${ELEARN_BASE}/course/view.php?id=${courseId}`, {
    waitUntil: "domcontentloaded",
  });

  return page.$$eval("a[href*='/mod/']", (links) => {
    const wanted = ["resource", "folder", "assign"];
    const seen = new Map<string, { type: string; id: string; name: string; href: string }>();
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      const match = href.match(/\/mod\/(\w+)\/view\.php\?id=(\d+)/);
      if (!match) continue;
      const [, type, id] = match;
      if (!wanted.includes(type)) continue;
      const name = a.textContent?.trim().replace(/\s+/g, " ");
      const key = `${type}-${id}`;
      if (name && !seen.has(key)) {
        seen.set(key, { type, id, name, href });
      }
    }
    return Array.from(seen.values());
  });
}

function guessKind(activityType: string, filename: string): FileKind {
  if (activityType === "assign") return "ASSIGNMENT";
  const lower = filename.toLowerCase();
  if (lower.includes("case")) return "CASE";
  if (lower.match(/\.(jpg|jpeg|png|heic)$/)) return "NOTES";
  return "SLIDES"; // default guess for resource/folder — reviewed later
}

function guessFormat(filename: string): FileFormat | null {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TO_FORMAT[ext] ?? null;
}

// Moodle file URLs often carry a trailing query string (e.g.
// "?forcedownload=1") — strip it before treating the tail as a
// filename, or Windows rejects the "?" and every write fails.
function cleanFilename(raw: string): string {
  const withoutQuery = raw.split("?")[0];
  const base = withoutQuery.split("/").pop() || "file";
  return decodeURIComponent(base);
}

/**
 * Downloads every real file reachable from an activity page (resource,
 * folder, or assignment). Two strategies, tried in order:
 *  1. Click a link and catch Playwright's `download` event (works when
 *     Moodle forces a download).
 *  2. Look for pluginfile.php URLs in <a>/<iframe>/<object> on the page
 *     and fetch them directly via the authenticated request context
 *     (works when Moodle displays the file inline instead of downloading).
 */
async function downloadActivityFiles(
  page: Page,
  context: BrowserContext,
  activity: Activity,
  destDir: string,
  debug: boolean
): Promise<string[]> {
  const saved: string[] = [];
  const activityUrl = resolveUrl(activity.href);

  // Navigating to the activity's own page can itself BE the download —
  // Moodle "force download" resources never render a page at all; the
  // navigation gets replaced by a download, which Playwright surfaces as
  // an error on goto() ("Download is starting"), not a normal event.
  // That's what crashed the first real run: this wasn't caught here,
  // only inside the click-loop below, so it propagated all the way up
  // and killed the whole script instead of just skipping this activity.
  const initialDownloadPromise = page
    .waitForEvent("download", { timeout: 5000 })
    .catch(() => null);
  let pageRendered = true;
  try {
    await page.goto(activityUrl, { waitUntil: "domcontentloaded" });
  } catch (err) {
    if (err instanceof Error && /Download is starting/i.test(err.message)) {
      pageRendered = false;
    } else {
      throw err;
    }
  }
  const initialDownload = await initialDownloadPromise;
  if (initialDownload) {
    const filename = cleanFilename(initialDownload.suggestedFilename());
    await initialDownload.saveAs(path.join(destDir, filename));
    saved.push(filename);
    console.log(`    ↓ ${filename}`);
  }

  if (!pageRendered) {
    // The whole activity WAS the file — no page left to scan further.
    return saved;
  }

  // Strategy 1: anything that looks like a direct file/download link on
  // this page — try clicking each and see if a download fires.
  const candidateLinks = await page.$$eval(
    "a[href*='pluginfile.php'], a.aalink, .resourcelinkdetails a, a[href*='mod_folder'], a[href*='mod_resource'], a[href*='mod_assign']",
    (links) => links.map((a) => a.getAttribute("href")).filter((h): h is string => !!h)
  );

  for (const href of new Set(candidateLinks)) {
    try {
      const downloadPromise = page.waitForEvent("download", { timeout: 4000 });
      await page.goto(resolveUrl(href), {
        waitUntil: "domcontentloaded",
      }).catch(() => {}); // navigation may be interrupted by the download itself — fine
      const download = await downloadPromise.catch(() => null);
      if (download) {
        const filename = cleanFilename(download.suggestedFilename());
        if (!saved.includes(filename)) {
          await download.saveAs(path.join(destDir, filename));
          saved.push(filename);
          console.log(`    ↓ ${filename}`);
        }
      }
    } catch {
      // not a download link — fine, other strategy or link may cover it
    }
    await politeDelay(300);
  }

  // Strategy 2: direct fetch of any pluginfile.php URL still visible on
  // the (possibly navigated-away) activity page, for inline-displayed
  // files strategy 1 didn't catch.
  await page.goto(activityUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
  const fileUrls = await page.$$eval(
    "a[href*='pluginfile.php'], iframe[src*='pluginfile.php'], object[data*='pluginfile.php']",
    (els) =>
      els
        .map((el) => el.getAttribute("href") ?? el.getAttribute("src") ?? el.getAttribute("data"))
        .filter((u): u is string => !!u)
  );
  for (const url of new Set(fileUrls)) {
    const filename = cleanFilename(url);
    if (saved.includes(filename)) continue;
    try {
      const resp = await context.request.get(resolveUrl(url));
      if (resp.ok()) {
        const buf = await resp.body();
        await writeFile(path.join(destDir, filename), buf);
        saved.push(filename);
        console.log(`    ↓ ${filename} (direct fetch)`);
      }
    } catch (err) {
      console.log(`    ✗ couldn't fetch ${filename}: ${(err as Error).message}`);
    }
    await politeDelay(300);
  }

  if (saved.length === 0) {
    console.log(`    (nothing found for this activity)`);
    if (debug) {
      const shotName = `debug-${activity.type}-${activity.id}.png`;
      await page.screenshot({ path: path.join("scripts/elearn", shotName) });
      console.log(`    screenshot saved to scripts/elearn/${shotName}`);
    }
  }

  return saved;
}

async function scrapeGrades(page: Page, courseId: string, destDir: string) {
  await page.goto(`${ELEARN_BASE}/grade/report/user/index.php?id=${courseId}`, {
    waitUntil: "domcontentloaded",
  });
  const rows = await page.$$eval("table.user-grade tr, table.generaltable tr", (trs) =>
    trs.map((tr) =>
      Array.from(tr.querySelectorAll("th, td")).map((cell) => cell.textContent?.trim() ?? "")
    ).filter((r) => r.some((c) => c.length > 0))
  );
  if (rows.length > 0) {
    const dest = path.join(destDir, "grades.json");
    await writeFile(dest, JSON.stringify(rows, null, 2));
    console.log(`  Grades saved: ${dest} (${rows.length} rows — review manually, layout varies)`);
  } else {
    console.log("  No grade table found (selector may not match ISB's theme).");
  }
}

async function main() {
  const { courseId, term, courseNameOverride, debug } = parseArgs();
  const prisma = db();

  const termRow = await prisma.term.findFirst({ where: { name: term } });
  if (!termRow) {
    const all = await prisma.term.findMany({ select: { name: true } });
    console.error(`Term "${term}" not found. Existing terms: ${all.map((t) => t.name).join(", ")}`);
    process.exit(1);
  }

  const { context, page } = await getLoggedInPage();

  console.log(`\nReading course ${courseId}...`);
  const activities = await listActivities(page, courseId);
  const scrapedCourseName =
    courseNameOverride ??
    (await page.title()).replace(/^.*?:\s*/, "").trim() ??
    `Course ${courseId}`;

  console.log(`Course: "${scrapedCourseName}" — ${activities.length} file-bearing activities found`);

  let courseRow = await prisma.course.findFirst({
    where: { termId: termRow.id, name: scrapedCourseName },
  });
  if (!courseRow) {
    const maxOrder = await prisma.course.aggregate({
      where: { termId: termRow.id },
      _max: { order: true },
    });
    courseRow = await prisma.course.create({
      data: {
        termId: termRow.id,
        name: scrapedCourseName,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    console.log(`  Created new course row under ${term}.`);
  }

  const destDir = path.join(process.cwd(), "files", "elearn", slugify(scrapedCourseName));
  await mkdir(destDir, { recursive: true });

  let totalFiles = 0;
  for (const activity of activities) {
    console.log(`\n  [${activity.type}] ${activity.name}`);
    const filenames = await downloadActivityFiles(page, context, activity, destDir, debug);
    for (const filename of filenames) {
      const format = guessFormat(filename);
      if (!format) {
        console.log(`    (skipping DB row — unsupported format: ${filename})`);
        continue;
      }
      const kind = guessKind(activity.type, filename);
      const storedPath = path.join("files", "elearn", slugify(scrapedCourseName), filename);

      // Re-running a course (likely, given how much retrying a first
      // scrape tends to need) shouldn't create duplicate rows for files
      // already queued from an earlier attempt.
      const existing = await prisma.sourceFile.findFirst({ where: { storedPath } });
      if (existing) {
        console.log(`    (already queued from an earlier run: ${filename})`);
        continue;
      }

      await prisma.sourceFile.create({
        data: {
          originalFileName: filename,
          storedPath,
          kind,
          format,
          status: "QUEUED",
        },
      });
      totalFiles++;
    }
    await politeDelay(500);
  }

  console.log(`\nGrades:`);
  await scrapeGrades(page, courseId, destDir);

  console.log(`\n✓ Done. ${totalFiles} file(s) saved to ${destDir} and queued in the app.`);
  console.log(`  Review kind/confidence during Phase-1 processing — guesses here are rough.`);

  await prisma.$disconnect();
  await context.close();
}

main().catch((err) => {
  console.error("elearn:scrape failed:", err);
  process.exit(1);
});
