import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { defaultRole, qaConfig, qaRoot } from "./e2e/roles";

// Paths start at the repo root (the folder with .qa/config.json), so this config works from the root or from a
// qa/ folder (standalone mode).
const root = qaRoot();

// Local runs read .env; CI passes the same names as secrets/variables.
try {
  process.loadEnvFile?.(path.join(root, ".env"));
} catch {
  /* no .env file */
}

// The app under test, from .qa/config.json:
//   - BASE_URL set (staging): test that URL.
//   - BASE_URL unset and `app.startCommand` set: start this checkout on `app.port` and test it
//     (`app.devCommand` locally if given, `app.startCommand` in CI). Never point BASE_URL at production.
type QaApp = { startCommand?: string; devCommand?: string; port?: number; readyPath?: string };
const app = (qaConfig().app ?? {}) as QaApp;
// The session every test's `page` starts in: `defaultRole`, else the first of `roles`, else "user"
// (QA_USER_EMAIL / QA_USER_PASSWORD). Throws here if `defaultRole` isn't one of the roles.
const startRole = defaultRole();
const localUrl = app.port ? `http://127.0.0.1:${app.port}` : undefined;
const baseURL = process.env.BASE_URL || localUrl;

// QA_REPORT_DIR lets CI keep two runs apart (PR: changed tests + smoke).
const reportDir = path.resolve(root, process.env.QA_REPORT_DIR || "reports");

// Browsers and devices beyond desktop Chrome, from the support promises (discover, area 7):
//   "browsers": { "devices": ["Desktop Safari", "iPhone 13"], "locales": ["ar-SA"] }
// Device names are Playwright's (devices in @playwright/test). These projects run only the @smoke tests (the
// P1 journeys); everything runs on desktop Chrome.
type QaBrowsers = { devices?: string[]; locales?: string[] };
const browsers = (qaConfig().browsers ?? {}) as QaBrowsers;
const signedIn = { storageState: startRole.authFile };
const extraProjects = [
  ...(browsers.devices ?? []).map((name) => {
    if (!devices[name]) throw new Error(`Unknown device "${name}" in .qa/config.json browsers.devices. Use a name from Playwright's devices list, e.g. "Desktop Safari", "iPhone 13", "Pixel 7".`);
    return { name, use: { ...devices[name], ...signedIn }, grep: /@smoke/, dependencies: ["setup"] };
  }),
  ...(browsers.locales ?? []).map((locale) => ({
    name: `chromium ${locale}`,
    use: { ...devices["Desktop Chrome"], locale, ...signedIn },
    grep: /@smoke/,
    dependencies: ["setup"],
  })),
];

export default defineConfig({
  testDir: "./e2e",
  outputDir: path.join(reportDir, "artifacts"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Retry failures at the end, one by one, so a dirty retry can't affect clean tests (Playwright 1.62+).
  retryStrategy: "isolated",
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(reportDir, "html") }],
    // Claude's triage and the digest read this file.
    ["json", { outputFile: path.join(reportDir, "results.json") }],
    // trcli reads this. tr('C123') annotations become <property name="test_id">, matched with --case-matcher property.
    ["junit", { outputFile: path.join(reportDir, "junit.xml"), embedAnnotationsAsProperties: true }],
  ],
  use: {
    baseURL,
    testIdAttribute: "data-testid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer:
    process.env.BASE_URL || !app.startCommand || !localUrl
      ? undefined
      : {
          command: process.env.CI ? app.startCommand : app.devCommand || app.startCommand,
          cwd: root,
          url: `${localUrl}${app.readyPath ?? "/"}`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          stdout: "ignore",
          stderr: "pipe",
        },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...signedIn },
      dependencies: ["setup"],
    },
    ...extraProjects,
  ],
});
