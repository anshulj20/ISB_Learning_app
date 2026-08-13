// Prints your Hyderabad-campus ISB eLearn courses with their Moodle
// course IDs, so you can feed one into scrape-course.ts at a time.
//
// Source: the "Custom Course Menu" block on the /my/ dashboard — a
// nested tree where each bold line is a full category path (e.g.
// "Hyderabad Campus (PGPYL)/Post Graduate Programme.../Term 1") and the
// plain links under it are that category's courses. Confirmed via a
// screenshot of the real page (not guessed) — structure is:
//   <li> "<category path text>"
//     <ul><li><a href="course/view.php?id=N">Course name</a></li>...</ul>
//   </li>
// This matters because it's NOT the same "Course overview" block/page
// tried earlier (/my/courses.php, profile page) — those don't carry
// campus/category info at all, which is why filtering wasn't possible
// there.
//
// Run: npm run elearn:list

import { getLoggedInPage, ELEARN_BASE } from "./shared";

type Hit = { heading: string; id: string; name: string };

async function main() {
  const { context, page } = await getLoggedInPage();

  await page.goto(`${ELEARN_BASE}/my/`, { waitUntil: "domcontentloaded" });
  await page
    .waitForSelector('a[href*="course/view.php?id="]', { timeout: 8000 })
    .catch(() => {});

  const { headingsSeen, hits }: { headingsSeen: string[]; hits: Hit[] } = await page.evaluate(() => {
    // A list item's "own text" — its direct text, excluding any nested
    // <ul>/<ol> (the sub-list of courses under it). That's the category
    // path label without the course names bleeding into it.
    function ownText(el: Element): string {
      let text = "";
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          text += child.textContent ?? "";
        } else if (
          child.nodeType === Node.ELEMENT_NODE &&
          (child as Element).tagName !== "UL" &&
          (child as Element).tagName !== "OL"
        ) {
          text += (child as Element).textContent ?? "";
        }
      }
      return text.trim();
    }

    const links = Array.from(
      document.querySelectorAll('a[href*="course/view.php?id="]')
    );
    const headingsSeen = new Set<string>();
    const hits: { heading: string; id: string; name: string }[] = [];

    for (const a of links) {
      const li = a.closest("li");
      let heading = "(unknown)";
      if (li && li.parentElement && /^(UL|OL)$/.test(li.parentElement.tagName)) {
        const categoryLi = li.parentElement.closest("li");
        if (categoryLi) heading = ownText(categoryLi) || "(unknown)";
      }
      if (heading !== "(unknown)") headingsSeen.add(heading);

      const href = a.getAttribute("href") ?? "";
      const match = href.match(/id=(\d+)/);
      if (match) {
        const name = (a.textContent ?? "").trim();
        if (name) hits.push({ heading, id: match[1], name });
      }
    }

    return { headingsSeen: Array.from(headingsSeen), hits };
  });

  if (headingsSeen.length === 0) {
    console.log('Found course links, but none had a detectable category heading above them.');
    console.log("The nested-list structure assumption may not match ISB's actual markup.");
    const shot = "scripts/elearn/debug-list-courses.png";
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`Screenshot saved to ${shot} — share this so it can be fixed.`);
    await context.close();
    return;
  }

  const hyderabadHits = hits.filter((h) => /hyderabad/i.test(h.heading));
  const seen = new Map<string, string>();
  for (const h of hyderabadHits) {
    if (!seen.has(h.id)) seen.set(h.id, h.name);
  }

  if (seen.size === 0) {
    console.log("Found category headings, but none matched \"Hyderabad\":");
    for (const h of headingsSeen) console.log(`  - ${h}`);
    const shot = "scripts/elearn/debug-list-courses.png";
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`Screenshot saved to ${shot} for review.`);
  } else {
    console.log(`Headings found (${headingsSeen.length}):`);
    for (const h of headingsSeen) console.log(`  - ${h}`);
    console.log(`\nHyderabad Campus courses (${seen.size}):\n`);
    for (const [id, name] of seen) {
      console.log(`  ${id}\t${name}`);
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
