// Explicit integration check: creates five sample files in a clearly named Drive folder.
// Run after npm run build. No student data or Classroom publishing is involved.
import { mkdir, writeFile } from 'node:fs/promises';
import { createFolder, moveFile } from '../dist/google/drive.js';
import { sampleDraft } from '../dist/web/drafts.js';
import { saveOutput, readGoogleDoc } from '../dist/web/workspace.js';
import { documentJob } from '../dist/web/documents.js';
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const folder = await createFolder(`Workspace Lab 검증 예시 ${stamp}`);
const results = [];
await mkdir('outputs', { recursive:true });
try {
  for (const kind of ['document','worksheet','slides','quiz','sheet']) {
    const draft = sampleDraft(kind === 'sheet' ? 'tracker' : 'lesson-package');
    draft.title = `[Workspace Lab 검증] ${draft.title}`;
    const result = await saveOutput(kind, draft, kind === 'sheet' ? 'tracker' : 'lesson-package');
    const id = result.documentId ?? result.presentationId ?? result.formId ?? result.spreadsheetId;
    results.push({kind,...result});
    await writeFile('outputs/web-google-smoke.json', JSON.stringify({folder,results},null,2));
    if (id && folder.id) await moveFile(id,folder.id);
    console.log(`${kind}: created`);
  }
  const parsed = await readGoogleDoc(results[0].documentId);
  if (!parsed.markdown.includes(sampleDraft('lesson-package').title)) throw new Error('Google Docs export content mismatch');
  const generated = await documentJob({action:'generate',markdown:parsed.markdown});
  const checked = await documentJob({action:'parse',input:generated.file});
  if (!checked.markdown.includes(sampleDraft('lesson-package').title)) throw new Error('HWPX roundtrip mismatch');
  await writeFile('outputs/Google문서_왕복검증.hwpx',generated.file);
  console.log('Google Docs → DOCX → kordoc → HWPX → parse: passed');
  console.log(`Results saved in outputs/web-google-smoke.json`);
} catch(error) {
  console.error('Integration check failed. Created file links are retained in outputs/web-google-smoke.json.');
  console.error(error instanceof Error ? error.message : 'Unknown error'); process.exitCode=1;
}
