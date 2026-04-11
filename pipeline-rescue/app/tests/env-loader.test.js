const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDotEnv } = require("../lib/env-loader");

test("parseDotEnv ignores comments and strips wrapping quotes", () => {
  const parsed = parseDotEnv(`
# comment
OPENAI_API_KEY="abc123"
MODEL=gpt-5.4-mini
`);

  assert.equal(parsed.OPENAI_API_KEY, "abc123");
  assert.equal(parsed.MODEL, "gpt-5.4-mini");
});
