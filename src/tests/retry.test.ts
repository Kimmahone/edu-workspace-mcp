import assert from "node:assert/strict";
import test from "node:test";
import { isGoogleRateLimitError, withGoogleRetry } from "../google/retry.js";

test("Google quota errors use bounded exponential backoff", async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await withGoogleRetry(async () => {
    calls += 1;
    if (calls < 3) throw { response: { status: 429 } };
    return "ok";
  }, { baseDelayMs: 100, random: () => 0, sleep: async (milliseconds) => { delays.push(milliseconds); } });

  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [100, 200]);
});

test("non-idempotent calls do not retry ambiguous server errors", async () => {
  let calls = 0;
  await assert.rejects(() => withGoogleRetry(async () => {
    calls += 1;
    throw { response: { status: 503 } };
  }, { idempotent: false, sleep: async () => undefined }));
  assert.equal(calls, 1);
});

test("Google 403 quota reasons are classified as rate limits", () => {
  assert.equal(isGoogleRateLimitError({ response: { status: 403, data: { error: { errors: [{ reason: "userRateLimitExceeded" }] } } } }), true);
  assert.equal(isGoogleRateLimitError({ response: { status: 403, data: { error: { errors: [{ reason: "forbidden" }] } } } }), false);
});
