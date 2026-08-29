import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Loads TEST_BASE_URL / TEST_EMAIL / TEST_PASSWORD from .env.local for local
// runs. In CI these come from GitHub Actions secrets instead, so this file
// simply won't exist there - dotenv silently no-ops if it's missing.
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Reads quarantine.json (produced by analyzer/flakiness_analyzer.py) and
// builds a --grep-invert pattern so quarantined tests are skipped at run time
// without deleting or commenting them out. This is the "closing the loop" step:
// detection (Python) -> quarantine list (JSON) -> enforcement (Playwright).
function getQuarantinePattern(): RegExp | undefined {
  const quarantinePath = path.join(__dirname, 'quarantine.json');
  if (!fs.existsSync(quarantinePath)) return undefined;

  const quarantine = JSON.parse(fs.readFileSync(quarantinePath, 'utf-8'));
  const testNames = (quarantine.quarantined_tests || []).map((t: any) => t.test_name);
  if (testNames.length === 0) return undefined;

  const escaped = testNames.map((n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('|'));
}

export default defineConfig({
  testDir: './tests',
  timeout: 60000, // generous per-test timeout to accommodate Render cold starts
  reporter: [['junit', { outputFile: 'results/junit.xml' }], ['list']],
  grepInvert: getQuarantinePattern(),
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://shirly2-0.onrender.com',
    actionTimeout: 45000, // covers Render free-tier wake-up time (was too tight at 15s)
    navigationTimeout: 45000, // covers Render free-tier wake-up time
  },
  // No webServer block: the target is a live deployed app, not something
  // spun up locally for the test run.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
