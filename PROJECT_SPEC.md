# ISB Learning Inventory — Project Spec

Working spec, written to give a fresh Claude Code session full context
without re-deriving it. Living document — update as decisions change.
Companion file: `DESIGN_BRIEF.md` (hand that one to a design-focused
Claude session to get visual mockups; it deliberately omits backend detail).

## Where things live

- **Local repo**: `C:\Users\DELL\Downloads\isb-learning-inventory` — a
  standalone folder, deliberately **not** under the ISB OneDrive
  (`OneDrive - Indian School of Business`, likely revoked after
  graduation) and **not** nested inside the unrelated `Coding try`
  folder either. The project started under the ISB OneDrive and was
  moved here on 2026-08-13 for exactly that reason — don't move it back.
- The live SQLite DB and `files/` folder (once built) belong in this same
  local, non-cloud-synced tree — see Storage & backup strategy below for
  where *backups* of them should go instead (a personal, non-ISB cloud
  account or external drive — still to be set up).

## What this is

A private, permanent knowledge base of everything the user has learned at
ISB — slides, personal notes, assignment objectives, assignment solutions
(both their own and faculty's), and coursepacks — built to remain fully
usable after graduation with zero dependency on ISB's own systems (eLearn,
ISB email/OneDrive, etc.).

Single user, private, personal-use archive. Not a sharing or redistribution
tool. Built to run **entirely locally** (not hosted), so file storage is
bounded only by the user's own disk, not a cloud free tier.

## Core mental model

`Term → Course → Topic`, and within each topic, three layers of depth:

1. **Takeaway** — short, high-signal summary of the topic's key ideas
2. **Detailed knowledge base** — fuller synthesis, with examples and cases,
   citing back to the exact source slide/page it came from
3. **Raw material** — one click through to the original file, viewable
   as-is (slide deck, PDF, scanned notes)

This three-layer structure is the spine of the whole app — every feature
below hangs off it.

## Design

Two visual-design passes exist in this folder, both offline/self-contained
HTML mockups (open in a browser, no build step):
- `ISB Learning Inventory (offline).html` — first pass, 8 screens.
- `ISB Learning Inventory updated (offline).html` — **current, supersedes
  the first pass**, 13 screens. Adds the "harder states" the first pass
  skipped: thin topics, focused reading, handwriting transcription, a
  mobile/offline mode, and first-run onboarding.

The 13 screens, in the order the mockup presents them:
1. **Home** — search-first, resume-in-progress topics, interest areas,
   recently added, processing-queue status.
