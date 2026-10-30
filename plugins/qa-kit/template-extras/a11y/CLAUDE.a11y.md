### Accessibility (axe)

- `.qa/config.json` → `a11y` is on: each page of a key journey (business context) has one test in
  `e2e/a11y/key-pages.spec.ts`, tagged `@a11y` and the page's `@area-<name>`, that opens the page as the user
  would see it and calls `expectAccessible(page)` from `e2e/support/a11y.ts`. It fails only on serious and
  critical issues. PRs run it when they change that area; the nightly runs all of them.
- These tests have no case id. Don't weaken them to pass: a real issue is a product bug for the developers,
  and a rule turned off with `disable` needs a comment saying why.
