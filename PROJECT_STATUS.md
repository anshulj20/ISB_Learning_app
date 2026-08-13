# ISB Learning Inventory — Build Status (session handoff)

Written so a fresh session (or you, next time you sit down) has full
context without re-deriving it. Read `PROJECT_SPEC.md` first for the
product spec/architecture decisions — this file covers what's actually
been built, what's still a stub, and what to do next. Companion design
files: `DESIGN_BRIEF.md`, `ISB Learning Inventory updated (offline).html`
(current design pass — the "iteration 1" file in this folder is
superseded, don't use it).

## Where things live

- **Local repo**: `C:\Users\DELL\Downloads\isb-learning-inventory` —
  standalone folder, not under the ISB OneDrive, not nested in
  `Coding try`. See PROJECT_SPEC.md § "Where things live" for why.
- **GitHub**: https://github.com/anshulj20/ISB_Learning_app (private,
  branch `main`) — code backup only. `files/` and the SQLite DB are
  gitignored on purpose (personal material, and large binaries don't
  belong in git) — see PROJECT_SPEC.md § Storage & backup strategy for
  where those actually get backed up (**still not set up** — see Open
  items below).
- **Dev server**: `npm run dev`, port **3010** (`.claude/launch.json`
  config name `isb-learning-inventory` — note that file currently lives
  under the *old* ISB OneDrive project folder from before the move,
  since that's where this session's shell cwd was stuck; it `cd`s into
  the real repo before running, so it works, but it's a slightly odd
  location for it — fine to leave, or move `.claude/` into the real repo
  root and reconfigure if that bugs you).
- **Database**: SQLite, `prisma/dev.db`, via `@prisma/adapter-better-sqlite3`.

## What's actually built (this session)

Full Next.js 16 / React 19 / Prisma 7 / Tailwind v4 app, matching
Saathi's stack conventions but local-first (SQLite, no NextAuth/pg — see
PROJECT_SPEC.md for why). Visual design pulled from the mockup's actual
CSS tokens (Cormorant Garamond + Lora, warm paper palette, no
traffic-light confidence colors — see `src/app/globals.css`).

**Data model** (`prisma/schema.prisma`) covers the full spec: Term →
Course → Topic, KnowledgeSection (Focus-mode-ready), UserNote (kept
structurally distinct from generated content), SourceFile +
TopicSourceFile, HandwritingPage + TranscriptBlock (block-level
provenance, `hasUnread` flag), AssignmentQuestion/Answer (own vs.
faculty), Concept + ConceptLink (the graph's data model — UI not built
yet), TopicVisit, SuggestedReading, QuotaUsage.

**Screens built for real** (user's explicit "depth over breadth" call):
- **Home** (`/`) — search bar, resume list, interest areas (computed
  live from Concept + TopicVisit, not hardcoded), recently added,
  processing/quota card, library stats. All real queries, no mock data
  in the components themselves.
- **Library** (`/library`) — three-pane term/course/topic browser,
  confidence distribution bars, saved-view counts (thin/handwritten/
  shortlist — counts are real, the views themselves aren't clickable
  filters yet beyond thin/handwritten which route through `?filter=`).
- **Topic view** (`/topics/[topicId]`) — takeaway, knowledge-base
  sections with per-section verified/unverified state and user notes,
  **working quick-doubt search**, also-taught-in (via Concept), raw
  material list, further reading. Visiting a topic records a
  `TopicVisit` + bumps `lastOpenedAt`/`openCount` live (this is what
  feeds Home's Resume list).
- **Add** (`/add`) — **real file upload**: drops files into
  `files/inbox/`, creates real `SourceFile` rows (QUEUED or
  WAITING_FOR_QUOTA depending on today's quota), real queue table. Does
  **not** run any AI processing on upload — see Known gaps below.

**Stub pages** (so nav doesn't 404, no real functionality): `/graph`,
`/search` (search is semi-real, see below), `/files/[fileId]` (shows
metadata, no actual viewer).

**Seed data**: `prisma/seed.ts` — synthetic placeholder content mirroring
the mockup's own examples (hypothesis testing, cost of capital, etc.),
27 topics across 13 courses. **Not real ISB material** — per your
instruction, the "ISB Courses"/"Class case studies" OneDrive folders
were deliberately not touched tonight. Re-run with `npm run seed`
any time (it wipes and reseeds).

## Known gaps / simplifications (be honest with yourself about these)

1. **No AI processing pipeline yet.** Files uploaded via `/add` are
   stored and queued, but nothing transcribes/summarizes/files them into
   a topic. That's the actual Phase-1/Phase-2 ingestion pipeline from
   PROJECT_SPEC.md — a substantial next piece of work, not done tonight.
2. **"Quick doubt" and `/search` use keyword overlap, not real semantic
   search.** `src/lib/naive-search.ts` is a deliberately honest stand-in
   — good enough to be real and clickable, not good enough to trust as
   true "near matches" yet. Needs the `sqlite-vec` embeddings pipeline
   (package is installed, not wired up).
3. **Graph, Focus reading mode, Raw material viewer (real
   PDF/PPTX/image viewer), Handwriting transcript view, Pocket read,
   thin-topic "fill it in" box, and first-run onboarding are all
   unbuilt** — screens 5, 7, 9–13 from the design. The data model
   supports all of them; the UI doesn't exist yet.
4. **Upload isn't end-to-end live-tested** — the server action
   (`src/app/add/actions.ts`) reads clean and the page renders
   correctly, but I didn't drive an actual file through the browser
   tonight (file-input automation wasn't available in this session).
   Worth trying for real before trusting it.
5. **Quota date-key mismatch**: `prisma/seed.ts` wrote its demo quota
   row under a UTC-derived date string; `src/lib/quota.ts` reads/writes
   using local-date. They can disagree on the day boundary — harmless
   (worst case, quota shows 0/20 instead of a seeded 14/20 on first
   load), but worth aligning if you touch quota code.
6. **Backup routine isn't built.** PROJECT_SPEC.md commits to a daily
   SQLite-backup-API snapshot + `files/` copy to a personal (non-ISB)
   location — currently the destination folder that exists is
   `...OneDrive - Indian School of Business\Desktop\isb learning
   inventory app backup`, which is explicitly provisional (see spec).
   No script actually writes to it yet.

## Open items (need you, not just more building)

- **eLearn scraper** — not started. Needs you present to run it with
  your own credentials (per the hard rule in PROJECT_SPEC.md — I don't
  handle your ISB login). Platform confirmed as Moodle at
  `elearn.isb.edu`.
- **"ISB Courses" / "Class case studies" folders** — deliberately not
  opened tonight per your instruction; revisit once eLearn scraping is
  underway, to see if they shortcut anything.
- **Gemini API key** — not set up (can't be, needs an account only you
  can create). `.env` currently only has `DATABASE_URL`; add
  `GEMINI_API_KEY` there whenever you're ready to wire up Phase 2.
- **Backup destination** — provisional, on ISB OneDrive, must move
  before graduation (flagged repeatedly in PROJECT_SPEC.md so it doesn't
  quietly become permanent).

## Suggested next session

Probably in this order: (1) live-test the upload flow for real, fix
anything broken, (2) build the ingestion pipeline for at least Phase 1
(Claude-assisted — i.e. me, reading files you upload and writing
takeaways/sections/confidence directly, no API needed), since that's
what turns this from a shell into your actual archive, (3) only then
worry about Gemini/Phase 2 and the remaining screens.
