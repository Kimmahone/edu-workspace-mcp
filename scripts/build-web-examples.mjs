import { mkdir, writeFile } from 'node:fs/promises';
import { markdownToHwpx } from 'kordoc';
import {designedMarkdown,hwpxOptions} from '../dist/web/design.js';
import {designPreview} from '../dist/web/design-preview.js';
import { templates, sampleDraft, draftMarkdown, validateDraft } from '../dist/web/drafts.js';
import {elementaryExamples} from '../dist/web/elementary-examples.js';
import {resolveStandardCodes} from '../dist/curriculum/standards.js';
const directory = new URL('../web/assets/examples/', import.meta.url);
await mkdir(directory, { recursive: true });
await mkdir(new URL('../outputs/',import.meta.url), {recursive:true});
for (const template of templates) {
  const draft = validateDraft(sampleDraft(template.id), template.id);
  const education=elementaryExamples[template.id],standardCodes=education?.standardCodes??[],standards=resolveStandardCodes(standardCodes);
  const content = designedMarkdown(draft,template.id)+(standards.length?'\n\n## 참고 성취기준\n'+standards.map(s=>`${s.code} ${s.text??s.summary}`).join('\n\n')+'\n\n출처: 초등 교육과정·NCIC 공개 문서에서 자동 추출한 자료. 학년은 활용 예시이며 성취기준은 학년군 기준입니다. 배포 전 공식 원문과 대조하세요.':'');
  const markdown = `> Workspace Lab에서 제공하는 편집 가능한 예시 자료입니다. 실제 사실·일정은 확인 후 사용하세요.\n\n${content}`;
  await writeFile(new URL(`${template.id}.md`,directory), markdown);
  await writeFile(new URL(`design-${template.id}.html`,new URL('../outputs/',import.meta.url)),designPreview(draft,template.id,'navy'));
  await writeFile(new URL(`${template.id}.json`,directory), JSON.stringify({template:template.id,draft,standardCodes,education},null,2));
  await writeFile(new URL(`${template.id}.hwpx`,directory), Buffer.from(await markdownToHwpx(markdown,hwpxOptions(markdown,'navy'))));
}
console.log(`Bundled ${templates.length} examples in Markdown, JSON and HWPX.`);
