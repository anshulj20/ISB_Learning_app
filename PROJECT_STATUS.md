# ISB Learning Inventory — Project Status (session handoff)

Written so a fresh Claude Code session (this one's context may run out)
has full working context without re-deriving it. Read `PROJECT_SPEC.md`
first for the product spec/architecture decisions — this file is the
living build log: what's actually built, what's real vs. placeholder,
every non-obvious bug already found and fixed, and exactly what to do
next. **This file will go stale — update it as you go, don't just read
it once.**

## Where things live

- **Local repo**: `C:\Users\DELL\Downloads\isb-learning-inventory` —
  standalone folder (not under the ISB OneDrive, not nested in
  `Coding try`). See PROJECT_SPEC.md § "Where things live" for why.
- **GitHub**: https://github.com/anshulj20/ISB_Learning_app (private,
  `main` branch) — code backup only. `files/`, `dev.db`, and
  `.playwright-profile/` are gitignored on purpose (personal content and
  a live session cookie — never belong in git, even private).
- **Dev server**: `npm run dev`, port **3010**.
  `.claude/launch.json` for the preview tool currently lives under the
  *old* ISB OneDrive path (a leftover from before the project moved) —
  harmless, it `cd`s into the real repo before running, but worth
  relocating if it ever causes confusion.
- **Database**: SQLite, `prisma/dev.db`, via
  `@prisma/adapter-better-sqlite3`. **After any `prisma/schema.prisma`
  change**: run `npx prisma generate`, then if the dev server was
  already running, you MUST `rm -rf .next` before restarting it —
  Turbopack's persistent cache holds the old compiled Prisma client and
  a plain restart isn't enough (confirmed: caused a live
  `PrismaClientKnownRequestError` after adding DOCX/XLSX/CSV formats).

## Environment quirks (learned the hard way — don't rediscover these)

- **This Claude Code tool session and the user's real Windows machine
  share the project folder's files** (edits/writes here show up for the
  user, and files the user's own terminal creates — e.g. scraped course
  files, `dev.db` writes — are visible back here too), **but do NOT
  share everything.** `%LOCALAPPDATA%` (e.g. Playwright's downloaded
  Chromium binary) is NOT shared — installing Playwright via this
  session's Bash tool does not make it available in the user's own
  terminal; they had to run `npx playwright install chromium`
  themselves too.
- **This session's Bash tool cannot launch a headed (visible) browser
  window** — fails with `spawn UNKNOWN`. Headless works fine (used for
  taking app screenshots to send the user). This is why the eLearn
  scraper (which needs a real visible window for the user to log into,
  `headless: false`) can only ever be run by the **user**, in **their
  own terminal**, never by Claude directly.
- **There IS a way to read the user's terminal output directly**:
  `mcp__terminal__read_terminal` (load via `ToolSearch` if not already
  loaded), with a `wait_for_output_ms` param to block for fresh output
  instead of asking the user to say "done" every time. This reads
  whichever terminal panel is integrated into the user's Claude Code
  app — NOT a standalone PowerShell window opened separately, and NOT
  this session's own Bash tool. Confirmed working well once the user
  started running commands in the right panel.