2. **Term/Course browser (Library)** — three standing panes (term →
   course → topic list), saved views (e.g. "Thin topics", "Handwritten
   only", "Interview shortlist").
3. **Topic view** — takeaway → detailed knowledge base → raw material,
   plus inline quick-doubt search, cross-course "also taught in" links,
   and further-reading suggestions.
4. **Search results** — exact matches first, then near-matches by
   meaning, faceted by course/source/confidence.
5. **Cross-course concept graph** — explorable, only recurring topics
   get nodes; confirmed vs. AI-suggested links are visually distinct.
6. **Add material (quota-paused state)** — upload/drop zone plus a
   calm queued state when the day's free processing is used up.
7. **Raw material viewer** — original file, zoomable, page-by-page.
8. **Assignment answer comparison** — the user's submission beside the
   faculty model answer, visually distinct treatments, "what differed"
   summary.
9. **Thin topic, honestly** — a sparse topic shown without alarm: shows
   exactly what exists (e.g. "1 slide heading"), an inline box to type
   in what the user remembers (kept visually distinct as "yours," not
   generated), a "mark as intentionally brief" option, and links to
   where the same ground is better covered elsewhere.
10. **Focus reading mode** — rail removed, single column, section
    navigation down the left, reading-progress tracking ("38% read, 9
    min left"), fully keyboard-driven (J/K between sections, F to leave,
    ⌘K for quick doubt).
11. **Handwriting page + transcript, side by side** — each transcribed
    block shows exactly which part of the topic it feeds (e.g. "Feeds:
    Worked example"), illegible words are marked `[unread]` explicitly
    rather than guessed, and any word can be corrected by hand.
12. **Pocket read** — a deliberately minimal, read-only, offline-capable
    view (takeaway + the user's own notes + confidence only, no graph,
    no browsing) for e.g. the twenty minutes before an interview. See
    the open item below — this has real architecture implications.
13. **First run** — empty-state onboarding: drop the first files, with
    explicit sequencing guidance (slide decks first, since they name
    the topics everything else attaches to; note photos second; cases/
    assignments last, since they attach to topics that already exist).

### New concepts this pass introduced (now part of the spec, not just UI)

- **Verification is separate from confidence.** Confidence (High/
  Partial/Thin) is the *system's* estimate of how solid the material is.
  "Verified by you" is a distinct, manual flag the user sets after
  actually reading a section — generated text the user hasn't reviewed
  is explicitly marked "unverified" rather than presented with false
  authority.
- **User-authored content stays visually and structurally distinct from
  generated content**, always — whether it's a note added to a thin
  topic or a correction to a handwriting transcript. Never silently
  merged into the synthesized text.
- **Handwriting transcription must say what it couldn't read.**
  `[unread]` markers for illegible words, not a best-guess fill-in —
  ties directly into the confidence-scoring philosophy already in this
  spec (thin/uncertain material should look thin/uncertain, not
  polished).
- **Ingestion has a preferred order**, not just "upload anything":
  slide decks first (they establish topic names/structure), then
  handwritten notes, then cases/assignments last (these attach to
  topics that already exist rather than creating new ones). Worth
  reflecting in how the ingestion pipeline resolves "which topic does
  this belong to."

## Content sources & formats

- Slides (PPTX)
- Personal notes — **majorly handwritten**, photographed/scanned (images)
- Assignment objectives
- Assignment solutions — **both** the user's own submissions and faculty's
  model answers, kept distinguishable
- Coursepacks / cases (PDF)

## Features

### 1. Ingestion / upload
A place to upload slides, images, and PDFs at any time going forward. Each
upload triggers the processing pipeline (transcribe → extract text →
embed → summarize → confidence-score → check for cross-course links) and
updates the relevant topic(s). See **AI processing strategy** for who does
this work and when.

Handwriting transcription doesn't need a separate OCR library — both
phases read images directly via multimodal AI (Claude's vision in Phase
1, Gemini's multimodal free tier in Phase 2), which handles messy
handwriting far better than a traditional OCR engine like Tesseract
would, and avoids adding a whole separate paid-OCR-API cost risk.

New material is only re-summarized into an existing topic if it's found
relevant to that topic (embedding-similarity check against existing
content) — not on every unrelated upload.

### 2. Cross-course concept graph
An explorable, topic-wise graph, but only for topics that **recur across
courses** — not every topic gets a node. Nodes are topics; edges connect
topics that show up in more than one course (e.g. a stats concept reused
in a marketing-analytics course). Determined by semantic similarity
(embeddings), not literal keyword match, since the same term can mean
different things in different courses (e.g. "beta").

- User can manually **add** a topic/link the AI missed, or **delete**
  one it got wrong.
- Whether/how to visually link *interconnected* topics (not just
  "same topic, different course" but genuinely related concepts) is
  still open — evaluate value vs. complexity once the basic graph exists
  before investing further here.

### 3. Search
- **Course-wise / topic-wise search** — structured, returns all relevant
  material for that course/topic.
- **In-context "quick doubt" search** — while reading a topic, ask a
  short, informal query (e.g. "significance test") and get near-matches
  from anywhere in the knowledge base, not just exact keyword hits.
  Fuzzy/semantic (embeddings-based retrieval), so a stats concept
  referenced while reading a finance topic surfaces correctly. This is
  retrieval only (no generation call needed), so it stays free even on
  the local/Gemini-free-tier setup.

### 4. Confidence scoring
Every piece of content in the knowledge base shows a confidence score —
how sure the system is that the stored understanding is correct/complete.
Inputs:
- **Grades** — for the user's own assignment solutions specifically,
  pulled from the eLearn grades section, informing confidence on *that*
  material (not applied broadly to unrelated slides/notes).
- **Content clarity** — sparse material (e.g. slides that are just
  headings, no detail) scores lower than fully worked-out content.
- **Web cross-reference** — the topic's synthesized content can be
  checked against a live web search as an additional confidence signal.
  **Web content is never stored or shown as app content** — it only
  influences the score.

### 5. Dynamic interest tracking + suggested reading
Suggests external articles/further-reading links per topic, based on
inferred interest. "Interest areas" update based on which topics the user
actually clicks into more — the suggestions adapt accordingly. Only
**links** are stored, never scraped article content.

### 6. Raw material viewer
Open any original file exactly as uploaded — a slide deck, a PDF, a scan
— without going through any synthesis layer. For handwritten pages
specifically, a side-by-side page/transcript view: each transcribed
block shows which part of the topic it feeds (e.g. "Feeds: Worked
example"), illegible words are marked `[unread]` rather than guessed,
and any word can be corrected by hand.

### 7. Thin-topic handling
When material is sparse, the topic view says so plainly (what exists,
what doesn't) rather than padding it out — no alarm styling, just
honesty. The user can type a short note directly into a thin topic
(kept visually distinct as their own words, not generated text), or
mark it "intentionally brief" to stop it being flagged as incomplete.
Links to better-covered related topics are shown alongside.

### 8. Focus reading mode
A distraction-free, single-column view for a topic's full detailed
knowledge base — section navigation instead of the usual side rail,
reading-progress tracking, keyboard-driven (section-to-section, leave
focus, quick-doubt search) for long sit-down reading sessions.

### 9. Pocket read (mobile/offline)
A deliberately minimal, read-only view — takeaway, the user's own
notes, and confidence only, no graph/upload/full browsing — meant for
e.g. a quick pre-interview refresher on a phone, usable offline. **Open
architecture question**, see Open items: the rest of this spec commits
to a fully local, unhosted app specifically so file storage isn't
capped by a cloud free tier — but a phone can't reach a laptop's local
disk any more than Vercel could. Needs a deliberate sync/export
mechanism (e.g. an explicit "send to phone" export of just the opened
topics, or a same-network-only local server), not an assumption that
this falls out of the existing architecture for free.

### 10. First-run onboarding
An empty-state flow that sets ingestion order expectations up front:
slide decks first (they establish topic names/structure), then note
photos, then cases/assignments last (these attach to topics that
already exist rather than creating new ones).

## AI processing strategy — two phases

**Phase 1 — initial heavy batch (now).** The user has a large backlog
("everything since joining ISB"). A free-tier API would exhaust its quota
almost immediately at this volume. Instead: **Claude (via this Claude
Code session, i.e. Claude Pro, not the API) does this processing directly
and interactively** — reading each file, generating the summary/
confidence-score/knowledge-base entry, writing it into the local DB. This
is genuinely free (covered by the existing Pro subscription) but is real,
spread-out work across many sessions, not a single batch job.

**Phase 2 — ongoing, after the app is built and/or Claude Pro isn't
in the loop.** The deployed local app calls the **Gemini free-tier API**
autonomously for new uploads and lighter tasks (retrieving/regenerating a
summary, answering a quick-doubt query, scoring new content). When
Gemini's free quota is exhausted, processing **pauses and queues** rather
than failing — see Hard stop below.

### Hard stop: no paid API usage, period

**This is a hard requirement, not a default that can be overridden.**
There is currently no code path that makes a paid Gemini/Claude API
call — not gated behind a setting, not available as an opt-in, not a
two-step confirmation. Only free-tier calls are ever made. (A paid option
is explicitly not being built right now; if that ever changes, it's a
deliberate future decision, not something to leave a door open for today.)

- When the free quota is exhausted, any item awaiting AI processing is
  marked **queued**, not failed or dropped. The UI shows something like
  *"Free AI quota used up for now — this will process automatically once
  it resets."*
- Once the quota resets (on the provider's own cycle, e.g. daily), queued
  items **resume automatically, in the order they were queued** — no
  manual restart, no re-upload, no action needed from the user.
- This applies uniformly to all AI-dependent features: ingestion
  summarization/confidence-scoring, the quick-doubt search's generation
  step (if any), and article-suggestion refresh.

## eLearn extraction

Platform: **Moodle**, at `https://elearn.isb.edu` (confirmed via the
public login page footer — "Powered by Moodle"). Login is **not** plain
Moodle username/password — the login page offers "Log in using your
account on: Microsoft O365 Login", redirecting to
`elearn.isb.edu/auth/oidc/?source=loginpage` (OpenID Connect against
ISB's Microsoft 365 tenant). An institutional M365 tenant almost
certainly enforces MFA, which **cannot and should not be automated** —
confirmed via the public login page only, no credentials involved in
that check.

Consequently the scraper (`scripts/elearn/`) is built around a
**persistent, visible browser session**, not stored credentials:
- Uses Playwright's `launchPersistentContext` with a local profile
  directory (`.playwright-profile/`, gitignored) so a login session
  survives across separate script runs.
- Opens a **real, visible** Chromium window. If not already logged in,
  the script pauses and waits — the user completes the Microsoft
  login/MFA themselves, by hand, in that real window. The credential
  and MFA step never touch Claude or any script code.
- Once logged in, the saved session cookie persists in the profile
  directory, so subsequent runs (scraping the next course) skip
  straight past login until the session naturally expires — at which
  point the same manual-login pause happens again.

Also pulls the **grades report** per course (Moodle's
`/grade/report/user/index.php?id=<courseId>`) — feeds the
confidence-scoring input above.

**Scraped one course at a time**, per the user's explicit instruction —
no "scrape everything" bulk mode. `scripts/elearn/list-courses.ts`
prints enrolled courses with their Moodle course IDs;
`scripts/elearn/scrape-course.ts <courseId> --term "Term N"` scrapes one.

Downloaded files land in `files/elearn/<course-slug>/` and get a
`SourceFile` row each (status `QUEUED`, kind best-guessed from the
Moodle activity type — reviewed and corrected during Phase-1 processing,
not treated as final). Kind-guessing being imperfect is fine; it's the
same "ask when unsure" philosophy as the rest of ingestion.

The `ISB Courses` and `Class case studies` desktop folders are still
untouched, per the user's instruction — revisit once eLearn scraping is
underway to see if they shortcut anything.

Flagged risk: bulk-downloading a full program's coursepacks/cases this
way may sit in a gray area against ISB's platform ToS and the licensing
terms ISB has with case publishers (HBR, Ivey, etc.). Accepted by the
user for personal, non-shared use (see Copyright stance below) — not
reconsidered here, just documented.

## Tech stack & architecture

- **Framework**: Next.js App Router + Prisma — same pattern as the user's
  prior project (Saathi), for consistency.
- **Database**: **SQLite**, not Postgres — a single local file. Same
  Prisma ORM, just a different local-friendly engine. No server to
  install/run/manage, and trivially portable (see below). Chosen because
  this is single-user and fully local — Postgres/Neon's multi-user,
  hosted design doesn't buy anything here.
- **Vector search**: `sqlite-vec` extension — local, free, powers both
  the cross-course concept graph (similarity between topics) and the
  quick-doubt semantic search.
- **File storage**: a plain local folder (e.g. `files/`), not any cloud
  blob service. No storage cap other than the user's own disk.
- **Deployment**: runs **locally** (localhost), not hosted on Vercel —
  deliberate, since Vercel's servers can't reach a local disk. Trade-off
  accepted: only reachable from the machine it runs on (or a home
  network), not from a phone away from home. Revisit if that becomes a
  real pain point.

## Storage & backup strategy

- **Live data** (the SQLite DB + `files/` folder) should live in a plain,
  **not continuously cloud-synced** local folder. Live-syncing an
  actively-written SQLite file (via OneDrive, Dropbox, etc.) risks
  corruption — sync tools can capture a file mid-write, and SQLite's
  WAL-mode side files (`-wal`, `-shm`) don't play well with that.
- **Backups**: a scheduled routine takes a *consistent* snapshot using
  SQLite's backup API (safe to run while the app is using the DB — not a
  raw file copy) plus the `files/` folder, and copies it to:
  `C:\Users\DELL\OneDrive - Indian School of Business\Desktop\isb learning inventory app backup`
  (folder created 2026-08-13). Cadence: **daily**, triggered automatically
  on app startup if the last backup is >24h old.

  **This is explicitly an interim choice, not the permanent one** — it's
  the same ISB OneDrive account flagged earlier as likely to be revoked
  at graduation. The user chose it "for now" for convenience. Before
  graduation, this backup target **must** move to a personal (non-ISB)
  cloud account or external drive — tracked in Open items so it doesn't
  get forgotten.

## Portability — moving to a new laptop

Because everything's local and file-based, migration is copying three
things, no export/import step needed:
1. The code — `git clone` from a private GitHub repo (also doubles as a
   code backup).
2. The SQLite DB file.
3. The `files/` folder.
4. The `.env` (Gemini API key etc.) — kept out of git, copied separately.

Then on the new machine: install Node.js → `npm install` → run. Identical
app, identical data.

## Copyright / retention stance

Raw case/coursepack PDFs are kept **indefinitely** for personal use — the
user has explicitly accepted the mild copyright/licensing gray-area risk
here in exchange for simplicity, rather than stripping cases down to
just the user's own notes/synthesis. Documented, not up for silent
reconsideration.

## Open items

- **Backup destination is provisional** — currently the ISB OneDrive
  (see Storage & backup strategy), chosen for convenience "for now."
  **Must migrate to a personal (non-ISB) location before graduation** —
  don't let this quietly become permanent by default.
- Cross-course *interconnection* visualization (beyond "same topic in
  two courses") — worth building or not? Revisit after the basic graph
  is in use.
- Free-tier API limits (Gemini, any web-search API used) should be
  reconfirmed at build time — these change and were only checked/
  estimated as of August 2026.

## Use cases

- **Interview prep** — pulling together a fast, accurate refresher on a
  topic across everything it touched.
- **General refresher** — "what did I actually learn about X" long after
  the course ended and ISB access is gone.
