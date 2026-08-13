// Shared helpers for the eLearn scraper scripts. See PROJECT_SPEC.md
// "eLearn extraction" for the why behind this design.
//
// IMPORTANT: this never touches your ISB credentials or MFA. It opens a
// real, visible Chromium window; if you're not already logged in, YOU
// log in by hand in that window (including any MFA step), and the
// script just waits for that to finish. The session is then saved to a
// local profile folder (.playwright-profile/, gitignored) so future
// runs skip straight past login until the session naturally expires.

import { chromium, type Page, type BrowserContext } from "playwright";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

export const ELEARN_BASE = "https://elearn.isb.edu";
const PROFILE_DIR = path.join(process.cwd(), ".playwright-profile", "elearn");
const LOGIN_WAIT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes to complete login/MFA by hand

export function db() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

// A real "we're back on elearn.isb.edu, past its login page" check — NOT
// just "URL doesn't contain /login/". That looser check was the bug:
// clicking "Microsoft O365 Login" immediately jumps the browser to
// login.microsoftonline.com, whose URLs also don't contain "/login/", so
// the old check declared success the instant the button was clicked —
// before any credentials or MFA were even entered — then raced ahead
// while the human was still mid-login.
function isPastLogin(url: URL): boolean {
  return url.hostname === "elearn.isb.edu" && !url.pathname.startsWith("/login/");
}

export async function getLoggedInPage(): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false, // always visible — you may need to act in it (login, MFA)
    viewport: { width: 1280, height: 900 },
  });

  // tsx transpiles with esbuild's "keep names" behavior, which injects
  // __name(fn, "name") calls into functions. page.evaluate()/$$eval()
  // serialize a function's source and run it standalone in the browser,
  // where __name doesn't exist — ReferenceError. Shim it as a no-op
  // before any page code runs. Passed as a raw string (not a function)
  // so THIS injection itself isn't transpiled/wrapped the same way.
  await context.addInitScript(
    "window.__name = window.__name || function(fn) { return fn; };"
  );

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(`${ELEARN_BASE}/my/`, { waitUntil: "domcontentloaded" });

  if (isPastLogin(new URL(page.url()))) {
    console.log("✓ Already logged in (reused saved session).");
    return { context, page };
  }

  console.log("");
  console.log("── Login needed ──────────────────────────────────────────");
  console.log("A Chromium window has opened. Please:");
  console.log('  1. Click "Log in using your account on: Microsoft O365 Login"');
  console.log("  2. Complete your normal ISB Microsoft login, including MFA.");
  console.log("This script will detect it and continue automatically —");
  console.log(`  waiting up to ${LOGIN_WAIT_TIMEOUT_MS / 60000} minutes.`);
  console.log("  (Take your time — it now genuinely waits for you to land");
  console.log("   back on elearn.isb.edu, not just for the button click.)");
  console.log("───────────────────────────────────────────────────────────");
  console.log("");

  // Wait for real completion, then double-check it wasn't a transient
  // bounce (e.g. a brief /auth/oidc/ callback hop that redirects back to
  // /login/ on failure) before trusting it.
  let confirmed = false;
  while (!confirmed) {
    await page.waitForURL((url) => isPastLogin(url), { timeout: LOGIN_WAIT_TIMEOUT_MS });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    confirmed = isPastLogin(new URL(page.url()));
    if (!confirmed) {
      console.log("  (bounced back to login — still waiting for it to actually complete...)");
    }
  }

  console.log("✓ Logged in. Session saved for next time.");
  return { context, page };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function politeDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
