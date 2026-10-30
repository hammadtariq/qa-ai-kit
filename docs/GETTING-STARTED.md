# Getting started

This guide is for the person who owns the product: a founder, a product owner or a QA lead. You don't need to
write code. You type a few commands in Claude Code, answer questions about your business, and review what
Claude writes in a spreadsheet and on GitHub.

In about an hour you get:

- a short description of your business that every test is judged against;
- test cases in plain English ("Given Ali paid Rs 5,000 for order A-17, When the manager refunds Rs 6,000,
  Then the refund is refused");
- automated browser tests for those cases, run on every pull request and every night.

Nothing is used in production. Tests run against a staging site or a copy of your app.

## What you need

| You need | Why | If you don't have it |
| --- | --- | --- |
| [Claude Code](https://claude.com/claude-code) on your computer, signed in | You give Claude the commands here | Install it, then run `claude` once to sign in |
| Your app's code on GitHub, opened on your computer | Claude reads the code and adds the tests to it | Ask your developer for the repo link and clone it |
| [Node.js](https://nodejs.org) 22 | The tests run on it, whatever your app is built with | Install the LTS version |
| [GitHub CLI](https://cli.github.com), signed in (`gh auth login`) | Claude opens pull requests for you to review | Install it and sign in once |
| A test login for your app, one per kind of user (manager, staff...) | Tests sign in like a real user | Ask your developer to create test accounts. Never use a real customer's login |
| A staging site, or nothing | Tests need somewhere safe to run | No staging? Claude can start a copy of your app instead |

You don't need TestRail. If your team uses it, see [TestRail (optional)](#testrail-optional).

## Step 1. Install the kit (once)

Open Claude Code and type:

```
/plugin install qa-kit --marketplace hammadtariq/qa-ai-kit
```

Updates later: `/plugin marketplace update qa-ai-kit`.

## Step 2. Add it to your project (once per app)

Open Claude Code in your app's folder. Make sure any changes in progress are saved and committed. Then type:

```
/qa-kit:setup-project
```

Claude looks at your code first, then asks up to three questions. When unsure, take the answer marked
"Recommended":

1. **Where should the tests go?** Keep the default.
2. **How should tests reach your app?**
   - **Staging**: you have a staging site with test accounts. Have its address ready.
   - **Local app**: no staging. Claude starts a copy of your app for each test run, with its own throwaway
     data.
3. **Where do the test cases live?** Choose **none** unless your team uses TestRail. The cases then live
   in a spreadsheet file in your repo.

Claude does the rest on a new branch called `qa-kit/setup`: it adds the test tools, the test folder and the
GitHub automation. Apps that aren't built with JavaScript (Rails, Django, Laravel, Go...) are fine; the
tests get their own `qa/` folder and your app is left as it is.

**Add the test logins.** Claude can't read your secrets file (`.env`), on purpose. It tells you which lines
to add, for example:

```
QA_MANAGER_EMAIL=manager@test.example
QA_MANAGER_PASSWORD=...
```

Open `.env` in your editor, paste the lines with your test accounts, and save. Then tell Claude "done". It
checks that each test account can sign in.

## Step 3. Tell it about your business (15-20 minutes)

At the end of setup Claude offers to interview you. You can also start it any time:

```
/qa-kit:discover
```

Claude asks 10-20 questions, one at a time, each with a suggested answer it drafted from your code. You pick
an option or type your own. It asks about:

- what the product is and how it makes money;
- who uses it, and what each kind of user must never be able to do;
- the journeys that matter most (placing an order, paying, booking...);
- **what must never go wrong**, worst first, until each one is a rule a test can check. "Payments must
  work" becomes "a customer is never charged twice for one order";
- past incidents, outside services (payments, email), browsers and devices, accessibility.

It writes two short files: `.qa/business-context.md` (your answers, each marked as yours) and
`.qa/glossary.md` (the words your business uses, so test cases use them too). Read them once. Re-run
`/qa-kit:discover` whenever the business changes; it only asks about what's missing.

Not the owner? Have the owner run this step. Anything nobody confirmed is marked "(assumed)", and assumed
facts never make a case top priority.

## Step 4. Plan tests for a feature

Pick one feature, or a ticket your team is about to release:

```
/qa-kit:plan-feature PROJ-142
```

Give a ticket number, a link, or a short description ("partial refunds"). Claude reads the ticket and the
code, asks you up to about six questions where the rules aren't clear ("Can staff refund an order?"), and
writes the cases to a spreadsheet: `specs/cases/<feature>.csv`.

**Review the cases (Gate 1).** Open the CSV in Excel, Numbers or Google Sheets. Each row is one case:

| Column | What it is |
| --- | --- |
| `title`, `scenario` | The case in plain words, Given / When / Then |
| `priority` | P1 = money, stock, access or data at risk; P2 = wrong but fixable; P3 = minor |
| `why_it_matters` | What you'd lose if this broke |
| `suggestion` | What Claude's independent reviewer recommends: Keep, Rewrite, Merge or Drop |
| `decision` | **Yours.** Type Keep, Rewrite, Drop or "Merge into PO-03". Fill-down Keep, then change the exceptions |

Ignore the other columns; they are notes for the tests. Save the file as CSV (same name).

Claude keeps the list short on purpose: about 6 to 20 cases per feature, depending on how risky the area
is. A case that only proves "the page loads" doesn't make the list.

## Step 5. Turn the cases into tests

```
/qa-kit:generate-tests specs/cases/<feature>.csv
```

Claude writes a browser test for each case you kept, runs each one three times to make sure it's reliable,
and opens a pull request on GitHub.

**Review the pull request (Gate 2).** You don't need to read the code: check that the list in the pull
request matches your cases. If a test fails because the app does the wrong thing, Claude doesn't change the
test to pass. It marks it as a possible bug and drafts a bug report for you. Merge the pull request when
you're happy.

## Step 6. Turn on the automation (once, maybe with your developer)

The tests then run by themselves on every pull request and every night, and Claude explains failures. This
needs a few settings in GitHub, under **Settings > Secrets and variables > Actions**. The setup pull request
lists exactly which ones your project needs. Usually:

| Name | What to put |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | A token for Claude in CI: sign in to a Claude account kept for automation, run `claude setup-token`, paste what it prints |
| One email and password per test account | The same test logins as your `.env` (staging only) |
| `BASE_URL` (a variable, not a secret) | Your staging address (staging only) |

Also, under **Settings > Actions > General**, allow "Read and write permissions" and tick "Allow GitHub
Actions to create and approve pull requests". The full list, with labels to create, is in
[AGENCY-SETUP.md](AGENCY-SETUP.md) section 4.

## Day to day

| When | You run | You do |
| --- | --- | --- |
| A new feature is ready for testing | `/qa-kit:plan-feature <ticket>` | Fill the `decision` column (Gate 1) |
| Cases approved | `/qa-kit:generate-tests <csv>` | Review the pull request (Gate 2) |
| A test fails | Nothing: CI asks Claude to look | Read Claude's comment; decide on bugs it drafts (Gates 3-4) |
| Before a release | `/qa-kit:digest` | Sign off (Gate 5) |
| Too many cases, or inherited tests | `/qa-kit:review-cases <csv>` | Accept or overrule its suggestions |
| Once a week | `/qa-kit:upkeep` | Glance at the summary |

## Words you'll see

| Word | Meaning |
| --- | --- |
| Case | One thing to check, written as Given / When / Then |
| Gate | A point where a person approves before anything goes further. There are five |
| Smoke tests | Your P1 cases. They run on every pull request |
| Staging | A copy of your site for testing, with fake data |
| Pull request (PR) | A proposed change on GitHub that someone reviews before it's merged |
| CI | GitHub running the tests automatically |
| Playwright | The tool that drives a real browser in the tests |

## Questions

**Will it touch my live site or real customers?** No. Tests only run against staging or a local copy, and
setup refuses a production database.

**What does it cost?** Claude is used to plan, write and fix tests: on your own Claude plan when you run a
command, and on the automation account in CI. Running the tests,
reports and the daily summary are plain scripts and cost nothing extra.

**Can Claude change a test so it passes?** No. A guard stops it from changing what a test checks. When the
app looks wrong, it reports a possible bug instead.

**My app isn't JavaScript.** Fine. Setup puts the test tools in a `qa/` folder and leaves your app alone.

**Can it check accessibility, phones or other browsers?** Yes. Answer those questions in Step 3. Phones and
browsers are switched on from your answers; for accessibility Claude tells you the one extra command to run.

**Something went wrong.** Tell Claude what you see, in your own words. To start a step again, run its
command again; the kit doesn't redo what's already done.

## TestRail (optional)

If your team records test cases in TestRail, someone sets it up once (an API user and two custom fields,
[AGENCY-SETUP.md](AGENCY-SETUP.md) section 2). Then run setup with the project's id,
`/qa-kit:setup-project 12`, and add one step after Gate 1:

```
/qa-kit:push-cases specs/cases/<feature>.csv
```

It sends your kept cases to TestRail as drafts for the QA lead to approve, and test results are reported
there automatically.
