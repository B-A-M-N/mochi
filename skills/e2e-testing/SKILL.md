---
name: e2e-testing
description: End-to-end browser tests with Playwright/Cypress: page objects, deterministic waits, CI sharding. Use when asked for e2e, browser, or user-flow tests.
---

# End-to-End Testing Procedure

## 1. One critical user flow first
- Pick the flow that loses money if broken (signup, checkout, login). Automate exactly that before anything else.
- Keep selectors resilient: `getByRole` / `data-testid`, never CSS positional selectors or auto-generated class names.

## 2. Deterministic waits, zero sleeps
- Never `sleep()` / `waitForTimeout()`. Wait on assertions: `expect(page.getByText('Done')).toBeVisible()`.
- Network-dependent steps: `page.waitForResponse()` or route mocking (`page.route()`), so tests pass on a plane.

## 3. Isolate state per test
- Each test creates its own user/data (API seed call in `beforeEach`) and deletes it after. Shared accounts make order-dependent suites.
- Run tests in parallel workers; a test that only passes serially is broken.

## 4. CI integration
- Shard across workers (`--shard=1/4`), retry failures once (`--retries=1`), upload traces/screenshots on failure only.
- Headless in CI, headed locally for debugging (`--headed --debug`).

## Pitfalls
- Testing third-party widgets (payments, captchas) end-to-end: stub at the network edge, test your code around them.
- Date/time-dependent flows: freeze the clock (`clock.install()`), never depend on "today".
- Flaky e2e is worse than no e2e — quarantine (`test.skip` with a ticket link) beats a red main.
