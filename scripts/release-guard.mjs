import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { releaseReasons } from './release-conditions.mjs';

try {
  const base = new URL('../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
  const source = await readFile(new URL('src/remote/session.ts', base), 'utf8');
  const serverUrl = source.match(/export const DEFAULT_REMOTE_URL='([^']+)'/)?.[1];
  if (!serverUrl) throw new Error('Missing reviewed server');
  const policy = await readFile(new URL('docs/privacy.html', base));
  const raw = await readFile(new URL('.release-readiness.local.json', base), 'utf8');
  if (Buffer.byteLength(raw) > 65536) throw new Error('Invalid evidence');
  const proof = JSON.parse(raw);
  const reasons = releaseReasons(proof, {
    version: manifest.version,
    sourceCommit: process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_SHA : undefined,
    serverUrl,
    publicPolicySourceHash: createHash('sha256').update(policy).digest('hex')
  });
  if (reasons.length) {
    console.error('공개 배포 차단: ' + reasons.join('; '));
    process.exitCode = 1;
  } else {
    console.log('현재 버전의 실제 검증과 공개 배포 승인 확인. 이 검사는 영구 무료 보장이 아니며 자체적으로 배포하지 않습니다.');
  }
} catch {
  console.error('공개 배포 차단: 실제 검증 기록 .release-readiness.local.json이 없거나 잘못되었습니다. 비밀값 없이 실제 확인한 상태·시각만 기록해야 합니다. 모의시험은 실제 인증 성공 기록으로 사용할 수 없습니다.');
  process.exitCode = 1;
}
