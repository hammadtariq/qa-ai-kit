// The eval gate: a failed deterministic grader fails CI whatever the score; judged graders don't.
// Run: node --test 'plugins/qa-kit/tests/*.test.mjs'

import { test } from "node:test";
import assert from "node:assert/strict";
import { hardFailures } from "../evals/hard-graders.mjs";

const result = (graders) => ({
  cases: [
    {
      name: "plan-refunds",
      graders: [
        { name: "last-check-clean", type: "regex" },
        { name: "check-ran", type: "tool_used" },
        { name: "readable-by-owner", type: "llm" },
      ],
      arms: { with: [{ graders }] },
    },
  ],
});

test("a failed regex or tool_used grader is a hard failure", () => {
  const out = hardFailures(result([
    { name: "last-check-clean", passed: false, explanation: "pattern not found" },
    { name: "check-ran", passed: true },
    { name: "readable-by-owner", passed: true },
  ]));
  assert.deepEqual(out, ["plan-refunds (with run 1): last-check-clean: pattern not found"]);
});

test("a failed llm grader is left to the score threshold", () => {
  assert.deepEqual(hardFailures(result([
    { name: "last-check-clean", passed: true },
    { name: "check-ran", passed: true },
    { name: "readable-by-owner", passed: false, explanation: "judge votes: FAIL FAIL PASS" },
  ])), []);
});
