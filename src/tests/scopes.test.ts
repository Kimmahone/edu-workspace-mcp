import assert from "node:assert/strict";
import test from "node:test";

import { GOOGLE_SCOPES, READ_ACCESS_SCOPES, googleScopes, readAccessEnabled, WORKSPACE_READONLY_SCOPES, credentialsPath, tokenPath, DEFAULT_TOKEN_PATH, DEFAULT_CREDENTIALS_PATH, assertWorkspaceReadonlyScopes, loginCommand } from "../config.js";

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

test("Agent profile requests exactly the five approved scopes despite legacy read flags", () => {
  process.env.EDU_WORKSPACE_SCOPE_PROFILE = "workspace-readonly";
  process.env.EDU_WORKSPACE_READ_ACCESS = "1";
  try {
    assert.deepEqual(googleScopes(), [
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/forms.body.readonly",
      "https://www.googleapis.com/auth/forms.responses.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/presentations.readonly"
    ]);
    assert.equal(readAccessEnabled(), true);
    assert.equal(loginCommand(), "edu-workspace-mcp login --workspace-readonly");
    assert.doesNotThrow(() => assertWorkspaceReadonlyScopes(WORKSPACE_READONLY_SCOPES.join(" ")));
    assert.throws(() => assertWorkspaceReadonlyScopes([...WORKSPACE_READONLY_SCOPES, "https://www.googleapis.com/auth/classroom.rosters.readonly"].join(" ")), /5개/);
    assert.throws(() => assertWorkspaceReadonlyScopes(WORKSPACE_READONLY_SCOPES.slice(1).join(" ")), /5개/);
  } finally {
    delete process.env.EDU_WORKSPACE_SCOPE_PROFILE;
    delete process.env.EDU_WORKSPACE_READ_ACCESS;
  }
});

test("Agent paths are separate and reject the old default credential and token paths", () => {
  const previousCredentials = process.env.EDU_WORKSPACE_CREDENTIALS_PATH;
  const previousToken = process.env.EDU_WORKSPACE_TOKEN_PATH;
  process.env.EDU_WORKSPACE_SCOPE_PROFILE = "workspace-readonly";
  delete process.env.EDU_WORKSPACE_CREDENTIALS_PATH;
  delete process.env.EDU_WORKSPACE_TOKEN_PATH;
  try {
    assert.notEqual(credentialsPath(), DEFAULT_CREDENTIALS_PATH);
    assert.notEqual(tokenPath(), DEFAULT_TOKEN_PATH);
    process.env.EDU_WORKSPACE_CREDENTIALS_PATH = DEFAULT_CREDENTIALS_PATH;
    assert.throws(() => credentialsPath(), /별도/);
    process.env.EDU_WORKSPACE_TOKEN_PATH = DEFAULT_TOKEN_PATH;
    assert.throws(() => tokenPath(), /덮어쓸/);
    process.env.EDU_WORKSPACE_SCOPE_PROFILE = "unknown-profile";
    assert.throws(() => googleScopes(), /지원하지/);
  } finally {
    delete process.env.EDU_WORKSPACE_SCOPE_PROFILE;
    if (previousCredentials === undefined) delete process.env.EDU_WORKSPACE_CREDENTIALS_PATH;
    else process.env.EDU_WORKSPACE_CREDENTIALS_PATH = previousCredentials;
    if (previousToken === undefined) delete process.env.EDU_WORKSPACE_TOKEN_PATH;
    else process.env.EDU_WORKSPACE_TOKEN_PATH = previousToken;
  }
});
