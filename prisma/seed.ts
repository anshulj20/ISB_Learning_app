// Seed data — SYNTHETIC PLACEHOLDER CONTENT ONLY.
// Mirrors the structure/examples from the design mockups (hypothesis
// testing, cost of capital, etc.) so the UI has something real to render
// against. None of this is the user's actual ISB material — that arrives
// later via Claude-assisted ingestion (Phase 1) and the eLearn scraper,
// per PROJECT_SPEC.md. Safe to wipe and re-run at any point before real
// ingestion starts.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing existing data...");
  // Order matters — children before parents.
  await db.transcriptBlock.deleteMany();
  await db.handwritingPage.deleteMany();
  await db.userNote.deleteMany();
  await db.suggestedReading.deleteMany();
  await db.topicVisit.deleteMany();
  await db.topicSourceFile.deleteMany();
  await db.assignmentAnswer.deleteMany();
  await db.assignmentQuestion.deleteMany();
  await db.knowledgeSection.deleteMany();
  await db.sourceFile.deleteMany();
  await db.conceptLink.deleteMany();
  await db.topic.deleteMany();
  await db.concept.deleteMany();
  await db.course.deleteMany();
  await db.term.deleteMany();
  await db.quotaUsage.deleteMany();

  console.log("Seeding terms...");
  const termNames = ["Term 1", "Term 2", "Term 3", "Term 4", "Term 5", "Electives"];
  const terms = await Promise.all(
    termNames.map((name, i) => db.term.create({ data: { name, order: i } }))
  );
  const [term1, term2] = terms;

  // ---- Concepts (cross-course recurring ideas) --------------------------
  const conceptRegression = await db.concept.create({
    data: { name: "Regression & model fit", createdBy: "AI" },
  });
  const conceptHypothesisTesting = await db.concept.create({
    data: { name: "Hypothesis testing", createdBy: "AI" },
  });
  await db.conceptLink.create({
    data: {
      conceptAId: conceptRegression.id,
      conceptBId: conceptHypothesisTesting.id,
      status: "CONFIRMED",
      createdBy: "AI",
    },
  });

  // ---- Term 1 courses -----------------------------------------------------
  const statAnalysis = await db.course.create({
    data: { termId: term1.id, name: "Statistical Analysis", order: 0 },
  });
  const filler1 = await Promise.all(
    [
      "Financial Accounting",
      "Microeconomics",
      "Marketing Management",
      "Organizational Behavior",
      "Leadership Communication",
    ].map((name, i) =>
      db.course.create({ data: { termId: term1.id, name, order: i + 1 } })
    )
  );
  for (const c of filler1) {
    await db.topic.create({
      data: {
        courseId: c.id,
        name: "Course introduction & key frameworks",
        order: 0,
        confidence: "THIN",
        takeaway: "Not yet processed in depth — filed from the slide deck title only.",
      },
    });
  }

  // ---- Term 2 courses -----------------------------------------------------
  const corpFinance = await db.course.create({
    data: { termId: term2.id, name: "Corporate Finance", order: 0 },
  });
  const opsManagement = await db.course.create({
    data: { termId: term2.id, name: "Operations Management", order: 1 },
  });
  const mktAnalytics = await db.course.create({
    data: { termId: term2.id, name: "Marketing Analytics", order: 2 },
  });
  const filler2 = await Promise.all(
    [
      "Competitive Strategy",
      "Managerial Accounting",
      "Data-Driven Decisions",
      "Business Ethics",
    ].map((name, i) =>
      db.course.create({ data: { termId: term2.id, name, order: i + 3 } })
    )
  );
  for (const c of filler2) {
    await db.topic.create({
      data: {
        courseId: c.id,
        name: "Course introduction & key frameworks",
        order: 0,
        confidence: "THIN",
        takeaway: "Not yet processed in depth — filed from the slide deck title only.",
      },
    });
  }

  // ======================================================================
  // FLAGSHIP TOPIC: Hypothesis testing & p-values (Statistical Analysis)
  // ======================================================================
  const hypSlides = await db.sourceFile.create({
    data: {
      originalFileName: "Session 6 — Hypothesis Testing.pptx",
      storedPath: "files/statistical-analysis/session-6-hypothesis-testing.pptx",
      kind: "SLIDES",
      format: "PPTX",
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });
  const hypCase = await db.sourceFile.create({
    data: {
      originalFileName: "Case — Blue River Retail.pdf",
      storedPath: "files/statistical-analysis/case-blue-river-retail.pdf",
      kind: "CASE",
      format: "PDF",
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });
  const hypNotes = await db.sourceFile.create({
    data: {
      originalFileName: "Notes — 12 Sep, pages 1–3.jpg",
      storedPath: "files/statistical-analysis/notes-12-sep",
      kind: "NOTES",
      format: "JPG",
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });

  const hypTopic = await db.topic.create({
    data: {
      courseId: statAnalysis.id,
      conceptId: conceptHypothesisTesting.id,
      name: "Hypothesis Testing & p-values",
      order: 0,
      confidence: "HIGH",
      takeaway:
        "A test asks one question: if nothing were going on, how surprising is this data? The p-value answers that and nothing more — not the chance the hypothesis is true, not the size of the effect. State the null before you look at the data. Small p, large sample, trivial effect — all three can be true at once. Report the interval next to the verdict.",
      verifiedByUser: true,
      verifiedAt: new Date("2026-08-04"),
      lastOpenedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      openCount: 9,
    },
  });

  const sectionDefs = [
    {
      heading: "What a p-value is",
      body: "A test starts with a null hypothesis — the dull explanation, that the difference you are looking at is noise. You then compute how far the observed statistic sits from what the null would produce, in units of its own variability. That distance is the test statistic; the p-value is the share of null worlds that would produce a distance at least this large. It is a statement about data under an assumption, not about the assumption itself.",
      verified: true,
    },
    {
      heading: "Assumptions",
      body: "Independence of observations, a sampling distribution that's at least approximately known (or large enough n for the CLT to carry it), and a null hypothesis stated before the data is seen — not fit to it afterward.",
      verified: false,
    },
    {
      heading: "Worked example",
      body: "Two-sample t-test on average basket size, control vs. new layout. n per arm: 1,120. Difference in means: ₹34.20. t = 2.41. p = 0.016. 95% interval: ₹6.4 – ₹62.0.",
      verified: true,
    },
    {
      heading: "Where it showed up",
      body: "Blue River Retail, Session 6 case. The team read p = 0.049 as a green light and shipped a layout that moved revenue by less than the interval's lower bound.",
      verified: false,
    },
    {
      heading: "Pitfalls",
      body: "Two failure modes matter in practice. Reading a small p-value as proof of importance ignores the sample size: with 40,000 observations a half-percent lift clears any threshold. Reading a large p-value as proof of no effect ignores power: an underpowered test is silent, not exculpatory. Choose the threshold first, and keep the interval next to the verdict.",
      verified: true,
    },
  ];
  const sections: Record<string, string> = {};
  for (let i = 0; i < sectionDefs.length; i++) {
    const s = sectionDefs[i];
    const created = await db.knowledgeSection.create({
      data: {
        topicId: hypTopic.id,
        heading: s.heading,
        body: s.body,
        order: i,
        verifiedByUser: s.verified,
        verifiedAt: s.verified ? new Date("2026-08-04") : null,
      },
    });
    sections[s.heading] = created.id;
  }

  await db.userNote.create({
    data: {
      sectionId: sections["What a p-value is"],
      text: "The interview answer that landed: say what would have to be true for the null to hold, then say why the data makes that uncomfortable. Never lead with the number.",
      createdAt: new Date("2026-08-04"),
    },
  });

  await db.topicSourceFile.createMany({
    data: [
      { topicId: hypTopic.id, sourceFileId: hypSlides.id, citation: "slide 11" },
      { topicId: hypTopic.id, sourceFileId: hypCase.id, citation: undefined },
      { topicId: hypTopic.id, sourceFileId: hypNotes.id, citation: "page 3" },
    ],
  });

  // Handwritten pages for hypNotes (3 pages, page 3 has the cited content)
  for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
    const page = await db.handwritingPage.create({
      data: {
        sourceFileId: hypNotes.id,
        pageNumber,
        imagePath: `files/statistical-analysis/notes-12-sep/page-${pageNumber}.jpg`,
        transcriptText:
          pageNumber === 3
            ? "Null = no difference. Alternative = there is one. Choose α first, 0.05 by convention, not by law. | t = (x̄₁ − x̄₂) / SE. Basket size example: SE [unread] → t = 2.41, p = 0.016. Interval 6.4 to 62.0. | Prof: \"a p-value is not the probability the null is true.\" Underline twice. Asked in the quiz last year [unread]. | Blue River case — team shipped on p = 0.049. Revenue move smaller than the interval's floor."
            : null,
      },
    });
    if (pageNumber === 3) {
      const blocks: { text: string; hasUnread: boolean; feeds: string | null }[] = [
        {
          text: "Null = no difference. Alternative = there is one. Choose α first, 0.05 by convention, not by law.",
          hasUnread: false,
          feeds: sections["What a p-value is"],
        },
        {
          text: "t = (x̄₁ − x̄₂) / SE. Basket size example: SE [unread] → t = 2.41, p = 0.016. Interval 6.4 to 62.0 — the lift could be tiny.",
          hasUnread: true,
          feeds: sections["Worked example"],
        },
        {
          text: 'Prof: "a p-value is not the probability the null is true." Underline twice. Asked in the quiz last year [unread].',
          hasUnread: true,
          feeds: sections["Pitfalls"],
        },
        {
          text: "Blue River case — team shipped on p = 0.049. Revenue move smaller than the interval's floor.",
          hasUnread: false,
          feeds: sections["Where it showed up"],
        },
      ];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        await db.transcriptBlock.create({
          data: {
            pageId: page.id,
            text: b.text,
            hasUnread: b.hasUnread,
            order: i,
            feedsSectionId: b.feeds,
          },
        });
      }
    }
  }

  await db.suggestedReading.createMany({
    data: [
      {
        topicId: hypTopic.id,
        title: "The ASA statement on p-values",
        url: "https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf",
        sourceDomain: "amstat.org",
      },
      {
        topicId: hypTopic.id,
        title: "Why most A/B tests are underpowered",
        url: "https://hbr.org/2017/06/how-to-standardize-ab-testing",
        sourceDomain: "hbr.org",
      },
      {
        topicId: hypTopic.id,
        title: "Confidence intervals, plainly",
        url: "https://www.nature.com/articles/nmeth.3288",
        sourceDomain: "nature.com",
      },
    ],
  });

  // A couple more Statistical Analysis topics for realistic list density
  await db.topic.create({
    data: {
      courseId: statAnalysis.id,
      name: "Chi-square for categorical data",
      order: 1,
      confidence: "PARTIAL",
      takeaway:
        "A significance test for counts rather than means — expected cell frequencies, degrees of freedom (r−1)(c−1).",
    },
  });
  await db.topic.create({
    data: {
      courseId: statAnalysis.id,
      conceptId: conceptRegression.id,
      name: "Regression basics",
      order: 2,
      confidence: "HIGH",
      takeaway: "OLS as the line minimizing squared error; R², coefficients, and what a residual plot is actually checking for.",
    },
  });
  await db.topic.create({
    data: {
      courseId: statAnalysis.id,
      name: "Sampling & survey error",
      order: 3,
      confidence: "THIN",
      takeaway: "Margin of error and what a 95% claim covers.",
    },
  });

  // ======================================================================
  // Corporate Finance: Cost of Capital + Assignment 2 Q3 comparison
  // ======================================================================
  const cocTopic = await db.topic.create({
    data: {
      courseId: corpFinance.id,
      name: "Cost of Capital",
      order: 0,
      confidence: "PARTIAL",
      takeaway:
        "WACC, levered beta, and where the textbook and the case disagree — in particular, always re-lever beta to the capital structure you're pricing, not the one on today's balance sheet.",
      lastOpenedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      openCount: 5,
    },
  });
  const ownAnswerFile = await db.sourceFile.create({
    data: {
      originalFileName: "Assignment 2 — my answer.pdf",
      storedPath: "files/corporate-finance/assignment-2-my-answer.pdf",
      kind: "ASSIGNMENT",
      format: "PDF",
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });
  const facultyAnswerFile = await db.sourceFile.create({
    data: {
      originalFileName: "Assignment 2 — model answer.pdf",
      storedPath: "files/corporate-finance/assignment-2-model-answer.pdf",
      kind: "ASSIGNMENT",
      format: "PDF",
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });
  const q3 = await db.assignmentQuestion.create({
    data: {
      courseId: corpFinance.id,
      topicId: cocTopic.id,
      number: 3,
      text: "Estimate the weighted average cost of capital for Meridian Logistics using the 2024 balance sheet, and state which single assumption your answer is most sensitive to.",
    },
  });
  await db.assignmentAnswer.create({
    data: {
      questionId: q3.id,
      author: "OWN",
      text:
        "I took the book value of debt at ₹4,200 crore and equity at market capitalisation of ₹9,800 crore, giving weights of 0.30 and 0.70. Cost of debt after tax came to 6.4% at a 25% rate; cost of equity 12.1% from CAPM with a beta of 1.15 and a 6% market premium. WACC therefore works out to 10.4%. I flagged the equity risk premium as the most sensitive assumption, since a one-point change moves WACC by roughly 0.8 points.",
      grade: 8.5,
      gradeMax: 10,
      markerNote: "Correct method, but beta should have been re-levered to the target capital structure.",
      submittedAt: new Date("2026-10-14"),
      sourceFileId: ownAnswerFile.id,
    },
  });
  await db.assignmentAnswer.create({
    data: {
      questionId: q3.id,
      author: "FACULTY",
      text:
        "Weights are taken at market value throughout: debt ₹4,050 crore at fair value, equity ₹9,800 crore, so 0.29 / 0.71. Beta is unlevered to 0.86 and re-levered at the target 30% debt ratio, giving 1.09 and a cost of equity of 11.5%. WACC is 9.9%. The dominant sensitivity is the debt ratio itself, not the premium. Teaching point: always re-lever beta to the structure you are pricing, not the one on today's balance sheet.",
      submittedAt: new Date("2026-10-20"),
      sourceFileId: facultyAnswerFile.id,
    },
  });
  await db.topicSourceFile.createMany({
    data: [
      { topicId: cocTopic.id, sourceFileId: ownAnswerFile.id },
      { topicId: cocTopic.id, sourceFileId: facultyAnswerFile.id },
    ],
  });

  // ======================================================================
  // Operations Management: Little's Law (thin, honest empty state)
  // ======================================================================
  const opsSlides = await db.sourceFile.create({
    data: {
      originalFileName: "Session 9 — Queueing & Flow.pptx",
      storedPath: "files/operations-management/session-9-queueing-flow.pptx",
      kind: "SLIDES",
      format: "PPTX",
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });
  const littlesLaw = await db.topic.create({
    data: {
      courseId: opsManagement.id,
      name: "Little's Law",
      order: 0,
      confidence: "THIN",
      takeaway: "One slide heading, no worked example yet: L = λW (average items in a system equals arrival rate times average time in system).",
      lastOpenedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      openCount: 2,
    },
  });
  await db.topicSourceFile.create({
    data: { topicId: littlesLaw.id, sourceFileId: opsSlides.id, citation: "slide 22" },
  });
  await db.topic.create({
    data: {
      courseId: opsManagement.id,
      name: "Process capability & control limits",
      order: 1,
      confidence: "PARTIAL",
      takeaway: "A point outside three sigma is treated as a signal rather than noise — the same logic as a significance test, run continuously.",
    },
  });
  await db.topic.create({
    data: {
      courseId: opsManagement.id,
      conceptId: conceptRegression.id,
      name: "Forecasting demand",
      order: 2,
      confidence: "HIGH",
      takeaway: "Moving averages vs. exponential smoothing vs. regression-based forecasts, and when each breaks down.",
    },
  });

  // ======================================================================
  // Marketing Analytics: 10 topics matching the Library screen mockup
  // ======================================================================
  const mktTopics: {
    name: string;
    confidence: "HIGH" | "PARTIAL" | "THIN";
    takeaway: string;
    conceptId?: string;
  }[] = [
    { name: "Market segmentation basics", confidence: "HIGH", takeaway: "Segmenting on need-states, not just demographics — demographics describe, needs predict." },
    { name: "Conjoint analysis", confidence: "HIGH", takeaway: "Decomposing stated preference into part-worth utilities per attribute level." },
    { name: "Customer lifetime value", confidence: "PARTIAL", takeaway: "CLV as discounted future margin, and why churn rate dominates the formula more than most people expect." },
    { name: "A/B testing in campaigns", confidence: "PARTIAL", takeaway: "Lift is declared only when the difference clears a pre-registered threshold; report the interval alongside." },
    { name: "Attribution models", confidence: "THIN", takeaway: "Last-touch attribution over-credits the final channel. That's the whole of what the slide says." },
    { name: "Regression for marketing mix", confidence: "HIGH", takeaway: "Media mix modelling as multiple regression with adstock/decay transforms on spend variables.", conceptId: conceptRegression.id },
    { name: "Choice models & logit", confidence: "PARTIAL", takeaway: "Multinomial logit for discrete choice — utility differences, not utility levels, are identified." },
    { name: "Survey design pitfalls", confidence: "THIN", takeaway: "Leading questions and order effects, one page of notes." },
    { name: "Pricing experiments", confidence: "HIGH", takeaway: "Price elasticity from randomized price tests beats elasticity from observational data every time it's been checked." },
    { name: "Dashboards & metric hygiene", confidence: "PARTIAL", takeaway: "Vanity metrics vs. decision metrics — a metric earns a dashboard slot only if some decision changes with it." },
  ];
  for (let i = 0; i < mktTopics.length; i++) {
    const t = mktTopics[i];
    await db.topic.create({
      data: {
        courseId: mktAnalytics.id,
        name: t.name,
        order: i,
        confidence: t.confidence,
        takeaway: t.takeaway,
        conceptId: t.conceptId,
      },
    });
  }

  // ---- Interest tracking: visits on the flagship + a few Marketing topics
  const clv = await db.topic.findFirst({ where: { name: "Customer lifetime value" } });
  const regMkt = await db.topic.findFirst({ where: { name: "Regression for marketing mix" } });
  const visitSeeds: { topicId: string; count: number; daysAgo: number }[] = [
    { topicId: hypTopic.id, count: 9, daysAgo: 2 },
    { topicId: cocTopic.id, count: 4, daysAgo: 5 },
    { topicId: littlesLaw.id, count: 2, daysAgo: 7 },
  ];
  if (clv) visitSeeds.push({ topicId: clv.id, count: 12, daysAgo: 6 });
  if (regMkt) visitSeeds.push({ topicId: regMkt.id, count: 8, daysAgo: 4 });
  for (const v of visitSeeds) {
    for (let i = 0; i < v.count; i++) {
      await db.topicVisit.create({
        data: {
          topicId: v.topicId,
          visitedAt: new Date(Date.now() - (v.daysAgo + i) * 60 * 60 * 1000),
        },
      });
    }
  }

  // ---- A file waiting on quota, for the Add screen / Home processing card
  await db.sourceFile.create({
    data: {
      originalFileName: "Assignment 2 — model answer.pdf",
      storedPath: "files/corporate-finance/pending/assignment-2-model-answer-v2.pdf",
      kind: "ASSIGNMENT",
      format: "PDF",
      status: "WAITING_FOR_QUOTA",
    },
  });
  await db.sourceFile.create({
    data: {
      originalFileName: "Notes — 19 Sep, pages 1–6.heic",
      storedPath: "files/unfiled/notes-19-sep.heic",
      kind: "NOTES",
      format: "HEIC",
      status: "WAITING_FOR_QUOTA",
    },
  });

  // ---- Today's quota usage (matches the "14 / 20" mockup display) -------
  const today = new Date().toISOString().slice(0, 10);
  const resetAt = new Date();
  resetAt.setDate(resetAt.getDate() + 1);
  resetAt.setHours(5, 30, 0, 0);
  await db.quotaUsage.create({
    data: { date: today, provider: "gemini", used: 14, limit: 20, resetAt },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
