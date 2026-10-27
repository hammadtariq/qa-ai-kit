# <Feature name> (<new feature | existing feature, regression coverage>)

Roles: <which logins, e.g. ADMIN admin@example.test, EDITOR editor@example.test>. Test data: <seed / org>.

Area and risk tier: <area from .qa/business-context.md, low | medium | high>

Why it matters: <what the business owner loses if this breaks: money, stock, access, trust, compliance>

Acceptance criteria (required business behaviour; verify against the implementation, not just the happy path):
1. <Happy path as a business outcome: what the user does, and what must be true afterwards (records, totals, status, downstream screens)>
2. <Validation: required fields, limits, bad input a real user would enter, and the message they get>
3. <Permissions: who can and can't do it, in the UI and through the API>
4. <State changes: e.g. PENDING → APPROVED, and side effects elsewhere (stock, ledger, reports, emails)>
5. <Edits, reversal and repeats: edit after approval, cancel, double-submit, duplicates>

Business rules and invariants:
- <e.g. supplier balance = previous balance + approved purchase totals − payments>

Dirty paths to cover (from the playbook catalogue, each with its business reason):
- <e.g. approve twice: must not double the stock or the ledger charge>

## Decisions

Answers from the owner to questions the ticket and code left open. Later sessions read these instead of asking again.

| Question | Answer | Who | Date |
| --- | --- | --- | --- |
| <e.g. The API allows approving your own purchase. Should it?> | <No, never> | <owner name> | <YYYY-MM-DD> |

Open questions for the owner:
- <Anything still unanswered, or that looks wrong in the implementation. Don't turn a suspicious behaviour into an expected one.>

Out of scope: <related features covered separately>
