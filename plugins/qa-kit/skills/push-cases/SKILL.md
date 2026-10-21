---
name: push-cases
description: Push the reviewed rows of a cases CSV (specs/cases/<feature>.csv) to TestRail - create new cases, update changed ones, retire dropped or merged ones into a Retired section - and write the TestRail ids back into the CSV. Use after the reviewer has filled the decision column (Gate 1 in the sheet), or when the user asks to push, sync or upload cases to TestRail.
argument-hint: "<specs/cases/<feature>.csv>"
disable-model-invocation: true
---

# Push reviewed cases to TestRail

Cases file: `$ARGUMENTS` (if empty, list `specs/cases/*.csv` and ask which one).

The CSV is the source of truth for case design and the reviewer's `decision` column is the Gate 1
review. This skill copies the result to TestRail. It never approves cases: pushed cases arrive as
**AI draft**, and the QA lead bulk-approves them in TestRail (select the section's cases → Edit Selected
→ Review status: Approved), a one-minute step that confirms what the sheet already decided. It never
deletes anything.

## 1. Check the file

```bash
node .qa/scripts/cases.mjs check <csv> --push
node .qa/scripts/cases.mjs payload <csv>
```

- `check --push` must report no errors. Undecided rows and `Rewrite` rows are errors here: the reviewer
  finishes the review first. Show the user the errors and stop.
- `payload` prints `create` (Keep rows without a `testrail_id`), `update` (Keep rows with one),
  `retire` (Drop or Merge rows that are already in TestRail) and `held_back`, with TestRail-ready
  preconditions and steps. Use these texts as they are; don't rewrite cases while pushing.

## 2. Find the section

- `testrail_status` (no `warnings`), then `testrail_get_sections`.
- The feature's section: `testrail.sections["<feature>"]` in `.qa/config.json` if set; otherwise match
  the feature name, or ask. Create it with `testrail_add_section` if it doesn't exist. Write the id to
  `testrail.sections["<feature>"]` in `.qa/config.json` so the next push finds it.
- All cases go into that section. The CSV's `section` column only groups the plan; create subsections
  only if the user asks.
- `testrail_get_cases` for the section with `details: true`, to compare with the CSV.

## 3. Show the plan and confirm

Tell the user, before changing anything:

- **create**: count and titles;
- **update**: count, and which of them have content changes compared with TestRail (title, preconditions
  or steps). Those go back to AI draft for Gate 1; rows whose text is unchanged aren't sent;
- **retire**: ids to move into the `Retired` section;
- **in TestRail but not in the CSV**: case ids in the section that no row mentions. Ask whether to retire
  them or add them to the CSV; never retire them without a yes;
- **held back**: rows not pushed and why.

Wait for a yes.

## 4. Push

1. `testrail_get_meta` once: map `P1`/`P2`/`P3` to `priority_id` (by name, e.g. Critical/High/Medium, or
   ask once and save the mapping as `testrail.priorities` in `.qa/config.json`), and `type` to `type_id`.
2. **Create**: one `testrail_add_cases` call with the section id and every `create` row (title,
   `priority_id`, `type_id`, `preconditions`, `steps`). The result lists ids in the same order. Write each
   one back: `node .qa/scripts/cases.mjs set <csv> <KEY> testrail_id=C<id>`.
3. **Update**: `testrail_update_case` for each changed row with `title`, `preconditions`, `steps` and
   `fields: { priority_id, type_id }`. Skip rows TestRail already matches.
4. **Retire**: find or create a top-level section named `Retired`, then one `testrail_move_cases` call with
   every `retire` id (and any the user agreed to in step 3). If the move fails (TestRail older than 6.5.2),
   give the user the id list to move by hand: select the cases in TestRail, then Move.
5. Regenerate the plan: `node .qa/scripts/cases.mjs plan <csv>`. Record retired ids in the plan's
   "Retired cases" table (id, key, merged into or reason).

## 5. Finish

- `node .qa/scripts/cases.mjs check <csv>` once more (it should now show every Keep row with an id).
- On a branch, commit the CSV, the plan and `.qa/config.json` and open a PR (`docs(qa): push <feature> cases`).
- Report: created, updated, retired, unchanged; the TestRail section link; and the Gate 1 step: "N cases
  are AI draft in TestRail; bulk-approve them, then run `/qa-kit:generate-tests <csv>`."

**No TestRail on this project?** Skip this skill: `node .qa/scripts/cases.mjs testrail <csv>` writes an
import file for TestRail's own importer, and most other tools import the CSV directly (see
`specs/cases/README.md`).
