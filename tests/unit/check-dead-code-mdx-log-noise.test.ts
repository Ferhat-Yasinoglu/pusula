import { test } from "node:test";
import assert from "node:assert";
import { extractKnipJson, classifyKnipFailure } from "../../scripts/check/check-dead-code.mjs";

// Regression guard: knip's stdout can carry plugin progress lines (fumadocs-mdx
// prints "[MDX] generating ...") BEFORE its JSON report. Parsing the raw stdout
// failed the dead-code gate with a false config error on Unit Tests / Gate runs.

const report = JSON.stringify({ issues: [] });

test("extractKnipJson skips plugin log lines and returns the JSON report", () => {
  const stdout = `[MDX] generating ...\n${report}\n`;
  assert.deepStrictEqual(JSON.parse(extractKnipJson(stdout)), { issues: [] });
});

test("extractKnipJson returns clean JSON unchanged", () => {
  assert.strictEqual(extractKnipJson(report), report);
});

test("a non-zero knip exit with log noise before the JSON is OK, not a config failure", () => {
  const execError = Object.assign(new Error("exit 1"), { status: 1 });
  const outcome = classifyKnipFailure(execError, `[MDX] generating ...\n${report}`);
  assert.strictEqual(outcome.kind, "ok");
});

test("output with no JSON report stays unparseable, so it still fails loudly", () => {
  assert.throws(() => JSON.parse(extractKnipJson("[MDX] only noise, no report")));
});