- **PowerShell execution policy**: a fresh PowerShell blocks all npm
  commands by default (`running scripts is disabled`). Fix (one-time,
  user must run it — it's a security-setting change):
  `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.
- **This environment has no `poppler-utils`**, so the `Read` tool can't
  render PDF pages as images. Use `scripts/tools/extract-text.ts`
  instead (pdf-parse/mammoth/xlsx) — works well for the mostly
  text-heavy academic material actually being processed here.
- **Invisible Unicode characters are impossible to eyeball-verify** when
  pasted into code (e.g. Moodle's page titles start with a zero-width
  space, U+200B). If you need to strip one, verify with
  `.charCodeAt(0)` / `.codePointAt(0)` printed to console — don't trust
  a regex character class you can't actually see the contents of.

## What's built

Full Next.js 16 / React 19 / Prisma 7 / Tailwind v4 app, local-first
(SQLite, no NextAuth/pg). Visual design pulled from the mockup's actual
CSS tokens (Cormorant Garamond + Lora, warm paper palette, no
traffic-light confidence colors, light/dark theme toggle in the nav).

**Screens working for real**: Home (`/`), Library (`/library`, 3-pane
term/course/topic browser), Topic view (`/topics/[id]`, working
"quick doubt" keyword search), Add (`/add`, real file upload). `/graph`
and `/search` are thin stubs. `/files/[id]` shows metadata only, no real
viewer yet.

**Data model** (`prisma/schema.prisma`): Term → Course → Topic,
KnowledgeSection, UserNote (kept structurally separate from generated
content), SourceFile + TopicSourceFile, HandwritingPage +
TranscriptBlock (built, unused so far — no handwritten material
processed yet), AssignmentQuestion/Answer (own vs. faculty + grade +
marker feedback), Concept + ConceptLink (graph data model exists, no
graph UI yet), TopicVisit, SuggestedReading, QuotaUsage. `FileFormat`
enum: PPTX/PDF/DOCX/XLSX/CSV/JPG/PNG/HEIC (`.jmp` — JMP stats software's
native format — is NOT supported; those files download to disk fine but
never get a DB row).

**eLearn scraper** (`scripts/elearn/`) — genuinely robust now, after a
lot of iteration against the real site:
- `shared.ts` — persistent visible-browser login (user logs in by hand
  including MFA, session cookie persists in `.playwright-profile/` so
  most re-runs skip login entirely), `resolveUrl()`, `slugify()`.
- `list-courses.ts` — walks the "Custom Course Menu" tree on `/my/`
  (NOT the standard Moodle dashboard cards — this site has both, only
  the custom tree carries campus/category info), filters to headings
  containing "hyderabad".
- `scrape-course.ts <id> --term "Term N" [--course "override"] [--debug]`
  — scrapes ONE course (deliberately, per the user — no bulk mode).
  Handles: forced-download resources, Chrome's-native-PDF-viewer
  resources, normal Moodle activity pages, AND inline-displayed folder
  contents (a second independent scan — Moodle folders in "inline"
  display mode put file links straight in the course page's HTML, not
  wrapped in a `/mod/folder/` activity, so the first scan alone misses
  them). Every run: saves a full-page course-page screenshot
  (`_course-page-snapshot.png`) and runs a coverage self-check
  (re-scans the page, reports anything found there that was never
  actually processed) — this is what caught every real bug below.
  Cleans Moodle's junk course-title text (leading invisible char,
  trailing " | ISB") before matching/creating the Course row.
- `scripts/tools/extract-text.ts <file>` — PDF/DOCX/XLSX → plain text,
  for Phase-1 reading (see below).

**Bugs found and fixed this session** (all via the coverage-check +
debug-screenshot workflow, not guessing): login-detection race
condition (declared success the instant the SSO button was clicked, not
when login actually finished), mangled URLs from blindly prepending the
base URL to already-absolute hrefs, a `tsx`/Playwright `page.evaluate()`
incompatibility (`__name is not defined` — tsx transpiles with
esbuild's keepNames, which breaks when a function's source is
serialized and run standalone in the browser), a crash on
force-download resources (Playwright surfaces the download as a `goto()`
error, not an event), filenames keeping their `?forcedownload=1` query
string (Windows rejects `?` in filenames), the collapsed-accordion-
sections + inline-folder-files gap described above, a heading-detection
bug where a file's own name matched the heading regex and got read as
its own section label, and the duplicate-course-row bug from Moodle's
invisible title characters.

## Real content currently in the app

**Dummy/seed data has been fully removed** (was there just to prove the
UI worked before real scraping existed — removed once real data
arrived). The app now contains ONLY real scraped-and-processed content:

**Course: Statistics (Section: A & B)**, Term 1, 6 topics, all HIGH
confidence, all Phase-1 processed (real lecture decks read and turned
into takeaways/sections, not just assignment-derived):
1. Random Variables & Probability Distributions
2. Sampling Distributions & the Central Limit Theorem
3. Confidence Intervals
4. Hypothesis Testing
5. Regression & Causal Inference
6. Randomized Trials & Causal Inference

Real assignment Q&A wired in throughout (own answers + actual grades +
faculty marker feedback from the grades report). 32 source files total;
12 Practice Set files (with solutions) and a few reference files
(Z-table, t-table, Customer ratings, Game descriptions) are downloaded
and queued but **not yet Phase-1 processed** — deliberately deferred,
not forgotten.

## How to scrape a course (the loop that works)

1. Tell the user which course ID + term to run:
   `npm run elearn:scrape -- <id> --term "Term N"` — **must be run by
   the user**, in their Claude Code terminal panel (not a standalone
   PowerShell window, so `mcp__terminal__read_terminal` can see it).
2. Wait, then call `mcp__terminal__read_terminal` (with
   `wait_for_output_ms`) yourself — don't make the user say "done" for
   every single course.
3. Check the coverage-check output at the end. If anything shows as
   missed, read `_course-page-snapshot.png` from that course's `files/`
   folder directly (works — this file IS shared) to see why, fix the
   scraper, ship it, ask for a re-run.
4. Once clean, do Phase-1 processing (below) whenever it's time.

## How to do Phase-1 processing (the pattern that works)

1. `npx tsx scripts/tools/extract-text.ts <path>` per file to read
   content (PDF/DOCX/XLSX).
2. Write a one-off TypeScript build script at the project root (e.g.
   `phase1-<course>-tmp.ts`) that connects via
   `PrismaBetterSqlite3`/`PrismaClient` directly (see
   `prisma/seed.ts` for the exact pattern), creates/updates
   Topic/KnowledgeSection/AssignmentQuestion/AssignmentAnswer rows, sets
   `status: "PROCESSED"` on the SourceFiles used.
3. Organize topics by **concept**, not by session/assignment number —
   this is the whole point of the app (concepts cross-cut sessions and
   assignments; that's what "detailed knowledge base" and "quick doubt"
   search are for).
4. `npx tsc --noEmit` to typecheck, then run it, then **delete the
   one-off script** (`rm phase1-*-tmp.ts`) — it's not reusable, don't
   let it accumulate in the repo root.
5. Verify in the actual app (navigate + `get_page_text`, or a headless
   Playwright screenshot sent via `SendUserFile` — the live browser
   pane's own screenshot tool doesn't work in this environment,
   "Browser pane is not displayed" — headless via a temp script does).

## Course ID reference (Hyderabad Campus only, from `elearn:list`)

Confirmed via the "Custom Course Menu" tree on `/my/`. **Term 6 and
everything after it (Block Weeks, PiVOT Week, iDeas Week) is currently
ongoing — do not scrape yet, per explicit user instruction.** Everything
else is fair game.

| ID | Course | Term | Status |
|---|---|---|---|
| 10563 | Summer Internship | Summer Internship | not scraped |
| 9916 | Statistics (Section: A & B) | Term 1 | **done, Phase-1 processed** |
| 9915 | Fundamentals of Economics | Term 1 | not scraped |
| 9914 | Financial Accounting for Managers | Term 1 | not scraped |
| 9913 | Effective Verbal Communication – Part A | Term 1 | not scraped |
| 9912 | Data Science – Part A | Term 1 | not scraped |
| 9911 | Critical Thinking | Term 1 | not scraped |
| 10021 | Effective Written Analysis and Communication – Part A | Term 2 | not scraped |
| 10020 | Marketing Management and Analytics | Term 2 | not scraped |
| 10019 | Effective Verbal Communication – Part B | Term 2 | not scraped |
| 10018 | Data Science – Part B | Term 2 | not scraped |
| 10017 | Corporate Finance | Term 2 | not scraped |
| 10156 | Operations Management | Term 3 | not scraped |
| 10155 | Frontier Technologies | Term 3 | not scraped |
| 10154 | Competitive Strategy | Term 3 | not scraped |
| 10153 | Behavioral Foundations of Work and Management | Term 3 | not scraped |
| 10256 | Effective Written Analysis and Communication – Part B | Term 4 | not scraped |
| 10255 | Sustainability and Ethics | Term 4 | not scraped |
| 10254 | Marketing Decision Making | Term 4 | not scraped |
| 10253 | Investment and Portfolio Management | Term 4 | not scraped |
| 10574 | Managing Global Businesses | Term 5 | not scraped |
| 10573 | International Marketing | Term 5 | not scraped |
| 10572 | International Finance | Term 5 | not scraped |
| 10571 | Geopolitics and Business | Term 5 | not scraped |
| ~~10843~~ | ~~Scaling and Innovating in Growth Ventures~~ | Term 6 | **skip — ongoing** |
| ~~10842~~ | ~~Advanced Corporate Finance~~ | Term 6 | **skip — ongoing** |
| ~~10839~~ | ~~Software Product Management~~ | Term 6 | **skip — ongoing** |
| ~~10835~~ | ~~Financial Services for the Next Billion~~ | Term 6 | **skip — ongoing** |
| ~~10832~~ | ~~EQ in Action~~ | Term 6 | **skip — ongoing** |
| ~~10353~~ | ~~Building AI-First Business Organizations~~ | Block Week 1.1 | **skip — after Term 6** |
| ~~10356~~ | ~~Game Theory~~ | Block Week 1.2 | **skip — after Term 6** |
| ~~10807~~ | ~~Pivot~~ | PiVOT Week | **skip — after Term 6** |
| ~~10363~~ | ~~iDEAS~~ | iDeas Week | **skip — after Term 6** |

Re-confirm this list with a fresh `npm run elearn:list` if it's been a
while — course availability/IDs could change term to term.

## Open items (need the user, not just more building)

- **Backup routine** — still not built. Destination is provisional (ISB
  OneDrive, must move before graduation — see PROJECT_SPEC.md).
- **Gemini API key** — not set up (needs the user's own account).
- **Turnitin-plugin courses** — detection code added
  (`turnitintooltwo`/`turnitintool`), completely untested — no course
  scraped so far has actually used it.
- **12 Practice Set files + reference materials** for the Statistics
  course — downloaded, not yet Phase-1 processed.
- **`.jmp` file format** — currently unsupported (downloads fine, no DB
  row). Several scraped courses will have these (JMP is the stats
  software used throughout). Ask the user if it's worth adding, or just
  leave them as disk-only reference material.
