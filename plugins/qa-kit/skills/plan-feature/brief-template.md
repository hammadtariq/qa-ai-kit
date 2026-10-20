# <Feature name> (<new feature | existing feature, regression coverage>)

Roles: <which logins, e.g. ADMIN admin@example.test, EDITOR editor@example.test>. Test data: <seed / org>.

Acceptance criteria (for an existing feature: how it behaves today):
1. <Happy path: what the user does, and what must be true afterwards (records, totals, status)>
2. <Validation: required fields, limits, error messages>
3. <Permissions: who can and can't do it>
4. <State changes: e.g. PENDING → APPROVED, and side effects on other areas (stock, ledger, emails)>
5. <Edits, cancellation, duplicates, empty states>

Open questions for the QA lead:
- <Anything the code or docs leave unclear. Don't turn a suspicious behaviour into an expected one.>

Out of scope: <related features covered separately>
