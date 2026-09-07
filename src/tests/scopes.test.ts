import assert from "node:assert/strict";
import test from "node:test";

import { GOOGLE_SCOPES, READ_ACCESS_SCOPES, googleScopes, readAccessEnabled } from "../config.js";

test("OAuth requests only the reviewed minimum scopes", () => {
  assert.deepEqual(GOOGLE_SCOPES, [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students"
  ]);
});

test("Workspace read scopes are opt-in and off by default", () => {
  delete process.env.EDU_WORKSPACE_READ_ACCESS;
  delete process.env.EDU_WORKSPACE_SHEETS_READ;
  assert.equal(readAccessEnabled(), false);
  assert.deepEqual(googleScopes(), [...GOOGLE_SCOPES]);

  process.env.EDU_WORKSPACE_READ_ACCESS = "1";
  assert.equal(readAccessEnabled(), true);
  assert.deepEqual(googleScopes(), [...GOOGLE_SCOPES, ...READ_ACCESS_SCOPES]);
  delete process.env.EDU_WORKSPACE_READ_ACCESS;
});

test("legacy Sheets read flag enables the complete read profile", () => {
  process.env.EDU_WORKSPACE_SHEETS_READ = "yes";
  assert.equal(readAccessEnabled(), true);
  assert.deepEqual(googleScopes(), [...GOOGLE_SCOPES, ...READ_ACCESS_SCOPES]);
  delete process.env.EDU_WORKSPACE_SHEETS_READ;
});
