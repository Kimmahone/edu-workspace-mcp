import assert from "node:assert/strict";
import test from "node:test";
import { parseCliOptions } from "../cli-options.js";

test("default installation and login select the five-scope Agent while web remains legacy",()=>{
  for (const args of [[],["serve"],["login"],["install","codex"],["setup","all"]]) assert.equal(parseCliOptions(args).legacy,false);
  assert.equal(parseCliOptions(["web"]).legacy,true);
  assert.equal(parseCliOptions(["install","claude-code"]).client,"claude");
  assert.equal(parseCliOptions(["login","--legacy","--read"]).readAccess,true);
  assert.throws(()=>parseCliOptions(["login","--read"]),/Classroom/);
});
test("unknown flags and invalid combinations fail before login or settings mutation",()=>{
  for (const args of [["login","--workspace-readonyl"],["login","--unknown"],["install","cursor","--oops"]]) assert.throws(()=>parseCliOptions(args),/알 수 없는 옵션/);
  assert.throws(()=>parseCliOptions(["login","--legacy","--workspace-readonly"]),/함께/);
  assert.throws(()=>parseCliOptions(["setup","--no-browser"]),/login/);
  assert.throws(()=>parseCliOptions(["doctor","--local-only"]),/disconnect/);
  assert.throws(()=>parseCliOptions(["login","--client-secret=test-only-private-value"]),error=>!String(error).includes("test-only-private-value"));
  assert.equal(parseCliOptions(["login","--workspace-readonly","--no-browser"]).noBrowser,true);
  assert.equal(parseCliOptions(["disconnect","--legacy","--local-only"]).localOnly,true);
});
