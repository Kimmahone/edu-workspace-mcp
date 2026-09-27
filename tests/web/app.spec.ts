import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('teacher can edit a sample, preview, download HWPX, read it back, and use mobile navigation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: /생각은 자유롭게/  })).toBeVisible();
  await page.goto('/#create/notice'); await page.getByRole('button', { name: '예시로 먼저 시작하기' }).click(); await page.getByRole('button',{name:'내용 편집',exact:true}).click();
  await page.getByLabel('자료 제목', { exact:true }).fill('독서 행사 안내');
  await page.getByRole('button', { name:'미리보기', exact:true }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name:'독서 행사 안내' })).toBeVisible();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button',{name:'HWPX 다운로드',exact:true}).click();
  const download = await downloaded; expect(download.suggestedFilename()).toBe('독서 행사 안내.hwpx');
  const bytes = await readFile((await download.path())!); expect(bytes.length).toBeGreaterThan(1000);
  await page.getByRole('link', { name:/한글 문서실/ }).first().click();
  await page.locator('#document-file').setInputFiles({ name:'안내.hwpx', mimeType:'application/octet-stream', buffer:bytes });
  await page.getByRole('button',{name:'문서 읽기',exact:true}).click();
  await expect(page.getByLabel('문서 내용', {exact:true})).toContainText('독서 행사 안내');
  await expect(page.getByRole('button',{name:'원본 서식 유지해서 수정'})).toBeEnabled();
  await page.getByRole('button',{name:'미리보기',exact:true}).click();
  await expect(page.frameLocator('iframe').getByRole('heading',{name:'독서 행사 안내'})).toBeVisible();
  await page.screenshot({path:'outputs/web-documents.png',fullPage:true,animations:'disabled'});
  await page.getByRole('link',{name:/둘러보기/}).click(); await page.screenshot({path:'outputs/web-home.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844}); await expect(page.getByRole('heading',{name:/생각은 자유롭게/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:'outputs/web-mobile.png',fullPage:true,animations:'disabled'}); expect(errors).toEqual([]);
});
test('design choice changes preview and editing backup',async({page})=>{
  await page.goto('/#create/report');await page.getByRole('button',{name:'예시로 먼저 시작하기'}).click();
  await page.locator('#design-choice').selectOption('warm');
  await expect(page.frameLocator('iframe').getByText('웜 에디토리얼',{exact:true})).toBeVisible();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'편집본 보관'}).click();
  const download=await pending;const saved=JSON.parse(await readFile((await download.path())!,'utf8'));expect(saved.design).toBe('warm');
  await page.screenshot({path:'outputs/design-app-report.png',fullPage:true,animations:'disabled'});
});
test('GPT improvement is reviewed before replacing the draft; backup restores edits', async ({page}) => {
  await page.route('**/api/status', async route => { const response = await route.fetch(); const data = await response.json(); data.ai.openai = true; await route.fulfill({response,json:data}); });
  await page.route('**/api/generate', async route => { const data = await (await page.request.get('/api/sample?template=notice')).json(); data.draft.title = '개선된 가정통신문'; await route.fulfill({json:{draft:data.draft,provider:'openai',standards:[]}}); });
  await page.goto('/#create/notice'); await page.getByRole('button',{name:'예시로 먼저 시작하기'}).click(); await page.getByRole('button',{name:'내용 편집',exact:true}).click();
  await page.locator('#privacy').check(); await page.getByRole('button',{name:'✦ GPT로 초안 다듬기'}).click();
  await expect(page.getByRole('heading',{name:'기존 초안과 비교해 보세요'})).toBeVisible();
  await expect(page.frameLocator('#compare-new iframe').getByRole('heading',{name:'개선된 가정통신문'})).toBeVisible();
  await page.getByRole('button',{name:'개선안 적용'}).click(); await expect(page.getByLabel('자료 제목',{exact:true})).toHaveValue('개선된 가정통신문');
  const pending = page.waitForEvent('download'); await page.getByRole('button',{name:'편집본 보관'}).click(); const file = await pending;
  await page.getByRole('link',{name:/연결 및 이용 안내/}).click(); await page.locator('#restore-file').setInputFiles((await file.path())!);
  await page.getByRole('button',{name:'편집본 불러오기'}).click(); await expect(page.getByLabel('자료 제목',{exact:true})).toHaveValue('개선된 가정통신문');
});

