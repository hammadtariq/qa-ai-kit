import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Local runs read .env; CI passes the same names as secrets/variables.
try { process.loadEnvFile?.('.env'); } catch { /* no .env file */ }

// QA_REPORT_DIR lets CI keep two runs apart (PR: changed tests + smoke).
const reportDir = process.env.QA_REPORT_DIR || 'reports';

export default defineConfig({
  testDir: './tests',
  outputDir: path.join(reportDir, 'artifacts'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Retry failures at the end, one by one, so a dirty retry can't affect clean tests (Playwright 1.62+).
  retryStrategy: 'isolated',
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(reportDir, 'html') }],
    // Claude's triage and the digest read this file.
    ['json', { outputFile: path.join(reportDir, 'results.json') }],
    // trcli reads this. tr('C123') annotations become <property name="test_id">, matched with --case-matcher property.
    ['junit', { outputFile: path.join(reportDir, 'junit.xml'), embedAnnotationsAsProperties: true }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
    // Add firefox / webkit / mobile projects per client contract, with the same storageState and dependency.
  ],
});
