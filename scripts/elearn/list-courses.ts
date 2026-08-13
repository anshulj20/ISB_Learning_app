// Prints your enrolled ISB eLearn courses with their Moodle course IDs,
// so you can feed one into scrape-course.ts at a time.
//
// Run: npm run elearn:list

import { getLoggedInPage, ELEARN_BASE } from "./shared";

async function findCourses(page: import("playwright").Page) {
  // Modern Moodle dashboards often load the "Course overview" cards via
  // a background request AFTER the page's initial HTML — domcontentloaded
  // fires before they exist. Give them a real chance to appear before
  // giving up, instead of checking immediately.
  await page
    .waitForSelector('a[href*="course/view.php?id="]', { timeout: 8000 })
    .catch(() => {}); // fine if this times out — we still try the eval below

  return page.$$eval('a[href*="course/view.php?id="]', (links) => {
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
  });
}

async function main() {
  const { context, page } = await getLoggedInPage();

  // Try the standard "My courses" page first...
  await page.goto(`${ELEARN_BASE}/my/courses.php`, { waitUntil: "domcontentloaded" });
  let courses = await findCourses(page);

  // ...and fall back to the main dashboard if that page's layout doesn't
  // have what we expect (some Moodle themes only show the course
  // overview block on /my/, not /my/courses.php).
  if (courses.length === 0) {
    await page.goto(`${ELEARN_BASE}/my/`, { waitUntil: "domcontentloaded" });
    courses = await findCourses(page);
  }

  if (courses.length === 0) {
    console.log("No courses found. Things to check:");
    console.log("  - Are you actually enrolled/showing courses on /my/ or /my/courses.php?");
    console.log("  - Did ISB's theme change the course-card markup?");
    console.log("  - Is there a filter tab (e.g. \"In progress\") hiding your courses?");
    const shot = "scripts/elearn/debug-list-courses.png";
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`  - Screenshot saved to ${shot} — share this so it can be fixed.`);
  } else {
    console.log(`Found ${courses.length} course(s):\n`);
    for (const c of courses) {
      console.log(`  ${c.id}\t${c.name}`);
    }
    console.log("\nRun a single course with:");
    console.log('  npm run elearn:scrape -- <id> --term "Term N"');
  }

  await context.close();
}

main().catch((err) => {
  console.error("elearn:list failed:", err);
  process.exit(1);
});
