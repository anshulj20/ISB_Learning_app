// Prints your enrolled ISB eLearn courses with their Moodle course IDs,
// so you can feed one into scrape-course.ts at a time.
//
// Moodle's dashboard often only *shows* an "In progress" subset by
// default (Past/Future/All are separate client-side tabs, not separate
// pages) — so this pulls from three places and merges them, rather than
// trusting the dashboard's default view alone.
//
// Run: npm run elearn:list

import type { Page } from "playwright";
import { getLoggedInPage, ELEARN_BASE } from "./shared";

type Course = { id: string; name: string };

function extractCourseLinks(): Course[] {
  const links = Array.from(
    document.querySelectorAll('a[href*="course/view.php?id="]')
  );
  const seen = new Map<string, string>();
  for (const a of links) {
    const href = a.getAttribute("href") ?? "";
    const match = href.match(/id=(\d+)/);
    if (!match) continue;
    const id = match[1];
    const name = a.textContent?.trim();
    if (name && name.length > 0 && !seen.has(id)) {
      seen.set(id, name);
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

async function scrapeCurrentPage(page: Page): Promise<Course[]> {
  await page
    .waitForSelector('a[href*="course/view.php?id="]', { timeout: 8000 })
    .catch(() => {});
  return page.evaluate(extractCourseLinks);
}

/** Clicks any dashboard tab/filter that looks like "All", if one exists. */
async function tryClickAllTab(page: Page): Promise<boolean> {
  const candidates = [
    'a:has-text("All")',
    'button:has-text("All")',
    '[data-filter="all"]',
    '[data-key="all"]',
  ];
  for (const selector of candidates) {
    const el = page.locator(selector).first();
    if (await el.count().catch(() => 0)) {
      try {
        await el.click({ timeout: 2000 });
        await page.waitForTimeout(1200); // let the AJAX re-render settle
        return true;
      } catch {
        // try the next candidate
      }
    }
  }
  return false;
}

/** Finds the logged-in user's own profile URL, if a link to it is visible. */
async function findProfileUrl(page: Page): Promise<string | null> {
  const href = await page
    .locator('a[href*="/user/profile.php?id="]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  return href ?? null;
}

function mergeCourses(...lists: Course[][]): Course[] {
  const merged = new Map<string, string>();
  for (const list of lists) {
    for (const c of list) {
      if (!merged.has(c.id)) merged.set(c.id, c.name);
    }
  }
  return Array.from(merged.entries()).map(([id, name]) => ({ id, name }));
}

async function main() {
  const { context, page } = await getLoggedInPage();
  const found: Course[][] = [];

  // Source 1: dashboard "My courses" page, default view.
  await page.goto(`${ELEARN_BASE}/my/courses.php`, { waitUntil: "domcontentloaded" });
  found.push(await scrapeCurrentPage(page));

  // Source 2: same page, but try clicking an "All" tab if one exists —
  // covers Moodle's default-hides-past/future-courses behavior.
  if (await tryClickAllTab(page)) {
    found.push(await scrapeCurrentPage(page));
  }

  // Source 3: the main dashboard, in case the theme puts the course
  // overview block there instead of on /my/courses.php.
  await page.goto(`${ELEARN_BASE}/my/`, { waitUntil: "domcontentloaded" });
  found.push(await scrapeCurrentPage(page));
  if (await tryClickAllTab(page)) {
    found.push(await scrapeCurrentPage(page));
  }

  // Source 4: the user's own profile page — lists ALL enrolled courses
  // under "Course details", not subject to dashboard tab filtering.
  const profileUrl = await findProfileUrl(page);
  if (profileUrl) {
    await page.goto(profileUrl.startsWith("http") ? profileUrl : `${ELEARN_BASE}${profileUrl}`, {
      waitUntil: "domcontentloaded",
    });
    found.push(await scrapeCurrentPage(page));
  }

  const courses = mergeCourses(...found).sort((a, b) => a.name.localeCompare(b.name));

  if (courses.length === 0) {
    console.log("No courses found. Things to check:");
    console.log("  - Are you actually enrolled/showing courses on /my/ or /my/courses.php?");
    console.log("  - Did ISB's theme change the course-card markup?");
    const shot = "scripts/elearn/debug-list-courses.png";
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`  - Screenshot saved to ${shot} — share this so it can be fixed.`);
  } else {
    console.log(`Found ${courses.length} course(s) (merged across dashboard + profile page):\n`);
    for (const c of courses) {
      console.log(`  ${c.id}\t${c.name}`);
    }
    console.log("\nStill missing some you expect? Tell me roughly how many you");
    console.log("expect and I'll add another source or fix the tab-clicking.");
    console.log("\nRun a single course with:");
    console.log('  npm run elearn:scrape -- <id> --term "Term N"');
  }

  await context.close();
}

main().catch((err) => {
  console.error("elearn:list failed:", err);
  process.exit(1);
});
