export const READ_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly'
]);
export const EDIT_SCOPES = Object.freeze(READ_SCOPES.map(scope=>scope.replace('/documents.readonly','/documents').replace('/spreadsheets.readonly','/spreadsheets')));
const EDIT_CHECKS=['editScopesVerifiedByGoogle','writeGoogleAuthorization','documentCreateAndEdit','spreadsheetCreateAndEdit','readTokenWriteDenied','writeDuplicateDenied','writeLimitStopVerified'];
const editRelease=version=>{const [major,minor]=String(version).split('.').map(Number);return major>1 || major===1 && minor>=2;};
const REQUIRED_LIVE_CHECKS = [
  'authorizationCodeExchanged', 'freshGoogleRefresh', 'documentRead',
  'mcpRefreshRotation', 'multiUserIsolation', 'disconnectVerified',
  'freeCpuVerified', 'hostInstallVerified', 'publicPolicyVerified',
  'freeLimitStopVerified', 'costExpiryStopVerified', 'expiredDataCleanupVerified', 'cleanupScheduleVerified'
];

// Operator verification metadata only. Never read credentials or contact services.
export function releaseReasons(proof, expected, now = Date.now()) {
  const reasons = [];
  if (proof?.schemaVersion !== 1 || proof.evidenceKind !== 'live' || proof.version !== expected.version || proof.serverUrl !== expected.serverUrl) reasons.push('이 버전·서버의 실제 검증 기록 필요');
  if (expected.sourceCommit && proof?.sourceCommit !== expected.sourceCommit) reasons.push('검증한 릴리스 commit 일치 필요');
  const checkedAt = Date.parse(proof?.accountCheckedAt);
  const reviewedAt = Date.parse(proof?.costReviewedAt);
  const expiresAt = Date.parse(proof?.costReviewExpiresAt);
  if (proof?.workersPlan !== 'free' || proof.noPaidServices !== true || proof.noSeparateModelApiCalls !== true || proof.googleStandardTierOnly !== true) reasons.push('현재 무료 요금제·표준 API 사용 확인 필요');
  if (!Number.isFinite(checkedAt) || now - checkedAt > 900000 || checkedAt > now + 60000) reasons.push('현재 계정 Free 상태 재확인 필요');
  if (!Number.isFinite(reviewedAt) || !Number.isFinite(expiresAt) || reviewedAt > now + 60000 || expiresAt <= now || expiresAt <= reviewedAt || expiresAt - reviewedAt > 86400000 || expiresAt - now > 86400000) reasons.push('유효한 현재 요금 검토 기록 필요');
  const scopes = proof?.approvedGoogleScopes;
  if (!Array.isArray(scopes) || scopes.length !== READ_SCOPES.length || new Set(scopes).size !== READ_SCOPES.length || !READ_SCOPES.every(scope => scopes.includes(scope)) || proof.aiWebClientVerified !== true) reasons.push('AI 전용 Web client와 읽기 권한 5개 확인 필요');
  if (REQUIRED_LIVE_CHECKS.some(key => proof?.checks?.[key] !== true)) reasons.push('실제 로그인·갱신·읽기·격리·철회·Free 성능·한도/만료 중단·만료 정리·설치·공개 정책 검증 필요');
  if(editRelease(expected.version)) {
    const editScopes=proof?.approvedGoogleEditScopes;
    if(!Array.isArray(editScopes) || editScopes.length!==EDIT_SCOPES.length || new Set(editScopes).size!==EDIT_SCOPES.length || !EDIT_SCOPES.every(scope=>editScopes.includes(scope)) || EDIT_CHECKS.some(key=>proof?.checks?.[key]!==true)) reasons.push('Docs·Sheets Google 범위 검증·실제 쓰기 동의·생성·수정·권한 분리·중복/한도 차단 검증 필요');
  }
  if (proof?.publicPolicyUrl !== 'https://edu.jeld.kr/privacy.html' || proof.publicPolicySourceHash !== expected.publicPolicySourceHash) reasons.push('현재 후보와 일치하는 공개 개인정보처리방침 확인 필요');
  if (proof?.maintenancePlanReviewed !== true || typeof proof.maintenancePlan !== 'string' || !proof.maintenancePlan.trim()) reasons.push('검토 만료 시 중단·재검토하는 운영 계획 확인 필요');
  if (proof?.publicationApproved !== true) reasons.push('검증한 버전의 구체적인 공개 배포 승인 필요');
  return reasons;
}

// This projection intentionally excludes local notes, account inventory and private proof details.
export function publicReleaseEvidence(proof, expected, sourceCommit, now=Date.now()) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit) || releaseReasons(proof,expected,now).length) throw new Error('LIVE_RELEASE_EVIDENCE_REQUIRED');
  const fields=['schemaVersion','evidenceKind','version','serverUrl','workersPlan','accountCheckedAt','costReviewedAt','costReviewExpiresAt','noPaidServices','noSeparateModelApiCalls','googleStandardTierOnly','aiWebClientVerified','approvedGoogleScopes','publicPolicyUrl','publicPolicySourceHash','maintenancePlanReviewed','maintenancePlan','publicationApproved'];
  const result=Object.fromEntries(fields.map(key=>[key,proof[key]]));
  return {...result,...(editRelease(expected.version)?{approvedGoogleEditScopes:proof.approvedGoogleEditScopes}:{}),sourceCommit,checks:Object.fromEntries([...REQUIRED_LIVE_CHECKS,...(editRelease(expected.version)?EDIT_CHECKS:[])].map(key=>[key,proof.checks[key]]))};
}
