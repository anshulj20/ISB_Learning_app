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
// Every run automatically saves a full-page screenshot of the course
// page (_course-page-snapshot.png in the course's files/ folder) and
// runs a coverage check at the end comparing everything found on the
// page against everything actually processed — this is what caught the
// collapsed-sections bug in the first place, now built in rather than
// needing a human to notice and compare manually each time.
//
// Usage:
//   npm run elearn:scrape -- <courseId> --term "Term 2" [--course "Override Name"] [--debug]

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Page, BrowserContext } from "playwright";
import { getLoggedInPage, ELEARN_BASE, db, slugify, politeDelay, resolveUrl } from "./shared";

type FileKind = "SLIDES" | "NOTES" | "CASE" | "ASSIGNMENT";
type FileFormat = "PPTX" | "PDF" | "JPG" | "PNG" | "HEIC" | "DOCX" | "XLSX" | "CSV" | "HTML";

const EXT_TO_FORMAT: Record<string, FileFormat> = {
  ".pptx": "PPTX",
  ".pdf": "PDF",
  ".jpg": "JPG",
  ".jpeg": "JPG",
  ".png": "PNG",
  ".heic": "HEIC",
  ".docx": "DOCX",
  ".xlsx": "XLSX",
  ".csv": "CSV",
  ".html": "HTML",
  ".htm": "HTML",
};

// Single source of truth for which Moodle activity types we look for —
// used by BOTH the discovery pass and the coverage self-check. Keeping
// these as one shared list, not two copies, is deliberate: two separate
// lists drifting apart is exactly how "Course Outline" and "Course Pack"
// went unnoticed by both the scraper AND its own self-check — both used
// the same incomplete list, so the check couldn't catch what the
// discovery pass couldn't see either. "url" = Moodle's URL/link resource
// type; some courses use it for the course outline/coursepack instead of
// a plain file resource.
const WANTED_MOD_TYPES = ["resource", "folder", "assign", "url", "turnitintooltwo", "turnitintool"];

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
type InlineFile = { url: string; section: string };

// This course's page turned out to use collapsible accordion sections
// (Course Materials / Practice Sets / Assignments / Quizzes) — the first
// scrape only ever saw the Assignments section because that's what was
// expanded by default, silently missing everything else (confirmed via
// a screenshot of the real page). Click open anything collapsed before
// scanning for content. Generic aria-expanded targeting, not tied to a
// specific accordion plugin, so this should degrade harmlessly on
// courses that don't use one.
async function expandAllSections(page: Page): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    const toggles = await page.$$('[aria-expanded="false"]');
    if (toggles.length === 0) break;
    for (const toggle of toggles) {
      await toggle.click({ timeout: 1000 }).catch(() => {});
    }
    await politeDelay(400);
  }
}

// Moodle folders shown in "inline" display mode put their files' real
// pluginfile.php links directly in the course page's own HTML, NOT
// wrapped in a /mod/folder/view.php activity — so listActivities()
// (which only matches /mod/ links) misses them entirely. This is a
// second, independent scan of the same page for those bare file links,
// each tagged with its nearest preceding heading-like text (e.g.
// "Session 01 & 02") for organizing on disk.
async function listInlineFiles(page: Page): Promise<InlineFile[]> {
  return page.evaluate(() => {
    function isHeadingish(el: Element): boolean {
      // A link is never a heading — without this, a file link whose own
      // text happens to match the heading regex below (e.g. a file
      // literally named "Practice_set_1_solutions.pdf") gets read as
      // its own section label, one line before it's tagged with that
      // same label. Confirmed bug: that's exactly what happened to
      // every Practice Set file in the first real run.
      if (el.tagName === "A") return false;
      if (el.querySelector('a[href*="pluginfile.php"]')) return false;
      const text = (el.textContent || "").trim();
      if (!text || text.length > 80) return false;
      return (
        ["H1", "H2", "H3", "H4", "H5", "H6", "STRONG", "B", "LEGEND"].includes(el.tagName) ||
        /session|practice|midterm|end.?term|week/i.test(text)
      );
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let currentSection = "course-materials";
    const seen = new Map<string, string>(); // url -> section
    let node = walker.currentNode as Element | null;
    while (node) {
      if (isHeadingish(node)) {
        currentSection = (node.textContent || "").trim();
      }
      if (node.tagName === "A") {
        const href = node.getAttribute("href") || "";
        if (href.includes("pluginfile.php") && !seen.has(href)) {
          seen.set(href, currentSection);
        }
      }
      node = walker.nextNode() as Element | null;
    }
    return Array.from(seen.entries()).map(([url, section]) => ({ url, section }));
  });
}

async function listActivities(page: Page, courseId: string): Promise<Activity[]> {
  await page.goto(`${ELEARN_BASE}/course/view.php?id=${courseId}`, {
    waitUntil: "domcontentloaded",
  });
  await expandAllSections(page);

  return page.$$eval("a[href*='/mod/']", (links, wanted) => {
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
  }, WANTED_MOD_TYPES);
}

function guessKind(activityType: string, filename: string): FileKind {
  if (["assign", "turnitintooltwo", "turnitintool"].includes(activityType)) return "ASSIGNMENT";
  const lower = filename.toLowerCase();
  if (lower.includes("case")) return "CASE";
  if (lower.match(/\.(jpg|jpeg|png|heic)$/)) return "NOTES";
  return "SLIDES"; // default guess for resource/folder — reviewed later
}

// Moodle's <title> tag for a course page carries junk that shouldn't be
// part of the stored course name: a leading zero-width space and a
// trailing " | ISB" site suffix. Left uncleaned, re-scraping a course
// whose name was later tidied up by hand (during Phase-1 processing)
// stops matching on the next run and creates a duplicate empty course
// row instead of finding the existing one — confirmed to actually
// happen, not just a theoretical risk.
const ZERO_WIDTH_CODEPOINTS = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);

