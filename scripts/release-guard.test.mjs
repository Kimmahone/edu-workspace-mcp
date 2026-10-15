import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseReasons, READ_SCOPES } from './release-conditions.mjs';
const now = Date.parse('2026-10-14T02:00:00Z');
const expected = { version: '1.1.2', serverUrl: 'https://auth.example.invalid/mcp', publicPolicySourceHash: 'fixture-policy-hash' };
const fixture = () => ({
  schemaVersion: 1, evidenceKind: 'live', version: expected.version, serverUrl: expected.serverUrl,
  workersPlan: 'free', noPaidServices: true, noSeparateModelApiCalls: true, googleStandardTierOnly: true,
  accountCheckedAt: new Date(now).toISOString(), costReviewedAt: new Date(now).toISOString(), costReviewExpiresAt: new Date(now + 3600000).toISOString(),
  approvedGoogleScopes: [...READ_SCOPES], aiWebClientVerified: true,
  checks: { authorizationCodeExchanged: true, freshGoogleRefresh: true, documentRead: true, mcpRefreshRotation: true, multiUserIsolation: true, disconnectVerified: true, freeCpuVerified: true, hostInstallVerified: true, publicPolicyVerified: true, freeLimitStopVerified: true, costExpiryStopVerified: true, expiredDataCleanupVerified: true, cleanupScheduleVerified: true },
  publicPolicyUrl: 'https://edu.jeld.kr/privacy.html', publicPolicySourceHash: expected.publicPolicySourceHash,
  maintenancePlanReviewed: true, maintenancePlan: 'Fixture operator review; stop at expiry.', publicationApproved: true
});
test('only matching live release evidence can pass; mocks and a previous version cannot', () => {
  assert.deepEqual(releaseReasons(fixture(), expected, now), []);
  for (const patch of [{ evidenceKind: 'mock' }, { version: '1.1.1' }, { serverUrl: 'https://other.invalid/mcp' }, { publicationApproved: false }]) assert.ok(releaseReasons({ ...fixture(), ...patch }, expected, now).length);
});
test('Paid, unverified free usage, invalid time and permanent pricing records block publication', () => {
  for (const patch of [
    { workersPlan: 'paid' }, { noPaidServices: false }, { googleStandardTierOnly: false }, { noSeparateModelApiCalls: false },
    { accountCheckedAt: 'invalid' }, { accountCheckedAt: new Date(now - 900001).toISOString() },
    { costReviewExpiresAt: new Date(now).toISOString() }, { costReviewExpiresAt: new Date(now + 365 * 86400000).toISOString() },
    { maintenancePlanReviewed: false }
  ]) assert.ok(releaseReasons({ ...fixture(), ...patch }, expected, now).length);
});
test('failed live checks, extra scopes and an outdated public policy block publication', () => {
  for (const key of Object.keys(fixture().checks)) {
    const proof = fixture(); proof.checks[key] = false;
    assert.ok(releaseReasons(proof, expected, now).length);
  }
  for (const patch of [{ aiWebClientVerified: false }, { approvedGoogleScopes: [...READ_SCOPES, 'openid'] }, { publicPolicySourceHash: 'older-policy' }]) assert.ok(releaseReasons({ ...fixture(), ...patch }, expected, now).length);
});
test('missing evidence safely blocks publication', () => {
  assert.ok(releaseReasons(undefined, expected, now).length);
  assert.ok(releaseReasons({}, expected, now).length);
});
