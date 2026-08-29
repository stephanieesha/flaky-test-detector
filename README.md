# Flaky Test Detector & Auto-Quarantine System

Every automation suite eventually accumulates flaky tests — tests that pass
and fail intermittently against unchanged code. Left alone, they erode trust
in the whole suite: people start ignoring red builds, which is worse than
having no tests at all. Manually tracking which tests are "just flaky" is
tedious and inconsistent across a team.

This project detects flakiness statistically from real run history, and
closes the loop automatically: **detect → quarantine → notify**, without a
human having to notice the pattern first.

## Why flip rate, not fail rate

A test that fails 100% of the time isn't flaky — it's broken. A flaky test
is one whose outcome *changes* between runs on the same code. This project
computes a **flip rate** per test: the proportion of consecutive run pairs
where the status changed (pass→fail or fail→pass). A high flip rate with
a mix of passes and fails is the real signature of flakiness.

## Architecture

```
Playwright tests (TypeScript)
        │  runs on a schedule via GitHub Actions
        ▼
results/junit.xml  ──►  record_run.py  ──►  history/test-history.jsonl
                                                     │
                                                     ▼
                                      flakiness_analyzer.py
                                            │           │
                                            ▼           ▼
                                  quarantine.json   GitHub Issue
                                   (flip rate ≥        opened for
                                    threshold)         each new
                                                        flaky test
                                            │
                                            ▼
                          playwright.config.ts reads quarantine.json
                          and skips those tests on the next run
```

## Target application

Tests run against a real deployed app (a shopping-list manager, previously
built as a separate project), not a toy demo. That's a deliberate choice:
the flakiness this project detects is genuine, not simulated.

**Real source of flakiness**: the app is hosted on Render's free tier,
which spins down after inactivity — the first request after idle can take
20-30+ seconds to wake up. This is exactly the kind of intermittent,
environment-driven flakiness that shows up in real CI pipelines hitting
real infrastructure, and gives the analyzer genuine signal to work with.

Covered flows (via `tests/pages/ShoppingListPage.ts`, with all locators
centralized in `tests/pages/locators.ts`): login, and add, edit, and
delete items within an existing category. Category creation/deletion is
currently out of scope - see **Known issues** below.

## Known issues

**Category creation doesn't persist (open bug, app-side).** Clicking
"Add" on a new category returns `200 OK` from the API, the form closes as
if it succeeded, but the category never actually appears - confirmed via
a `304 Not Modified` on the subsequent GET request, meaning the underlying
data genuinely hasn't changed. Root cause not yet isolated (backend code,
deploy state, and routing were all checked and look correct in isolation).
Tests currently run against a fixed, pre-existing category
(`TEST_CATEGORY_NAME`, defaults to `"Test 1"`) rather than creating one
per run. Category creation/deletion isn't implemented in the current
Page Object - deliberately out of scope until the bug is fixed, not an
oversight.

`tests/shopping-list.spec.ts` also includes a **fragile vs. robust**
pair of tests for editing an item — one using a fixed wait
(`waitForTimeout`, flaky by design against Redux state-update timing) and
the same test written with an auto-retrying assertion instead — as a
before/after comparison of the exact pattern that causes most real-world
flakiness.

**Self-cleaning by design**: since this hits a real account, every test
creates uniquely-named data (`qa-auto-category-<timestamp>`, etc.) and
deletes it before finishing, so scheduled runs every few hours don't
accumulate junk data over time.

## Setup

1. **Create a dedicated test account** on the app (not your personal one) —
   automated runs will be creating and deleting data continuously.
2. **Verify selectors against the real DOM** — locators in
   `tests/pages/locators.ts` were written and confirmed against the live
   app via `npx playwright codegen`. If the app's UI changes, that's the
   one file to update.
3. **Local environment**: copy `.env.example` to `.env.local` (or export
   the variables directly) with your test account's credentials.
4. **CI secrets**: in the GitHub repo settings, add `TEST_BASE_URL`,
   `TEST_EMAIL`, and `TEST_PASSWORD` as repository secrets — never commit
   real credentials.

## Running it

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

To manually run the analysis pipeline locally (normally done by CI):

```bash
python analyzer/record_run.py --junit results/junit.xml --history history/test-history.jsonl
python analyzer/flakiness_analyzer.py --history history/test-history.jsonl --quarantine quarantine.json
```

In CI, `.github/workflows/test-and-analyze.yml` runs this on a schedule,
accumulating real history over time, and will open a GitHub issue
automatically once a test's flip rate crosses the threshold (default 15%,
after a minimum of 5 runs).

## Roadmap

- Trend dashboard (flip rate over time per test) rendered as a static
  report published via GitHub Pages
- Slack notification in addition to GitHub issues
- Configurable quarantine expiry (auto re-enable a test after N clean runs
  to catch fixes without manual intervention)

## Why this exists

Built as a demonstration of treating test quality as an ongoing operational
signal rather than a one-time pass/fail check — the kind of tooling a QA
team actually benefits from having, not just a test suite for its own sake.
