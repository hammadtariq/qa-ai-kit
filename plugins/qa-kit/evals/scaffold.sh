#!/bin/bash
# Builds an eval run's folder (the current directory): the sample app with the kit installed as
# /qa-kit:setup-project leaves it, committed. Called from each case's setup.sh.
#   scaffold.sh discover          # no business context yet; the owner's answers in .eval/owner-answers.md
#   scaffold.sh plan <feature>    # the confirmed business context and glossary, and briefs/<feature>.md
set -euo pipefail
EVALS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PLUGIN=$(dirname "$EVALS")

cp -R "$EVALS/sample-app/." .
node "$PLUGIN/scripts/install-templates.mjs" "$PLUGIN" . > /dev/null
# The sample's settings over the template config; the plugin under test comes from the eval, not a marketplace.
node -e '
const fs = require("fs");
const cfg = { ...JSON.parse(fs.readFileSync(".qa/config.json", "utf8")), ...JSON.parse(fs.readFileSync("qa-config.json", "utf8")) };
fs.writeFileSync(".qa/config.json", JSON.stringify(cfg, null, 2) + "\n");
const s = JSON.parse(fs.readFileSync(".claude/settings.json", "utf8"));
delete s.extraKnownMarketplaces; delete s.enabledPlugins;
fs.writeFileSync(".claude/settings.json", JSON.stringify(s, null, 2) + "\n");
'
rm qa-config.json

mkdir -p .eval
case "${1:-}" in
  discover) cp "$EVALS/owner-answers.md" .eval/ ;;
  plan)
    cp "$EVALS/context/business-context.md" "$EVALS/context/glossary.md" .qa/
    mkdir -p specs/briefs
    cp "$EVALS/briefs/${2:?usage: scaffold.sh plan <feature>}.md" specs/briefs/
    ;;
  *) echo "usage: scaffold.sh discover | plan <feature>" >&2; exit 1 ;;
esac

git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -qm "Kolachi Supplies with the QA Kit"