function cleanCourseName(raw: string): string {
  // Moodle's <title> text for this site leads with an invisible
  // character (zero-width space / ZWNJ / ZWJ / BOM, varies) and trails
  // with " | ISB". Stripped via explicit code-point comparison — not a
  // regex character class with the invisible glyph pasted in, which is
  // impossible to eyeball-verify as correct in a code review.
  let s = raw;
  while (s.length > 0 && ZERO_WIDTH_CODEPOINTS.has(s.charCodeAt(0))) {
    s = s.slice(1);
  }
  return s.replace(/\s*\|\s*ISB\s*$/i, "").trim();
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

// True when the browser ended up displaying the file itself — e.g.
// Chrome's built-in PDF viewer — rather than a Moodle page around it.
// Confirmed via debug screenshots: several "resource" activities landed
// here with no download event and no scannable page content (the
// viewer's own UI, not real markup), because the activity's "Display"
// setting just serves the file inline instead of forcing a download.
function looksLikeDirectFile(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return (
      /\.(pdf|docx?|xlsx?|csv|pptx?|jpe?g|png|heic)$/i.test(pathname) ||
      pathname.includes("pluginfile.php")
    );
  } catch {
    return false;
  }
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

  // The page "rendered", but as the browser's own file viewer rather
  // than a Moodle page — the current URL (after any redirects) IS the
  // file. Fetch it directly instead of scanning what's just viewer UI.
  if (looksLikeDirectFile(page.url())) {
    const filename = cleanFilename(page.url());
    if (!saved.includes(filename)) {
      try {
        const resp = await context.request.get(page.url());
        if (resp.ok()) {
          const buf = await resp.body();
          await writeFile(path.join(destDir, filename), buf);
          saved.push(filename);
          console.log(`    ↓ ${filename} (direct file view)`);
        }
      } catch (err) {
        console.log(`    ✗ couldn't fetch ${filename}: ${(err as Error).message}`);
      }
    }
    return saved; // nothing else to scan — this WAS the whole activity
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

// A full-page screenshot of the (expanded) course page, taken every run
// — not just on failure. This is what let us catch the collapsed-
// sections bug in the first place (the user manually printed the page
// and compared it against what got scraped); doing it automatically
// means that comparison doesn't require a human every time.
async function snapshotCoursePage(page: Page, courseId: string, destDir: string): Promise<void> {
  const shotPath = path.join(destDir, "_course-page-snapshot.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`  Course page snapshot: ${shotPath}`);
}

// Re-scans the course page for every /mod/ activity link and every
// pluginfile.php link, and reports anything found there that was never
// actually processed by the two discovery passes above. Doesn't
// guarantee full coverage (something could still be missed by BOTH the
// wanted-activity-types list and the pluginfile.php pattern — e.g. a
// module type genuinely not in that list), but it catches the class of
// bug that actually happened here: something present on the page but
// silently dropped by the code that was supposed to find it.
async function auditCoverage(
  page: Page,
  courseId: string,
  processedModKeys: Set<string>,
  processedFileUrls: Set<string>
): Promise<void> {
  await page.goto(`${ELEARN_BASE}/course/view.php?id=${courseId}`, { waitUntil: "domcontentloaded" });
  await expandAllSections(page);

  const allHrefs = await page.$$eval("a[href]", (links) =>
    links.map((a) => a.getAttribute("href") || "")
  );

  const modKeysOnPage = new Set<string>();
  const fileUrlsOnPage = new Set<string>();
  for (const href of allHrefs) {
    const modMatch = href.match(/\/mod\/(\w+)\/view\.php\?id=(\d+)/);
    if (modMatch && WANTED_MOD_TYPES.includes(modMatch[1])) {
      modKeysOnPage.add(`${modMatch[1]}-${modMatch[2]}`);
    }
    if (href.includes("pluginfile.php")) fileUrlsOnPage.add(href);
  }

  const missedActivities = [...modKeysOnPage].filter((k) => !processedModKeys.has(k));
  const missedFiles = [...fileUrlsOnPage].filter((u) => !processedFileUrls.has(u));

  console.log(`\nCoverage check:`);
  console.log(`  Activities: ${modKeysOnPage.size} on the page, ${processedModKeys.size} processed.`);
  console.log(`  Inline files: ${fileUrlsOnPage.size} on the page, ${processedFileUrls.size} processed.`);
  if (missedActivities.length === 0 && missedFiles.length === 0) {
    console.log(`  ✓ Everything found on the page was processed.`);
  } else {
    if (missedActivities.length > 0) {
      console.log(`  ⚠ ${missedActivities.length} activity link(s) on the page were never processed:`);
      for (const k of missedActivities) console.log(`    - ${k}`);
    }
    if (missedFiles.length > 0) {
      console.log(`  ⚠ ${missedFiles.length} file link(s) on the page were never processed:`);
      for (const u of missedFiles) console.log(`    - ${u}`);
    }
  }
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
    courseNameOverride ?? cleanCourseName((await page.title()).replace(/^.*?:\s*/, "").trim()) ??
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
  await snapshotCoursePage(page, courseId, destDir);

  const processedModKeys = new Set<string>();
  const processedFileUrls = new Set<string>();

  let totalFiles = 0;
  for (const activity of activities) {
    console.log(`\n  [${activity.type}] ${activity.name}`);
    processedModKeys.add(`${activity.type}-${activity.id}`);
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

  // Inline-displayed folder contents — a second pass over the course
  // page itself, independent of the /mod/ activity loop above. See
  // listInlineFiles()'s comment for why these need separate handling.
  console.log(`\nChecking for inline folder contents on the course page...`);
  await page.goto(`${ELEARN_BASE}/course/view.php?id=${courseId}`, { waitUntil: "domcontentloaded" });
  await expandAllSections(page);
  const inlineFiles = await listInlineFiles(page);
  console.log(`Found ${inlineFiles.length} inline file(s) across ${new Set(inlineFiles.map((f) => f.section)).size} section(s).`);

  for (const { url, section } of inlineFiles) {
    processedFileUrls.add(url);
    const filename = cleanFilename(url);
    const sectionDir = path.join(destDir, slugify(section));
    const storedPath = path.join("files", "elearn", slugify(scrapedCourseName), slugify(section), filename);

    const existing = await prisma.sourceFile.findFirst({ where: { storedPath } });
    if (existing) {
      console.log(`  (already queued from an earlier run: ${section} / ${filename})`);
      continue;
    }

    try {
      await mkdir(sectionDir, { recursive: true });
      const resp = await context.request.get(resolveUrl(url));
      if (!resp.ok()) {
        console.log(`  ✗ ${section} / ${filename}: HTTP ${resp.status()}`);
        continue;
      }
      const buf = await resp.body();
      await writeFile(path.join(sectionDir, filename), buf);
      console.log(`  ↓ ${section} / ${filename}`);
    } catch (err) {
      console.log(`  ✗ couldn't fetch ${section} / ${filename}: ${(err as Error).message}`);
      continue;
    }

    const format = guessFormat(filename);
    if (!format) {
      console.log(`    (skipping DB row — unsupported format: ${filename})`);
      continue;
    }
    await prisma.sourceFile.create({
      data: {
        originalFileName: filename,
        storedPath,
        kind: guessKind("resource", filename),
        format,
        status: "QUEUED",
      },
    });
    totalFiles++;
    await politeDelay(300);
  }

  console.log(`\nGrades:`);
  await scrapeGrades(page, courseId, destDir);

  await auditCoverage(page, courseId, processedModKeys, processedFileUrls);

  console.log(`\n✓ Done. ${totalFiles} file(s) saved to ${destDir} and queued in the app.`);
  console.log(`  Review kind/confidence during Phase-1 processing — guesses here are rough.`);

  await prisma.$disconnect();
  await context.close();
}

main().catch((err) => {
  console.error("elearn:scrape failed:", err);
  process.exit(1);
});
