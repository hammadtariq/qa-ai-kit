# Discover question bank

Ten areas, asked in this order. For each: what to read before asking, the question, how to draft the
options, the follow-ups, and when the area counts as answered. Word every question for a non-technical
owner. One question per AskUserQuestion call; the first option is always the drafted answer, marked
`(Recommended)`, with the evidence in its description.

The heading in brackets is where the answer goes in `.qa/business-context.md`.

## 1. The product [The business]

**Read:** README, landing copy, `package.json` description, route names, the main models.

**Ask:**
- "Which best describes the product?" Options: the drafted one-line description ("An online shop for
  handmade shoes, selling to customers in Pakistan"), plus one or two plausible alternatives if the code is
  ambiguous.
- "How does it make money?" Options drafted from what the code shows: one-off sales, subscriptions,
  commission on sales, fees per transaction, it saves the client's staff time (internal tool).
- "Which kind of business is it closest to?" (multiSelect) Options: the 2-4 best-matching risk packs by
  name, in plain words ("An online shop", "Subscriptions with plans", "Bookings and appointments", "A
  marketplace between buyers and sellers").

**Answered when:** a one-line description, how it makes money, and at least one risk pack, all from the
owner.

## 2. People and roles [The business, Roles]

**Read:** role enums, permission maps, middleware, seed users, admin pages.

**Ask:**
- "Who uses it day to day?" (multiSelect) Options: the roles found in the code, renamed to the words the
  business uses ("Store manager", not `ROLE_ADMIN`).
- For each pair where a lower role touches money, access or records: "Should <role> be able to <action>?"
  Options: what the code allows today (Recommended, with the file), the opposite, "Only up to a limit".
  This is where "The API allows approving your own purchase. Should it?" comes from.
- "Does one customer organisation ever share the app with another?" (multi-tenant) Options: drafted from
  the models (an `org_id` / `tenant_id` column), "No, one business only".

**Answered when:** roles in business words, and for each role the actions it must never take.

## 3. Journeys that matter [Key journeys]

**Read:** routes, the most-linked pages, analytics events, README "how it works".

**Ask:**
- "Which three journeys bring in money, or would stop users working if they broke?" Options: drafted
  sets of three, most likely first ("Browse → checkout → pay; Refund an order; Restock a product").
  multiSelect over a list of 4-6 journeys also works.
- Follow-up for each chosen journey, only if unclear: "How does <journey> end, from the customer's side?"
  (what they see or receive: an email, a status, a receipt).

**Answered when:** three journeys, each with how it ends for the user.

## 4. What must never go wrong [What must never go wrong]

The most important area. Draft from the journeys, the risk packs and the code (money columns, stock
counters, permission checks, tenant filters).

**Ask:**
- "Here is what I think would be a disaster, worst first. Is the order right?" Options: "Yes, as listed
  (Recommended)", "Mostly, but the order is different", "Something important is missing". Put the drafted
  ranked list (3-6 items, one line each, covering money, data, access, legal or compliance, reputation as
  they apply) in the question text.
- For each item until it is **checkable**, offer 2-3 drafted rules as options:
  - Money: "A refund never exceeds what was paid" / "A customer is charged once per order, even if they
    pay twice" / "Totals on the invoice match the order".
  - Stock or capacity: "Stock never goes below zero" / "A slot is never booked twice" / "Cancelling puts
    the stock back".
  - Access: "Staff can never approve their own request" / "One organisation never sees another's data" /
    "A removed user loses access at once".
  - Data: "A posted entry is never changed, only reversed" / "Deleting a customer keeps their invoices".
  - Legal or compliance: "Card numbers are never stored" / "A customer can export or delete their data".
  - Reputation: "A customer never receives someone else's email" / "Prices shown match prices charged".
- If the owner's answer is still vague ("payments should work"), ask "What would you see that tells you
  it went wrong?" and turn the answer into a rule.

**Answered when:** a ranked list where every item is a rule a test can prove, all tagged `(owner, ...)`.

## 5. Past incidents and complaints [Past incidents and complaints]

**Read:** issue tracker labels like `bug` and `incident` (`gh issue list --label bug --state all --limit 30`),
CHANGELOG fixes, hotfix commits.

**Ask (free text, in chat):** "What has gone wrong before that you never want to see again? And what do
support or customers complain about most?" Offer what you found as a starting list.

**Answered when:** a list (possibly "none recorded yet", if the owner says so). Each incident later gets
a regression case.

## 6. Outside services [Outside services]

**Read:** dependencies and config for payments (Stripe, PayPal, local gateways), email (SES, SendGrid,
Postmark, SMTP), SMS, sign-in providers (Google, Auth0, Okta), ERPs and accounting, webhooks in and out.

**Ask:**
- "Which outside services does the app depend on?" (multiSelect) Options: those found in the code.
- For each one: "Is there a test or sandbox mode we can use?" Options: "Yes, and staging uses it
  (Recommended)" when config suggests so, "Yes, but not set up", "No, only live", "Not sure".

**Answered when:** each service with its test-mode status. Tests never use live keys; services with no
sandbox are stubbed, and the case's notes say what the stub hides.

## 7. What the team promises to support [Support promises]

**Read:** browserslist, responsive CSS breakpoints, i18n files, currency and time zone settings.

**Ask:**
- "Which browsers and devices must it work on?" (multiSelect) Options: "Chrome on desktop", "Safari on
  iPhone", "Chrome on Android", "Edge / Firefox on desktop".
- Only if the code shows more than one: "Which languages, currencies or time zones are in use?"

**Answered when:** browsers and devices, and languages, currencies and time zones when relevant.

## 8. What tests already cover [Existing test coverage]

**Read:** unit and API test folders, coverage reports, CI test jobs. Summarise by area.

**Ask:** "Here is what the existing tests seem to cover. Is anything important tested elsewhere (by
hand, by another team)?" Options: "That's right (Recommended)", "Some of it is tested by hand before
release", "There is another test suite I'll point you to".

**Answered when:** a short list of what is already covered and where, so E2E cases don't repeat it.

## 9. Releases [Releases]

**Read:** CI workflows, deploy scripts, tags and release frequency in git history.

**Ask:**
- "How often do you release?" Options: drafted from history ("Several times a week"), "Daily or more",
  "Every few weeks", "Rarely, with a planned release".
- "What does a bad release cost you?" Options: "Lost sales or refunds within hours", "Angry customers
  and support load", "Mainly internal rework", "Legal or contract penalties".

**Answered when:** frequency and cost of a bad release. This sets how much runs on every PR.

## 10. Test environment and data [Test environment and data]

**Read:** `.qa/config.json`, `qa.env.example`, seed scripts, staging URLs in docs or CI.

**Ask:**
- "Where should tests run?" Options: "A staging site with test accounts (Recommended)" when one is
  documented, "A copy of the app started on this machine or in CI", "Not sure yet". Never production.
- "Which test accounts exist, one per role?" (multiSelect over the roles from area 2) and whether they are
  seeded automatically.
- "Can tests create and delete their own data there?" Options: "Yes, freely", "Create only, never
  delete", "Only in a separate test organisation".

**Answered when:** where tests run, accounts per role, and whether tests can clean up after themselves.

## Areas and risk tiers

Last, from everything above: list the product areas (purchases, billing, bookings...) with a drafted tier
each, and ask once: "Here is how risky I think each area is. Change any?" Options: "Looks right
(Recommended)", "Some are wrong", with the table in the question text.

- **high:** money, access or data loss is possible there;
- **medium:** mistakes are wrong but recoverable;
- **low:** cosmetic or rarely used.

## Glossary

From the models, page titles and the owner's answers, draft about 15 terms with one-line meanings, the
words to avoid for each, and the names to use in examples. Ask once: "These are the words cases will use.
Anything to change?" Options: "Use these (Recommended)", "Some words are wrong", "Add a few".
