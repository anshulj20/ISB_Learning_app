# Design brief — ISB Learning Inventory

This is a brief for designing the **look and feel** of a personal app —
no backend/technical detail included on purpose. Read this and produce a
visual design (mockups, key screens, a UI direction) for the app
described below.

## What the app is

A private, personal knowledge base for everything one person learned
during their MBA-equivalent program at ISB (Indian School of Business) —
slides, their own handwritten notes, assignment questions and solutions,
and course case-study material. Built so they can keep using it for years
after graduating, once they no longer have access to the school's own
systems. It's for one person only — not a shared or multi-user product.

Think of it less like a course-management LMS and more like a personal,
permanent **study library** — calm, dense with real content, but easy to
navigate without feeling like a spreadsheet.

## The core structure to design around

Everything is organized **Term → Course → Topic**. The heart of the app
is the **Topic view**, which always has three layers, in this order,
top to bottom:

1. **Takeaway** — a short, punchy summary. What matters most, at a
   glance. This should be the first thing visible, no scrolling.
2. **Detailed knowledge base** — the fuller explanation: concepts,
   worked examples, real cases, written to actually teach the topic
   back to the user years later. Includes a visible **confidence
   indicator** (how sure the system is that this content is accurate/
   complete — some material is thin, e.g. a slide that's just a bullet
   heading, and should visibly look "thinner" or flagged as lower
   confidence vs. a fully fleshed-out topic).
3. **Raw material** — links out to the original files (a slide deck, a
   PDF, a scanned page of handwritten notes), openable exactly as they
   were, one click away from the summary above.

## Screens to design

- **Home / dashboard** — quick search bar front and center, recent/
  resumed topics, maybe a glance at "interest areas" (topics the user
  keeps returning to).
- **Term / Course browser** — a clean list/hierarchy view down to
  individual topics.
- **Topic view** — the main screen, structured per the three layers
  above. Also include, inline on this screen:
  - A **"quick doubt" search box** — the user can type a short, informal
    question or term while reading (e.g. "significance test") and get
    near-matches from anywhere else in the knowledge base, even if the
    exact words don't match. Should feel like a lightweight, inline
    lookup, not a separate full-page search.
  - **Related topics from other courses** — small, unobtrusive links
    when this topic connects to something taught elsewhere (e.g. a
    stats concept that resurfaces in a marketing analytics course).
  - **Suggested further reading** — a small panel of external article
    links, clearly marked as external, that adapts over time based on
    what the user reads most.
- **Cross-course concept graph** — an explorable, visual node graph.
  Nodes are topics; a topic only appears connected to another if it
  genuinely recurs across more than one course (this is not a graph of
  *every* topic — most topics won't have connections, and that's fine).
  Clicking a node goes to that Topic view. Needs a way to add a topic/
  connection the system missed, and to remove one that's wrong — should
  feel low-friction, not like an admin form.
- **Upload / ingestion screen** — drag-and-drop for slides, images
  (including photos of handwritten notes), and PDFs. Shows processing
  status per file, including a **queued** state: when the free AI quota
  for the day is used up, in-progress items pause with something like
  *"Free AI processing is used up for now — queued, will resume
  automatically once it resets."* — informative and calm, not an
  error-red panic state, and not asking the user to do anything (no
  "upgrade" or "pay to continue" prompt exists anywhere in this app —
  there is no paid tier to offer).
- **Raw material viewer** — opens an original file (PDF/slide/image) in
  place, full-screen or near-full-screen, easy to get back from.
- **Search results** — course-wise/topic-wise results, with the "near
  match, not exact match" quality mentioned above (e.g. searching one
  term surfaces conceptually related material too, not just literal
  string matches).

## Content realities to design for

- A lot of the material will be **photographed handwritten notes** —
  design should treat these as first-class content (a legible image
  viewer, maybe light annotation/zoom), not an afterthought next to
  "real" typed slides.
- Some topics will be thin (low confidence) and some rich (high
  confidence) — the design should make that difference visible at a
  glance without shaming the thin ones; it's a study aid, not a grading
  tool.
- Two kinds of assignment solutions exist side by side — the user's own
  submitted answer and the faculty's model answer. These should be
  visually distinguishable wherever both appear.

## Tone / visual direction

Personal, calm, built for long focused reading sessions — this is a
study tool the user may return to for years, often under time pressure
(e.g. prepping for an interview). Favor clear information hierarchy and
generous reading comfort over anything flashy. Avoid corporate-SaaS-
dashboard energy; this isn't a team tool, it's one person's library.

## Explicitly out of scope for this design pass

- Multi-user, sharing, or collaboration UI (single-user only — though
  don't design in a way that would make adding accounts later
  impossible).
- Any payment/checkout flow — the only money-related UI is the rare,
  two-step "this will use paid AI credits, are you sure" confirmation
  mentioned above.
