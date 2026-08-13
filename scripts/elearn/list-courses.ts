// Prints your enrolled ISB eLearn courses with their Moodle course IDs,
// so you can feed one into scrape-course.ts at a time.
//
// Run: npm run elearn:list

import { getLoggedInPage, ELEARN_BASE } from "./shared";

async function main() {
  const { context, page } = await getLoggedInPage();

  await page.goto(`${ELEARN_BASE}/my/courses.php`, {
    waitUntil: "domcontentloaded",
  });

  // Moodle's default course-overview cards link to course/view.php?id=N.
  // If ISB's theme differs, this selector may need adjusting — run with
  // `npm run elearn:list -- --debug` to dump a screenshot for review.
  const debug = process.argv.includes("--debug");

  const courses = await page.$$eval('a[href*="course/view.php?id="]', (links) => {
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

  if (courses.length === 0) {
    console.log("No courses found. Things to check:");
    console.log("  - Are you actually enrolled/showing courses on /my/courses.php?");
    console.log("  - Did ISB's theme change the course-card markup?");
    if (debug) {
      const shot = "scripts/elearn/debug-list-courses.png";
      await page.screenshot({ path: shot, fullPage: true });
      console.log(`  - Screenshot saved to ${shot} for review.`);
    }
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