test('public examples show real content, download all formats, and start editable general purpose work', async ({page,request}) => {
  await page.goto('/#examples');
  await expect(page.locator('.example-card')).toHaveCount(12);
  await page.getByRole('button',{name:'일상',exact:true}).click();
  await expect(page.locator('.example-card')).toHaveCount(1);
  await page.getByRole('link',{name:/함께 만드는 1박 2일 여행/}).click();
  await expect(page.frameLocator('iframe').getByRole('heading',{name:'함께 만드는 1박 2일 여행',exact:true})).toBeVisible();
  for(const extension of ['pdf','hwpx','md','json']) {
    const response=await request.get(`/assets/examples/travel-plan.${extension}`);
    expect(response.status()).toBe(200); expect(response.headers()['content-disposition']).toContain('attachment');
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  await page.getByRole('button',{name:'이 예시로 시작 →'}).click();
  await expect(page.getByLabel('자료 제목',{exact:true})).toHaveValue('함께 만드는 1박 2일 여행');
  await expect(page.locator('#audience')).toHaveValue('누구나');
  await expect(page.locator('#curriculum-options')).toBeHidden();
  await page.getByLabel('자료 제목',{exact:true}).fill('우리 가족 주말 여행');
  await page.getByRole('button',{name:'미리보기',exact:true}).click();
  await expect(page.frameLocator('iframe').getByRole('heading',{name:'우리 가족 주말 여행'})).toBeVisible();
  await page.getByRole('link',{name:/둘러보기/}).click();
  await page.locator('#quick-prompt').fill('우리 팀의 신입 구성원을 위한 협업 안내서');
  await page.getByRole('button',{name:/만들기 시작/}).click();
  await expect(page.locator('#prompt')).toHaveValue('우리 팀의 신입 구성원을 위한 협업 안내서');
  await expect(page.locator('#audience')).toHaveValue('누구나');
  const setup=await request.get('/setup'); expect(setup.status()).toBe(200); expect(await setup.text()).toContain('승인된 리디렉션 URI');
});

test('design assets load, reduced motion works, gallery filters and mobile layouts stay usable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.locator('.hero-sheet')).toBeVisible();
  expect(await page.locator('.hero-sheet').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.waitForFunction(()=>[...document.images].filter(img=>img.loading!=='lazy').every(img=>img.complete&&img.naturalWidth>0));
  await page.locator('#search-button').click();await page.locator('#gallery-search').fill('독서');
  expect(await page.locator('.example-card').count()).toBeGreaterThanOrEqual(4);
  await page.screenshot({path:'outputs/workspace-lab-gallery.png',fullPage:true,animations:'disabled'});
  for(const hash of ['examples','example/report','create/report','guide','settings']){
    await page.setViewportSize({width:390,height:844});await page.goto('/#'+hash);
    await expect(page.locator('#main')).not.toBeEmpty();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('elementary examples load their grade and standards and curriculum filters reach the server',async({page,request})=>{
 await page.goto('/#create/worksheet');
 await expect(page.locator('#grade')).toHaveValue('3');await expect(page.locator('#subject')).toHaveValue('수학');
 await page.getByRole('button',{name:'예시로 먼저 시작하기'}).click();
 await expect(page.frameLocator('iframe').getByRole('heading',{name:'똑같이 나누면 분수가 보여요',exact:true})).toBeVisible();
 await expect(page.locator('#standards-results input:checked')).toHaveValue('[4수01-09]');
 await expect(page.locator('#learning-context')).toContainText('평가 발문');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'편집본 보관'}).click();
 const file=await pending;const backup=JSON.parse(await readFile((await file.path())!,'utf8'));expect(backup.standardCodes).toEqual(['[4수01-09]']);
 await page.locator('#standard-query').fill('분수');await page.getByRole('button',{name:'검색',exact:true}).click();
 const response=await request.get('/api/standards?grade=3&subject='+encodeURIComponent('수학')+'&q='+encodeURIComponent('분수'));const body=await response.json();expect(body.result.total).toBeGreaterThan(0);
 expect(body.result.standards.every((s:any)=>s.gradeBand==='3-4'&&s.subject==='수학')).toBe(true);
 await page.screenshot({path:'outputs/elementary-curriculum.png',fullPage:true,animations:'disabled'});
});
