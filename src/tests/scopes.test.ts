import assert from "node:assert/strict";
import test from "node:test";

import { GOOGLE_SCOPES } from "../config.js";

test("OAuth requests only the reviewed minimum scopes", () => {
  assert.deepEqual(GOOGLE_SCOPES, [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me"
  ]);
});
